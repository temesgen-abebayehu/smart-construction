from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from uuid import UUID
from typing import Generic, TypeVar, Type, List, Any
from app.models.user import Base

T = TypeVar("T", bound=Base)

class BaseRepository(Generic[T]):
    def __init__(self, model: Type[T]):
        self.model = model

    async def get_by_id(self, db: AsyncSession, id: UUID) -> T | None:
        result = await db.execute(select(self.model).where(self.model.id == id))
        return result.scalars().first()

    async def get_all(self, db: AsyncSession, skip: int = 0, limit: int = 100) -> List[T]:
        result = await db.execute(select(self.model).offset(skip).limit(limit))
        return list(result.scalars().all())

    async def create(self, db: AsyncSession, obj_in: Any) -> T:
        db_obj = self.model(**obj_in.model_dump())
        db.add(db_obj)
        await db.commit()
        await db.refresh(db_obj)
        return db_obj

    async def update(self, db: AsyncSession, db_obj: T, obj_in: Any) -> T:
        obj_data = obj_in.model_dump(exclude_unset=True)
        for field in obj_data:
            setattr(db_obj, field, obj_data[field])
        db.add(db_obj)
        await db.commit()
        await db.refresh(db_obj)
        return db_obj

    async def delete(self, db: AsyncSession, id: UUID) -> bool:
        db_obj = await self.get_by_id(db, id)
        if not db_obj:
            return False
        await db.delete(db_obj)
        await db.commit()
        return True
