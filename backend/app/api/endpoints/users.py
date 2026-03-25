from typing import Any, List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException

from app.api.dependencies import DbSession, get_current_active_user, get_current_admin_user
from app.schemas.user import UserCreate, UserResponse, UserUpdate
from app.models.user import User
from app.services.user import UserService
from app.repositories.user import UserRepository

router = APIRouter()

@router.get("/me", response_model=UserResponse)
async def read_user_me(
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """
    Get current user.
    """
    return current_user

@router.put("/me", response_model=UserResponse)
async def update_user_me(
    *,
    db: DbSession,
    user_in: UserUpdate,
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """
    Update own user profile.
    """
    return await UserService.update_user(db=db, db_user=current_user, user_in=user_in)

@router.get("", response_model=List[UserResponse])
async def read_users(
    db: DbSession,
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_admin_user),
) -> Any:
    """
    Retrieve all users (Admin only).
    """
    return await UserRepository.get_all(db, skip=skip, limit=limit)

@router.post("", response_model=UserResponse)
async def create_user(
    *,
    db: DbSession,
    user_in: UserCreate,
    current_user: User = Depends(get_current_admin_user),
) -> Any:
    """
    Create new user (Admin only).
    """
    return await UserService.create_user(db=db, user_in=user_in)

@router.get("/{user_id}", response_model=UserResponse)
async def read_user_by_id(
    user_id: UUID,
    db: DbSession,
    current_user: User = Depends(get_current_admin_user),
) -> Any:
    """
    Get a specific user by id (Admin only).
    """
    user = await UserRepository.get_by_id(db, id=user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    *,
    db: DbSession,
    user_id: UUID,
    user_in: UserUpdate,
    current_user: User = Depends(get_current_admin_user),
) -> Any:
    """
    Update a user (Admin only).
    """
    user = await UserRepository.get_by_id(db, id=user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return await UserService.update_user(db=db, db_user=user, user_in=user_in)

@router.delete("/{user_id}", response_model=UserResponse)
async def deactivate_user(
    *,
    db: DbSession,
    user_id: UUID,
    current_user: User = Depends(get_current_admin_user),
) -> Any:
    """
    Deactivate a user (Admin only).
    """
    user = await UserRepository.get_by_id(db, id=user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return await UserService.deactivate_user(db=db, user_id=user_id)
