from uuid import UUID
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.schemas.user import UserCreate, UserUpdate
from app.schemas.token import Token
from app.repositories.user import UserRepository
from app.core.security import verify_password, create_access_token, create_refresh_token

class UserService:
    @staticmethod
    async def create_user(db: AsyncSession, user_in: UserCreate) -> User:
        user = await UserRepository.get_by_email(db, email=user_in.email)
        if user:
            raise HTTPException(
                status_code=400,
                detail="The user with this username already exists in the system.",
            )
        return await UserRepository.create(db, user_in=user_in)

    @staticmethod
    async def authenticate_user(db: AsyncSession, email: str, password: str) -> Token:
        user = await UserRepository.get_by_email(db, email=email)
        if not user or not verify_password(password, user.hashed_password):
            raise HTTPException(status_code=401, detail="Incorrect email or password")
        elif not user.is_active:
            raise HTTPException(status_code=400, detail="Inactive user")
        
        access_token = create_access_token(subject=user.id)
        refresh_token = create_refresh_token(subject=user.id)
        return Token(access_token=access_token, refresh_token=refresh_token, token_type="bearer")

    @staticmethod
    async def update_user(db: AsyncSession, db_user: User, user_in: UserUpdate) -> User:
        if user_in.email and user_in.email != db_user.email:
            existing_user = await UserRepository.get_by_email(db, email=user_in.email)
            if existing_user:
                raise HTTPException(status_code=409, detail="Email already taken")
        return await UserRepository.update(db, db_obj=db_user, obj_in=user_in)

    @staticmethod
    async def deactivate_user(db: AsyncSession, user_id: UUID) -> User:
        user = await UserRepository.deactivate(db, id=user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        return user
