from typing import Any, List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException

from app.api.dependencies import DbSession, get_current_active_user, get_current_admin_user
from app.schemas.user import UserResponse, UserUpdate
from app.models.user import User
from app.services.user import UserService
from app.repositories.user import UserRepository

router = APIRouter()

# ── Current User ──

@router.get("/me", response_model=UserResponse, summary="Get current user profile")
async def read_user_me(
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """Return the currently authenticated user's profile."""
    return current_user

@router.put("/me", response_model=UserResponse, summary="Update own profile")
async def update_user_me(
    *,
    db: DbSession,
    user_in: UserUpdate,
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """Update the currently authenticated user's profile (name, phone, etc.)."""
    return await UserService.update_user(db=db, db_user=current_user, user_in=user_in)

# ── Admin: User Management ──

@router.get("", response_model=List[UserResponse], summary="List all users (Admin)")
async def read_users(
    db: DbSession,
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_admin_user),
) -> Any:
    """Retrieve all users. Admin only."""
    return await UserRepository.get_all(db, skip=skip, limit=limit)

@router.get("/{user_id}", response_model=UserResponse, summary="Get user by ID (Admin)")
async def read_user_by_id(
    user_id: UUID,
    db: DbSession,
    current_user: User = Depends(get_current_admin_user),
) -> Any:
    """Get a specific user by their ID. Admin only."""
    user = await UserRepository.get_by_id(db, id=user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@router.put("/{user_id}", response_model=UserResponse, summary="Update user (Admin)")
async def update_user(
    *,
    db: DbSession,
    user_id: UUID,
    user_in: UserUpdate,
    current_user: User = Depends(get_current_admin_user),
) -> Any:
    """Update any user's profile. Admin only."""
    user = await UserRepository.get_by_id(db, id=user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return await UserService.update_user(db=db, db_user=user, user_in=user_in)

@router.patch("/{user_id}/activate", response_model=UserResponse, summary="Activate user (Admin)")
async def activate_user(
    user_id: UUID,
    db: DbSession,
    current_user: User = Depends(get_current_admin_user),
) -> Any:
    """Re-activate a deactivated user account. Admin only."""
    user = await UserRepository.activate(db, id=user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@router.patch("/{user_id}/deactivate", response_model=UserResponse, summary="Deactivate user (Admin)")
async def deactivate_user(
    user_id: UUID,
    db: DbSession,
    current_user: User = Depends(get_current_admin_user),
) -> Any:
    """Deactivate a user account. The user can no longer login. Admin only."""
    user = await UserRepository.deactivate(db, id=user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user
