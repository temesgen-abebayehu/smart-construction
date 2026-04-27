from typing import Any, List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException

from app.api.dependencies import DbSession, get_current_active_user, get_current_admin_user
from app.schemas.project import SupplierCreate, SupplierUpdate, SupplierResponse
from app.repositories.project import SupplierRepository
from app.models.user import User

router = APIRouter()
repo = SupplierRepository()

@router.get("", response_model=List[SupplierResponse])
async def list_suppliers(db: DbSession, skip: int = 0, limit: int = 100, _: User = Depends(get_current_active_user)) -> Any:
    return await repo.get_all(db, skip=skip, limit=limit)

@router.post("", response_model=SupplierResponse, status_code=201)
async def create_supplier(*, db: DbSession, supplier_in: SupplierCreate, _: User = Depends(get_current_active_user)) -> Any:
    return await repo.create(db, supplier_in)

@router.get("/{supplier_id}", response_model=SupplierResponse)
async def get_supplier(supplier_id: UUID, db: DbSession, _: User = Depends(get_current_active_user)) -> Any:
    supplier = await repo.get_by_id(db, supplier_id)
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    return supplier

@router.put("/{supplier_id}", response_model=SupplierResponse)
async def update_supplier(*, db: DbSession, supplier_id: UUID, supplier_in: SupplierUpdate, _: User = Depends(get_current_active_user)) -> Any:
    supplier = await repo.get_by_id(db, supplier_id)
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    return await repo.update(db, supplier, supplier_in)

@router.delete("/{supplier_id}", status_code=204)
async def delete_supplier(supplier_id: UUID, db: DbSession, _: User = Depends(get_current_admin_user)) -> None:
    await repo.delete(db, supplier_id)
