from pydantic import BaseModel, ConfigDict
from uuid import UUID
from datetime import datetime

# Payment
class PaymentCreate(BaseModel):
    amount: float
    description: str | None = None

class PaymentResponse(PaymentCreate):
    id: UUID
    project_id: UUID
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

# Budget summary
class BudgetSummary(BaseModel):
    total_budget: float
    budget_spent: float
    total_received: float
    remaining: float

# Audit Log
class AuditLogResponse(BaseModel):
    id: UUID
    project_id: UUID | None
    user_id: UUID | None
    action: str
    entity_type: str | None
    entity_id: str | None
    details: str | None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

# Message
class MessageResponse(BaseModel):
    id: UUID
    user_id: UUID
    content: str
    is_read: bool
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

# System Settings
class SystemSettingCreate(BaseModel):
    key: str
    value: str

class SystemSettingUpdate(BaseModel):
    value: str

class SystemSettingResponse(BaseModel):
    id: UUID
    key: str
    value: str | None
    model_config = ConfigDict(from_attributes=True)
