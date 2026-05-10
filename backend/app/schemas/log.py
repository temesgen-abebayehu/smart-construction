from pydantic import BaseModel, ConfigDict
from uuid import UUID
from datetime import datetime
from app.models.commons import LogStatus

# Daily Log Sub-Entities
class ShiftBase(BaseModel):
    shift_type: str

class ShiftCreate(ShiftBase):
    pass

class ShiftResponse(ShiftBase):
    id: UUID
    log_id: UUID
    model_config = ConfigDict(from_attributes=True)

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

# Daily Log Main Schema
class DailyLogBase(BaseModel):
    date: datetime | None = None
    notes: str | None = None
    weather: str | None = None  # e.g. 'sunny', 'rainy'
    # "How many" — quantity of work completed today, with its unit (m³, m, units, etc.)
    quantity_completed: float | None = None
    unit: str | None = None

class DailyLogCreate(DailyLogBase):
    pass  # project_id and task_id come from the URL path, not the body

class DailyLogUpdate(BaseModel):
    notes: str | None = None
    weather: str | None = None
    status: LogStatus | None = None
    quantity_completed: float | None = None
    unit: str | None = None

class DailyLogResponse(DailyLogBase):
    id: UUID
    project_id: UUID
    task_id: UUID | None = None
    created_by_id: UUID
    status: LogStatus
    rejection_reason: str | None = None
    model_config = ConfigDict(from_attributes=True)

class DailyLogReject(BaseModel):
    rejection_reason: str
