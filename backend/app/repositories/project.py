from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID
from app.models.project import Project, ProjectMember, Client, Supplier
from app.repositories.base import BaseRepository

class ProjectRepository(BaseRepository[Project]):
    def __init__(self):
        super().__init__(Project)

class ProjectMemberRepository(BaseRepository[ProjectMember]):
    def __init__(self):
        super().__init__(ProjectMember)
    
    async def get_by_project_and_user(self, db: AsyncSession, project_id: UUID, user_id: UUID) -> ProjectMember | None:
        result = await db.execute(
            select(ProjectMember).where(
                ProjectMember.project_id == project_id,
                ProjectMember.user_id == user_id
            )
        )
        return result.scalars().first()

class ClientRepository(BaseRepository[Client]):
    def __init__(self):
        super().__init__(Client)

    async def get_by_project(self, db: AsyncSession, project_id: UUID, skip: int = 0, limit: int = 100) -> list[Client]:
        result = await db.execute(
            select(Client)
            .where(Client.project_id == project_id)
            .offset(skip)
            .limit(limit)
        )
        return list(result.scalars().all())

    async def get_by_email(self, db: AsyncSession, email: str, project_id: UUID) -> Client | None:
        result = await db.execute(
            select(Client).where(Client.contact_email == email, Client.project_id == project_id)
        )
        return result.scalars().first()

    async def get_by_name(self, db: AsyncSession, name: str, project_id: UUID) -> Client | None:
        result = await db.execute(
            select(Client).where(Client.name == name, Client.project_id == project_id)
        )
        return result.scalars().first()

class SupplierRepository(BaseRepository[Supplier]):
    def __init__(self):
        super().__init__(Supplier)
    
    async def get_by_project(self, db: AsyncSession, project_id: UUID, skip: int = 0, limit: int = 100) -> list[Supplier]:
        result = await db.execute(
            select(Supplier)
            .where(Supplier.project_id == project_id)
            .offset(skip)
            .limit(limit)
        )
        return list(result.scalars().all())
