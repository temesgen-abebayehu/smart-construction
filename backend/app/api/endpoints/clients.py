from typing import Any, List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException

from app.api.dependencies import DbSession, get_current_active_user, get_current_admin_user
from app.schemas.project import ClientCreate, ClientUpdate, ClientResponse
from app.repositories.project import ClientRepository
from app.models.user import User

router = APIRouter()
repo = ClientRepository()

@router.get("", response_model=List[ClientResponse], summary="List clients")
async def list_clients(db: DbSession, skip: int = 0, limit: int = 100, _: User = Depends(get_current_active_user)) -> Any:
    return await repo.get_all(db, skip=skip, limit=limit)

@router.post("", response_model=ClientResponse, status_code=201, summary="Create client")
async def create_client(*, db: DbSession, client_in: ClientCreate, _: User = Depends(get_current_active_user)) -> Any:
    return await repo.create(db, client_in)

@router.get("/{client_id}", response_model=ClientResponse, summary="Get client")
async def get_client(client_id: UUID, db: DbSession, _: User = Depends(get_current_active_user)) -> Any:
    client = await repo.get_by_id(db, client_id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    return client

@router.put("/{client_id}", response_model=ClientResponse, summary="Update client")
async def update_client(*, db: DbSession, client_id: UUID, client_in: ClientUpdate, _: User = Depends(get_current_active_user)) -> Any:
    client = await repo.get_by_id(db, client_id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    return await repo.update(db, client, client_in)

@router.delete("/{client_id}", status_code=204, summary="Delete client (Admin)")
async def delete_client(client_id: UUID, db: DbSession, _: User = Depends(get_current_admin_user)) -> None:
    await repo.delete(db, client_id)
