from typing import Any, List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func

from app.api.dependencies import DbSession, get_current_active_user, require_project_role
from app.models.user import User
from app.models.commons import ProjectRole
from app.models.system import BudgetItem
from app.models.project import Project
from app.schemas.system import BudgetItemCreate, BudgetItemResponse, BudgetSummary
from app.repositories.project import ProjectRepository

router = APIRouter()
project_repo = ProjectRepository()

@router.get("/{project_id}/budget", response_model=BudgetSummary, summary="Get budget summary")
async def get_budget(
    project_id: UUID, db: DbSession,
    _: User = Depends(get_current_active_user),
) -> Any:
    project = await project_repo.get_by_id(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    result = await db.execute(
        select(func.coalesce(func.sum(BudgetItem.amount), 0)).where(BudgetItem.project_id == project_id)
    )
    total_received = result.scalar()

    return BudgetSummary(
        total_budget=project.total_budget,
        budget_spent=project.budget_spent,
        total_received=total_received,
        remaining=project.total_budget - project.budget_spent,
    )

@router.post("/{project_id}/budget-items", response_model=BudgetItemResponse, status_code=201, summary="Create budget item",
             dependencies=[Depends(require_project_role([ProjectRole.PROJECT_MANAGER, ProjectRole.OFFICE_ENGINEER]))])
async def create_budget_item(
    *, db: DbSession, project_id: UUID, item_in: BudgetItemCreate,
) -> Any:
    project = await project_repo.get_by_id(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    item = BudgetItem(project_id=project_id, amount=item_in.amount, description=item_in.description)
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item

@router.get("/{project_id}/budget-items", response_model=List[BudgetItemResponse], summary="List budget items")
async def list_budget_items(
    project_id: UUID, db: DbSession,
    _: User = Depends(get_current_active_user),
) -> Any:
    result = await db.execute(select(BudgetItem).where(BudgetItem.project_id == project_id))
    return list(result.scalars().all())
