from pydantic import BaseModel, ConfigDict
from uuid import UUID
from datetime import datetime
from app.models.commons import TaskStatus

class TaskBase(BaseModel):
    name: str
    status: TaskStatus = TaskStatus.PENDING
    start_date: datetime | None = None
    # duration_days is the source of truth; end_date is derived but kept for backward compat.
    duration_days: int | None = None
    end_date: datetime | None = None
    budget: float | None = 0.0
    assigned_to: UUID | None = None

class TaskCreate(TaskBase):
    # Optional: set a dependency at creation time. The backend will auto-adjust
    # start_date to the business day after the predecessor's end_date.
    depends_on_task_id: UUID | None = None

class TaskUpdate(BaseModel):
    name: str | None = None
    status: TaskStatus | None = None
    progress_percentage: float | None = None
    start_date: datetime | None = None
    duration_days: int | None = None
    end_date: datetime | None = None
    budget: float | None = None
    assigned_to: UUID | None = None

class AssigneeBasic(BaseModel):
    id: UUID
    full_name: str
    email: str
    model_config = ConfigDict(from_attributes=True)

class TaskResponse(TaskBase):
    id: UUID
    project_id: UUID
    progress_percentage: float
    assignee: AssigneeBasic | None = None
    model_config = ConfigDict(from_attributes=True)

class TaskDependencyBase(BaseModel):
    depends_on_task_id: UUID

class TaskDependencyCreate(TaskDependencyBase):
    pass

class TaskDependencyResponse(TaskDependencyBase):
    id: UUID
    task_id: UUID
    model_config = ConfigDict(from_attributes=True)


# ── Task Activities ──

class TaskActivityCreate(BaseModel):
    name: str
    percentage: float  # contribution weight to task progress (0-100)

class TaskActivityUpdate(BaseModel):
    name: str | None = None
    percentage: float | None = None
    is_completed: bool | None = None

class TaskActivityResponse(BaseModel):
    id: UUID
    task_id: UUID
    name: str
    percentage: float
    is_completed: bool
    model_config = ConfigDict(from_attributes=True)


# ── Per-task aggregations ──

class ManpowerByTrade(BaseModel):
    worker_type: str
    workers: int           # number of manpower entries logged for this trade
    hours_worked: float
    cost: float

class TaskManpowerSummary(BaseModel):
    """Aggregate manpower used on a task across all of its daily logs.
    Lets the PM see efficiency: quantity_completed ÷ total_hours."""
    task_id: UUID
    task_name: str
    log_count: int
    total_workers: int          # number of manpower entries (proxy for headcount-days)
    total_hours: float
    total_cost: float
    total_quantity_completed: float | None = None
    productivity_per_hour: float | None = None    # quantity_completed / total_hours
    by_trade: list[ManpowerByTrade]
