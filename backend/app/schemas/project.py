from pydantic import BaseModel, EmailStr, ConfigDict
from uuid import UUID
from datetime import datetime
from typing import Optional
from app.models.commons import ProjectStatus, ProjectRole

# Client Schemas
class ClientBase(BaseModel):
    name: str
    contact_email: EmailStr | None = None

class ClientCreate(ClientBase):
    pass

class ClientUpdate(BaseModel):
    name: str | None = None
    contact_email: EmailStr | None = None

class ClientResponse(ClientBase):
    id: UUID
    model_config = ConfigDict(from_attributes=True)

# Contractor Schemas
class ContractorBase(BaseModel):
    name: str

class ContractorCreate(ContractorBase):
    pass

class ContractorUpdate(BaseModel):
    name: str | None = None

class ContractorResponse(ContractorBase):
    id: UUID
    model_config = ConfigDict(from_attributes=True)

# Supplier Schemas
class SupplierBase(BaseModel):
    name: str

class SupplierCreate(SupplierBase):
    pass

class SupplierUpdate(BaseModel):
    name: str | None = None

class SupplierResponse(SupplierBase):
    id: UUID
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
    client_id: UUID | None = None

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
    status: str
    model_config = ConfigDict(from_attributes=True)
    
class ProjectInvitationAccept(BaseModel):
    token: str
