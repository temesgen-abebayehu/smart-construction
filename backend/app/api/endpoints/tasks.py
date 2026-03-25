from typing import Any, List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select

from app.api.dependencies import DbSession, get_current_active_user, require_project_role, get_project_member
from app.models.user import User
from app.models.commons import ProjectRole
from app.models.task import Task, TaskDependency
from app.schemas.task import TaskCreate, TaskUpdate, TaskResponse, TaskDependencyCreate, TaskDependencyResponse
from app.repositories.log import TaskRepository, TaskDependencyRepository

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
    )
    db.add(task)
    await db.commit()
    await db.refresh(task)
    return task

@router.get("/{project_id}/tasks", response_model=List[TaskResponse])
async def list_tasks(
    project_id: UUID, db: DbSession, status: str = None,
    skip: int = 0, limit: int = 100,
    _: User = Depends(get_current_active_user),
) -> Any:
    return await task_repo.get_by_project(db, project_id, skip=skip, limit=limit, status=status)

@router.get("/tasks/{task_id}", response_model=TaskResponse)
async def get_task(task_id: UUID, db: DbSession, _: User = Depends(get_current_active_user)) -> Any:
    task = await task_repo.get_by_id(db, task_id)
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
    return await task_repo.update(db, task, task_in)

@router.delete("/tasks/{task_id}", status_code=204)
async def delete_task(task_id: UUID, db: DbSession, _: User = Depends(get_current_active_user)) -> None:
    await task_repo.delete(db, task_id)

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
