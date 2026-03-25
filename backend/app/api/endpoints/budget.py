from typing import Any, List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func

from app.api.dependencies import DbSession, get_current_active_user, require_project_role
from app.models.user import User
from app.models.commons import ProjectRole
from app.models.system import Payment
from app.models.project import Project
from app.schemas.system import PaymentCreate, PaymentResponse, BudgetSummary
from app.repositories.project import ProjectRepository

router = APIRouter()
project_repo = ProjectRepository()

@router.get("/{project_id}/budget", response_model=BudgetSummary)
async def get_budget(
    project_id: UUID, db: DbSession,
    _: User = Depends(get_current_active_user),
) -> Any:
    project = await project_repo.get_by_id(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    result = await db.execute(
        select(func.coalesce(func.sum(Payment.amount), 0)).where(Payment.project_id == project_id)
    )
    total_received = result.scalar()
    
    return BudgetSummary(
        total_budget=project.total_budget,
        budget_spent=project.budget_spent,
        total_received=total_received,
        remaining=project.total_budget - project.budget_spent,
    )

@router.post("/{project_id}/payments", response_model=PaymentResponse, status_code=201,
             dependencies=[Depends(require_project_role([ProjectRole.PROJECT_MANAGER, ProjectRole.OFFICE_ENGINEER]))])
async def create_payment(
    *, db: DbSession, project_id: UUID, payment_in: PaymentCreate,
) -> Any:
    project = await project_repo.get_by_id(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    payment = Payment(project_id=project_id, amount=payment_in.amount, description=payment_in.description)
    db.add(payment)
    await db.commit()
    await db.refresh(payment)
    return payment

@router.get("/{project_id}/payments", response_model=List[PaymentResponse])
async def list_payments(
    project_id: UUID, db: DbSession,
    _: User = Depends(get_current_active_user),
) -> Any:
    result = await db.execute(select(Payment).where(Payment.project_id == project_id))
    return list(result.scalars().all())
