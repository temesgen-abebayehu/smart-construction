from datetime import datetime, timedelta, timezone
from typing import Any, List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.api.dependencies import DbSession, get_current_active_user, require_project_role, get_project_member
from app.models.user import User
from app.models.commons import ProjectRole
from app.models.project import Project
from app.models.task import Task, TaskDependency
from app.models.log import DailyLog, Manpower
from app.schemas.task import (
    TaskCreate, TaskUpdate, TaskResponse,
    TaskDependencyCreate, TaskDependencyResponse,
    TaskManpowerSummary, ManpowerByTrade,
)
from app.repositories.log import TaskRepository, TaskDependencyRepository

task_repo = TaskRepository()
dep_repo = TaskDependencyRepository()


# ── Duration ↔ end_date sync ──

def _ensure_aware(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def _sync_end_date(task: Task) -> None:
    """duration_days is the source of truth. If start_date and duration_days
    are both set, recompute end_date. Otherwise leave end_date alone."""
    start = _ensure_aware(task.start_date)
    if start is None or task.duration_days is None:
        return
    task.end_date = start + timedelta(days=int(task.duration_days))


def _backfill_duration_from_end(task: Task) -> None:
    """When a caller supplies end_date but no duration_days, derive duration."""
    start = _ensure_aware(task.start_date)
    end = _ensure_aware(task.end_date)
    if task.duration_days is None and start and end:
        delta = (end - start).days
        task.duration_days = max(0, delta)


# ── Dependency cascade ──

async def _propagate_dependents(db, source_task_id: UUID, visited: set[UUID] | None = None) -> None:
    """Walk forward through TaskDependency edges. For every successor of
    source_task_id, recompute its start_date as the latest predecessor end_date,
    re-derive its end_date from duration, and recurse. visited prevents cycles."""
    if visited is None:
        visited = set()
    if source_task_id in visited:
        return
    visited.add(source_task_id)

    successors_res = await db.execute(
        select(TaskDependency).where(TaskDependency.depends_on_task_id == source_task_id)
    )
    successor_edges = list(successors_res.scalars().all())

    for edge in successor_edges:
        successor = await db.get(Task, edge.task_id)
        if not successor:
            continue

        # Find the latest end_date among ALL predecessors of this successor.
        all_preds_res = await db.execute(
            select(TaskDependency).where(TaskDependency.task_id == successor.id)
        )
        latest_pred_end: datetime | None = None
        for pred_edge in all_preds_res.scalars().all():
            pred = await db.get(Task, pred_edge.depends_on_task_id)
            pred_end = _ensure_aware(pred.end_date) if pred else None
            if pred_end and (latest_pred_end is None or pred_end > latest_pred_end):
                latest_pred_end = pred_end

        if latest_pred_end is None:
            continue

        old_start = _ensure_aware(successor.start_date)
        # Only push forward — never pull a successor backwards.
        if old_start is None or old_start < latest_pred_end:
            successor.start_date = latest_pred_end
            _sync_end_date(successor)
            db.add(successor)
            await db.flush()
            await _propagate_dependents(db, successor.id, visited)


# ── Project progress recalc ──

async def _recalculate_project_progress(db, project_id: UUID):
    """Recalculate project progress_percentage as average of all task progress."""
    result = await db.execute(
        select(func.avg(Task.progress_percentage)).where(Task.project_id == project_id)
    )
    avg = result.scalar()
    project = await db.get(Project, project_id)
    if project:
        project.progress_percentage = round(avg or 0, 2)
        db.add(project)
        await db.commit()


router = APIRouter()


# ── Task CRUD ──

@router.post("/{project_id}/tasks", response_model=TaskResponse, status_code=201,
             dependencies=[Depends(require_project_role([ProjectRole.PROJECT_MANAGER]))])
async def create_task(
    *, db: DbSession, project_id: UUID, task_in: TaskCreate,
) -> Any:
    task = Task(
        project_id=project_id,
        name=task_in.name,
        status=task_in.status.value if task_in.status else "pending",
        start_date=task_in.start_date,
        duration_days=task_in.duration_days,
        end_date=task_in.end_date,
        budget=task_in.budget or 0.0,
        assigned_to=task_in.assigned_to,
    )
    # Reconcile duration ↔ end_date.
    if task.duration_days is not None:
        _sync_end_date(task)
    else:
        _backfill_duration_from_end(task)

    db.add(task)
    await db.commit()
    await _recalculate_project_progress(db, project_id)
    # Re-fetch with assignee loaded
    result = await db.execute(
        select(Task).options(selectinload(Task.assignee)).where(Task.id == task.id)
    )
    return result.scalars().first()


@router.get("/{project_id}/tasks", response_model=List[TaskResponse])
async def list_tasks(
    project_id: UUID, db: DbSession, status: str = None,
    assigned_to: UUID = None,
    skip: int = 0, limit: int = 100,
    _: User = Depends(get_current_active_user),
) -> Any:
    stmt = select(Task).options(selectinload(Task.assignee)).where(Task.project_id == project_id)
    if status:
        stmt = stmt.where(Task.status == status)
    if assigned_to:
        stmt = stmt.where(Task.assigned_to == assigned_to)
    stmt = stmt.offset(skip).limit(limit)
    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.get("/tasks/{task_id}", response_model=TaskResponse)
async def get_task(task_id: UUID, db: DbSession, _: User = Depends(get_current_active_user)) -> Any:
    result = await db.execute(
        select(Task).options(selectinload(Task.assignee)).where(Task.id == task_id)
    )
    task = result.scalars().first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.put("/tasks/{task_id}", response_model=TaskResponse)
async def update_task(
    *, db: DbSession, task_id: UUID, task_in: TaskUpdate,
    _: User = Depends(get_current_active_user),
) -> Any:
    task = await task_repo.get_by_id(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    # Block start if dependencies are not completed
    new_status = task_in.status.value if task_in.status else None
    if new_status == "in_progress" or (task_in.progress_percentage and task_in.progress_percentage > 0 and task.status == "pending"):
        deps = await dep_repo.get_by_task(db, task_id)
        for dep in deps:
            blocker = await task_repo.get_by_id(db, dep.depends_on_task_id)
            if blocker and blocker.status != "completed":
                raise HTTPException(
                    status_code=400,
                    detail=f"Cannot start — dependency '{blocker.name}' is not completed yet"
                )

    schedule_fields_changed = (
        task_in.start_date is not None
        or task_in.duration_days is not None
        or task_in.end_date is not None
    )

    updated = await task_repo.update(db, task, task_in)

    # Reconcile duration ↔ end_date after the update.
    if schedule_fields_changed:
        if task_in.duration_days is not None or task_in.start_date is not None:
            _sync_end_date(updated)
        elif task_in.end_date is not None:
            _backfill_duration_from_end(updated)
        db.add(updated)
        await db.flush()

    # Auto-update status based on progress
    if updated.progress_percentage >= 100 and updated.status != "completed":
        updated.status = "completed"
        db.add(updated)
        await db.commit()
        await db.refresh(updated)
    elif updated.progress_percentage > 0 and updated.status == "pending":
        updated.status = "in_progress"
        db.add(updated)
        await db.commit()
        await db.refresh(updated)
    else:
        await db.commit()

    # Cascade schedule changes to dependents.
    if schedule_fields_changed:
        await _propagate_dependents(db, updated.id)
        await db.commit()

    await _recalculate_project_progress(db, task.project_id)
    # Re-fetch with assignee loaded
    result = await db.execute(
        select(Task).options(selectinload(Task.assignee)).where(Task.id == updated.id)
    )
    return result.scalars().first()


@router.delete("/tasks/{task_id}", status_code=204)
async def delete_task(task_id: UUID, db: DbSession, _: User = Depends(get_current_active_user)) -> None:
    task = await task_repo.get_by_id(db, task_id)
    project_id = task.project_id if task else None
    await task_repo.delete(db, task_id)
    if project_id:
        await _recalculate_project_progress(db, project_id)


# ── Task Dependencies ──

@router.post("/tasks/{task_id}/dependencies", response_model=TaskDependencyResponse, status_code=201)
async def add_dependency(
    *, db: DbSession, task_id: UUID, dep_in: TaskDependencyCreate,
    _: User = Depends(get_current_active_user),
) -> Any:
    if task_id == dep_in.depends_on_task_id:
        raise HTTPException(status_code=400, detail="A task cannot depend on itself")
    dep = TaskDependency(task_id=task_id, depends_on_task_id=dep_in.depends_on_task_id)
    db.add(dep)
    await db.commit()
    await db.refresh(dep)

    # New edge means the predecessor's end_date may now constrain task_id's start.
    # Cascade FROM the predecessor so task_id (and onward) are pushed forward as needed.
    await _propagate_dependents(db, dep_in.depends_on_task_id)
    await db.commit()
    return dep


@router.get("/tasks/{task_id}/dependencies", response_model=List[TaskDependencyResponse])
async def list_dependencies(
    task_id: UUID, db: DbSession, _: User = Depends(get_current_active_user),
) -> Any:
    return await dep_repo.get_by_task(db, task_id)


@router.delete("/tasks/{task_id}/dependencies/{dep_id}", status_code=204)
async def remove_dependency(
    task_id: UUID, dep_id: UUID, db: DbSession,
    _: User = Depends(get_current_active_user),
) -> None:
    result = await db.execute(
        select(TaskDependency).where(TaskDependency.id == dep_id, TaskDependency.task_id == task_id)
    )
    dep = result.scalars().first()
    if dep:
        await db.delete(dep)
        await db.commit()


# ── Per-task manpower / efficiency aggregation ──

@router.get("/tasks/{task_id}/manpower-summary", response_model=TaskManpowerSummary)
async def get_task_manpower_summary(
    task_id: UUID, db: DbSession,
    _: User = Depends(get_current_active_user),
) -> Any:
    """Aggregate manpower across all daily logs for this task. Lets the PM see
    headcount-days, total hours, total cost, and quantity-per-hour productivity."""
    task = await db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    logs_res = await db.execute(select(DailyLog).where(DailyLog.task_id == task_id))
    logs = list(logs_res.scalars().all())
    log_ids = [l.id for l in logs]

    manpower_rows: list[Manpower] = []
    if log_ids:
        mp_res = await db.execute(select(Manpower).where(Manpower.log_id.in_(log_ids)))
        manpower_rows = list(mp_res.scalars().all())

    by_trade_map: dict[str, dict[str, float]] = {}
    for mp in manpower_rows:
        trade = mp.worker_type or "unspecified"
        agg = by_trade_map.setdefault(trade, {"workers": 0, "hours": 0.0, "cost": 0.0})
        agg["workers"] += 1
        agg["hours"] += float(mp.hours_worked or 0.0)
        agg["cost"] += float(mp.cost or 0.0)

    total_hours = sum(float(mp.hours_worked or 0.0) for mp in manpower_rows)
    total_cost = sum(float(mp.cost or 0.0) for mp in manpower_rows)
    total_quantity = sum(float(l.quantity_completed or 0.0) for l in logs if l.quantity_completed is not None)
    productivity = (total_quantity / total_hours) if total_hours > 0 and total_quantity > 0 else None

    return TaskManpowerSummary(
        task_id=task.id,
        task_name=task.name,
        log_count=len(logs),
        total_workers=len(manpower_rows),
        total_hours=round(total_hours, 2),
        total_cost=round(total_cost, 2),
        total_quantity_completed=round(total_quantity, 2) if total_quantity > 0 else None,
        productivity_per_hour=round(productivity, 4) if productivity is not None else None,
        by_trade=[
            ManpowerByTrade(
                worker_type=trade,
                workers=int(agg["workers"]),
                hours_worked=round(agg["hours"], 2),
                cost=round(agg["cost"], 2),
            )
            for trade, agg in by_trade_map.items()
        ],
    )
