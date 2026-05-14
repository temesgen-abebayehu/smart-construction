from typing import Any, List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query

from app.api.dependencies import DbSession, get_current_active_user, get_current_admin_user
from app.schemas.project import ContractorCreate, ContractorUpdate, ContractorResponse
from app.repositories.project import ContractorRepository
from app.models.user import User

router = APIRouter()
repo = ContractorRepository()

@router.get("", response_model=List[ContractorResponse], summary="List contractors by project")
async def list_contractors(
    db: DbSession, 
    project_id: UUID = Query(..., description="Filter contractors by project"),
    skip: int = 0, 
    limit: int = 100, 
    _: User = Depends(get_current_active_user)
) -> Any:
    return await repo.get_by_project(db, project_id, skip=skip, limit=limit)

@router.post("", response_model=ContractorResponse, status_code=201, summary="Create contractor")
async def create_contractor(*, db: DbSession, contractor_in: ContractorCreate, _: User = Depends(get_current_active_user)) -> Any:
    return await repo.create(db, contractor_in)

@router.get("/{contractor_id}", response_model=ContractorResponse, summary="Get contractor")
async def get_contractor(contractor_id: UUID, db: DbSession, _: User = Depends(get_current_active_user)) -> Any:
    contractor = await repo.get_by_id(db, contractor_id)
    if not contractor:
        raise HTTPException(status_code=404, detail="Contractor not found")
    return contractor

@router.put("/{contractor_id}", response_model=ContractorResponse, summary="Update contractor")
async def update_contractor(*, db: DbSession, contractor_id: UUID, contractor_in: ContractorUpdate, _: User = Depends(get_current_active_user)) -> Any:
    contractor = await repo.get_by_id(db, contractor_id)
    if not contractor:
        raise HTTPException(status_code=404, detail="Contractor not found")
    return await repo.update(db, contractor, contractor_in)

@router.delete("/{contractor_id}", status_code=204, summary="Delete contractor (Admin)")
async def delete_contractor(contractor_id: UUID, db: DbSession, _: User = Depends(get_current_admin_user)) -> None:
    await repo.delete(db, contractor_id)
