from pydantic import BaseModel, EmailStr, ConfigDict
from uuid import UUID
from datetime import datetime
from typing import Optional
from app.models.commons import ProjectStatus, ProjectRole

# Client Schemas
class ClientBase(BaseModel):
    name: str
    tin_number: str | None = None  # Ethiopian Tax Identification Number
    address: str | None = None
    contact_email: str | None = None
    contact_phone: str | None = None

class ClientCreate(ClientBase):
    project_id: UUID

class ClientUpdate(BaseModel):
    name: str | None = None
    tin_number: str | None = None
    address: str | None = None
    contact_email: str | None = None
    contact_phone: str | None = None

class ClientResponse(ClientBase):
    id: UUID
    project_id: UUID
    model_config = ConfigDict(from_attributes=True)

# Supplier Schemas
class SupplierBase(BaseModel):
    name: str
    role: str | None = None  # Type of supply e.g. Cement, Steel, Aggregate, Formwork, Equipment rental
    tin_number: str | None = None
    address: str | None = None
    contact_email: str | None = None
    contact_phone: str | None = None

class SupplierCreate(SupplierBase):
    project_id: UUID

class SupplierUpdate(BaseModel):
    name: str | None = None
    role: str | None = None
    tin_number: str | None = None
    address: str | None = None
    contact_email: str | None = None
    contact_phone: str | None = None

class SupplierResponse(SupplierBase):
    id: UUID
    project_id: UUID
    model_config = ConfigDict(from_attributes=True)

# Project Member Schemas
class ProjectMemberBase(BaseModel):
    user_id: UUID
    role: ProjectRole

class ProjectMemberCreate(ProjectMemberBase):
    pass

class ProjectMemberUpdate(BaseModel):
    role: ProjectRole

class ProjectMemberResponse(ProjectMemberBase):
    id: UUID
    project_id: UUID
    model_config = ConfigDict(from_attributes=True)

class UserBasic(BaseModel):
    id: UUID
    full_name: str
    email: EmailStr
    phone_number: str | None = None
    model_config = ConfigDict(from_attributes=True)

class ProjectMemberWithUserResponse(BaseModel):
    id: UUID
    project_id: UUID
    user_id: UUID
    role: ProjectRole
    user: UserBasic
    model_config = ConfigDict(from_attributes=True)

# Project Schemas
class ProjectBase(BaseModel):
    name: str
    description: str | None = None
    location: str | None = None
    status: ProjectStatus = ProjectStatus.PLANNING
    total_budget: float
    planned_start_date: datetime | None = None
    planned_end_date: datetime | None = None

class ProjectCreate(ProjectBase):
    client_name: str
    client_email: EmailStr
    client_tin_number: str | None = None
    client_address: str | None = None
    client_phone: str | None = None

class ProjectUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    location: str | None = None
    status: ProjectStatus | None = None
    total_budget: float | None = None
    progress_percentage: float | None = None
    budget_spent: float | None = None
    client_id: UUID | None = None
    planned_start_date: datetime | None = None
    planned_end_date: datetime | None = None

class ProjectResponse(ProjectBase):
    id: UUID
    owner_id: UUID | None = None
    progress_percentage: float
    budget_spent: float
    client_id: UUID | None = None
    client: ClientResponse | None = None
    model_config = ConfigDict(from_attributes=True)

class ProjectDashboard(BaseModel):
    id: UUID
    name: str
    progress_percentage: float
    total_budget: float
    budget_spent: float
    task_summary: dict
    delay_risk_status: str

# Project Invitation Schemas
class ProjectInvitationBase(BaseModel):
    email: EmailStr
    role: ProjectRole

class ProjectInvitationCreate(ProjectInvitationBase):
    pass

class ProjectInvitationResponse(ProjectInvitationBase):
    id: UUID
    project_id: UUID
    token: str
    status: str  # "pending" = new user, "accepted" = existing user added directly
    email_sent_at: datetime | None = None
    model_config = ConfigDict(from_attributes=True)
    
class ProjectInvitationAccept(BaseModel):
    token: str
