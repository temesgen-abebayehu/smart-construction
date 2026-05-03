from uuid import UUID
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import logging

from app.models.user import User
from app.models.project import ProjectMember, ProjectInvitation
from app.schemas.user import UserCreate, UserUpdate
from app.schemas.token import Token
from app.repositories.user import UserRepository
from app.core.security import verify_password, create_access_token, create_refresh_token

logger = logging.getLogger(__name__)

class UserService:
    @staticmethod
    async def create_user(db: AsyncSession, user_in: UserCreate) -> User:
        user = await UserRepository.get_by_email(db, email=user_in.email)
        if user:
            raise HTTPException(
                status_code=400,
                detail="The user with this username already exists in the system.",
            )
        new_user = await UserRepository.create(db, user_in=user_in)

        # Auto-accept pending invitations for this email
        result = await db.execute(
            select(ProjectInvitation).where(
                ProjectInvitation.email == user_in.email,
                ProjectInvitation.status == "pending",
            )
        )
        pending = list(result.scalars().all())
        for inv in pending:
            member = ProjectMember(
                project_id=inv.project_id,
                user_id=new_user.id,
                role=inv.role,
            )
            db.add(member)
            inv.status = "accepted"
            db.add(inv)
            logger.info(f"Auto-accepted invitation for {user_in.email} to project {inv.project_id}")
        if pending:
            await db.commit()

        return new_user

    @staticmethod
    async def authenticate_user(db: AsyncSession, email: str, password: str) -> Token:
        user = await UserRepository.get_by_email(db, email=email)
        if not user or not verify_password(password, user.hashed_password):
            raise HTTPException(status_code=401, detail="Incorrect email or password")
        elif not user.is_active:
            raise HTTPException(status_code=400, detail="Inactive user")

        # Auto-accept pending invitations for this user
        result = await db.execute(
            select(ProjectInvitation).where(
                ProjectInvitation.email == email,
                ProjectInvitation.status == "pending",
            )
        )
        pending = list(result.scalars().all())
        for inv in pending:
            # Check not already a member
            existing = await db.execute(
                select(ProjectMember).where(
                    ProjectMember.project_id == inv.project_id,
                    ProjectMember.user_id == user.id,
                )
            )
            if not existing.scalars().first():
                member = ProjectMember(
                    project_id=inv.project_id,
                    user_id=user.id,
                    role=inv.role,
                )
                db.add(member)
            inv.status = "accepted"
            db.add(inv)
            logger.info(f"Auto-accepted invitation for {email} to project {inv.project_id}")
        if pending:
            await db.commit()

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
