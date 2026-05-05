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
from app.schemas.task import TaskCreate, TaskUpdate, TaskResponse, TaskDependencyCreate, TaskDependencyResponse
from app.repositories.log import TaskRepository, TaskDependencyRepository


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
task_repo = TaskRepository()
dep_repo = TaskDependencyRepository()

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
        end_date=task_in.end_date,
        assigned_to=task_in.assigned_to,
    )
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

    updated = await task_repo.update(db, task, task_in)
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
    dep = TaskDependency(task_id=task_id, depends_on_task_id=dep_in.depends_on_task_id)
    db.add(dep)
    await db.commit()
    await db.refresh(dep)
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
