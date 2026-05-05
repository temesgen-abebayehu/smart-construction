from uuid import UUID
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.user import User
from app.schemas.user import UserCreate, UserUpdate
from app.core.security import get_password_hash

class UserRepository:
    @staticmethod
    async def get_by_id(db: AsyncSession, id: UUID | str) -> User | None:
        result = await db.execute(select(User).where(User.id == id))
        return result.scalars().first()
    
    @staticmethod
    async def get_by_email(db: AsyncSession, email: str) -> User | None:
        result = await db.execute(select(User).where(User.email == email))
        return result.scalars().first()

    @staticmethod
    async def get_by_google_id(db: AsyncSession, google_id: str) -> User | None:
        result = await db.execute(select(User).where(User.google_id == google_id))
        return result.scalars().first()

    @staticmethod
    async def create_oauth_user(
        db: AsyncSession,
        *,
        email: str,
        full_name: str,
        google_id: str,
    ) -> User:
        db_obj = User(
            full_name=full_name,
            email=email,
            hashed_password=None,
            google_id=google_id,
            auth_provider="google",
            is_admin=False,
            is_active=True,
        )
        db.add(db_obj)
        await db.commit()
        await db.refresh(db_obj)
        return db_obj

    @staticmethod
    async def link_google_id(db: AsyncSession, user: User, google_id: str) -> User:
        user.google_id = google_id
        if user.auth_provider == "local":
            user.auth_provider = "google"
        db.add(user)
        await db.commit()
        await db.refresh(user)
        return user

    @staticmethod
    async def get_all(db: AsyncSession, skip: int = 0, limit: int = 100) -> list[User]:
        result = await db.execute(select(User).offset(skip).limit(limit))
        return list(result.scalars().all())

    @staticmethod
    async def create(db: AsyncSession, user_in: UserCreate) -> User:
        db_obj = User(
            full_name=user_in.full_name,
            email=user_in.email,
            phone_number=user_in.phone_number,
            hashed_password=get_password_hash(user_in.password),
            is_admin=user_in.is_admin,
            is_active=user_in.is_active,
        )
        db.add(db_obj)
        await db.commit()
        await db.refresh(db_obj)
        return db_obj

    @staticmethod
    async def update(db: AsyncSession, db_obj: User, obj_in: UserUpdate) -> User:
        update_data = obj_in.model_dump(exclude_unset=True)
        if "password" in update_data:
            hashed_password = get_password_hash(update_data["password"])
            del update_data["password"]
            update_data["hashed_password"] = hashed_password

        for field, value in update_data.items():
            setattr(db_obj, field, value)

        db.add(db_obj)
        await db.commit()
        await db.refresh(db_obj)
        return db_obj

    @staticmethod
    async def deactivate(db: AsyncSession, id: UUID | str) -> User | None:
        db_obj = await UserRepository.get_by_id(db, id=id)
        if db_obj:
            db_obj.is_active = False
            db.add(db_obj)
            await db.commit()
            await db.refresh(db_obj)
        return db_obj
