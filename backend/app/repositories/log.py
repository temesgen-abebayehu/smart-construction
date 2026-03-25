from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID
from app.models.task import Task, TaskDependency
from app.models.log import DailyLog, Shift, Labor, Material, Equipment, EquipmentIdle
from app.repositories.base import BaseRepository

class TaskRepository(BaseRepository[Task]):
    def __init__(self):
        super().__init__(Task)

    async def get_by_project(self, db: AsyncSession, project_id: UUID, skip: int = 0, limit: int = 100, status: str = None):
        query = select(Task).where(Task.project_id == project_id)
        if status:
            query = query.where(Task.status == status)
        query = query.offset(skip).limit(limit)
        result = await db.execute(query)
        return list(result.scalars().all())

class TaskDependencyRepository(BaseRepository[TaskDependency]):
    def __init__(self):
        super().__init__(TaskDependency)

    async def get_by_task(self, db: AsyncSession, task_id: UUID):
        result = await db.execute(select(TaskDependency).where(TaskDependency.task_id == task_id))
        return list(result.scalars().all())

class DailyLogRepository(BaseRepository[DailyLog]):
    def __init__(self):
        super().__init__(DailyLog)

    async def get_by_project(self, db: AsyncSession, project_id: UUID, skip: int = 0, limit: int = 100, status: str = None):
        query = select(DailyLog).where(DailyLog.project_id == project_id)
        if status:
            query = query.where(DailyLog.status == status)
        query = query.offset(skip).limit(limit)
        result = await db.execute(query)
        return list(result.scalars().all())

class ShiftRepository(BaseRepository[Shift]):
    def __init__(self):
        super().__init__(Shift)

class LaborRepository(BaseRepository[Labor]):
    def __init__(self):
        super().__init__(Labor)

class MaterialRepository(BaseRepository[Material]):
    def __init__(self):
        super().__init__(Material)

class EquipmentRepository(BaseRepository[Equipment]):
    def __init__(self):
        super().__init__(Equipment)

class EquipmentIdleRepository(BaseRepository[EquipmentIdle]):
    def __init__(self):
        super().__init__(EquipmentIdle)
