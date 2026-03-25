from pydantic import BaseModel, ConfigDict
from uuid import UUID
from datetime import datetime
from app.models.commons import TaskStatus

class TaskBase(BaseModel):
    name: str
    status: TaskStatus = TaskStatus.PENDING
    start_date: datetime | None = None
    end_date: datetime | None = None

class TaskCreate(TaskBase):
    pass

class TaskUpdate(BaseModel):
    name: str | None = None
    status: TaskStatus | None = None
    progress_percentage: float | None = None
    start_date: datetime | None = None
    end_date: datetime | None = None

class TaskResponse(TaskBase):
    id: UUID
    project_id: UUID
    progress_percentage: float
    model_config = ConfigDict(from_attributes=True)

class TaskDependencyBase(BaseModel):
    depends_on_task_id: UUID

class TaskDependencyCreate(TaskDependencyBase):
    pass

class TaskDependencyResponse(TaskDependencyBase):
    id: UUID
    task_id: UUID
    model_config = ConfigDict(from_attributes=True)
