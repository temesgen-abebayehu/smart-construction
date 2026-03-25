from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID
from app.models.project import Project, ProjectMember, Client, Contractor, Supplier
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

class ContractorRepository(BaseRepository[Contractor]):
    def __init__(self):
        super().__init__(Contractor)

class SupplierRepository(BaseRepository[Supplier]):
    def __init__(self):
        super().__init__(Supplier)
