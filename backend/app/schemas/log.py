from pydantic import BaseModel, ConfigDict, EmailStr
from uuid import UUID
from datetime import datetime
from app.models.commons import LogStatus

# Daily Log Sub-Entities — Manpower
class ManpowerBase(BaseModel):
    worker_type: str
    hours_worked: float
    cost: float

class ManpowerCreate(ManpowerBase):
    pass

class ManpowerResponse(ManpowerBase):
    id: UUID
    log_id: UUID
    model_config = ConfigDict(from_attributes=True)

# Materials
class MaterialBase(BaseModel):
    name: str
    quantity: float
    unit: str
    cost: float

class MaterialCreate(MaterialBase):
    pass

class MaterialResponse(MaterialBase):
    id: UUID
    log_id: UUID
    model_config = ConfigDict(from_attributes=True)

# Equipment
class EquipmentBase(BaseModel):
    name: str
    hours_used: float
    cost: float

class EquipmentCreate(EquipmentBase):
    pass

class EquipmentResponse(EquipmentBase):
    id: UUID
    log_id: UUID
    model_config = ConfigDict(from_attributes=True)

# Equipment Idle
class EquipmentIdleBase(BaseModel):
    reason: str
    hours_idle: float

class EquipmentIdleCreate(EquipmentIdleBase):
    pass

class EquipmentIdleResponse(EquipmentIdleBase):
    id: UUID
    equipment_id: UUID
    model_config = ConfigDict(from_attributes=True)

# Daily Log Photos
class DailyLogPhotoResponse(BaseModel):
    id: UUID
    log_id: UUID
    url_path: str
    original_filename: str | None = None
    content_type: str | None = None
    size_bytes: int | None = None
    uploaded_by_id: UUID | None = None
    uploaded_at: datetime
    model_config = ConfigDict(from_attributes=True)

# Daily Log Activities (linking logs to completed task activities)
class DailyLogActivityCreate(BaseModel):
    task_activity_id: UUID

class DailyLogActivityResponse(BaseModel):
    id: UUID
    log_id: UUID
    task_activity_id: UUID
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

# Daily Log Main Schema
class DailyLogBase(BaseModel):
    date: datetime | None = None
    notes: str | None = None
    weather: str | None = None  # e.g. 'sunny', 'rainy'

class DailyLogCreate(DailyLogBase):
    task_activity_ids: list[str] | None = None  # IDs of task activities completed
    pass  # project_id and task_id come from the URL path, not the body

class DailyLogUpdate(BaseModel):
    notes: str | None = None
    weather: str | None = None
    status: LogStatus | None = None

class UserBasic(BaseModel):
    id: UUID
    full_name: str
    email: str
    phone_number: str | None = None
    model_config = ConfigDict(from_attributes=True)

class DailyLogResponse(DailyLogBase):
    id: UUID
    project_id: UUID
    task_id: UUID | None = None
    created_by_id: UUID
    status: LogStatus
    rejection_reason: str | None = None
    # Enriched fields for list display
    activities_count: int = 0
    manpower_count: int = 0
    manpower_cost: float = 0.0
    materials_count: int = 0
    materials_cost: float = 0.0
    equipment_count: int = 0
    equipment_cost: float = 0.0
    created_by: UserBasic | None = None
    model_config = ConfigDict(from_attributes=True)

class DailyLogReject(BaseModel):
    rejection_reason: str
