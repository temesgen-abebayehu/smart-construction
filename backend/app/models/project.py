import uuid
from sqlalchemy import Column, String, Float, ForeignKey, Text, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID as SQL_UUID

from app.models.user import Base
from app.models.commons import ProjectStatus

class Client(Base):
    __tablename__ = "clients"
    id = Column(SQL_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    name = Column(String(255), nullable=False)
    contact_email = Column(String(255))
    
    projects = relationship("Project", back_populates="client")

class Contractor(Base):
    __tablename__ = "contractors"
    id = Column(SQL_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    name = Column(String(255), nullable=False)

class Supplier(Base):
    __tablename__ = "suppliers"
    id = Column(SQL_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    name = Column(String(255), nullable=False)

class Project(Base):
    __tablename__ = "projects"
    id = Column(SQL_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    name = Column(String(255), nullable=False, index=True)
    description = Column(Text)
    location = Column(String(500))
    status = Column(String(50), default=ProjectStatus.PLANNING.value)
    
    planned_start_date = Column(DateTime(timezone=True))
    planned_end_date = Column(DateTime(timezone=True))
    
    progress_percentage = Column(Float, default=0.0)
    total_budget = Column(Float, nullable=False)
    budget_spent = Column(Float, default=0.0)
    
    client_id = Column(SQL_UUID(as_uuid=True), ForeignKey("clients.id"))
    client = relationship("Client", back_populates="projects")
    
    owner_id = Column(SQL_UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    owner = relationship("User", foreign_keys=[owner_id])
    
    members = relationship("ProjectMember", back_populates="project", cascade="all, delete-orphan")
    invitations = relationship("ProjectInvitation", back_populates="project", cascade="all, delete-orphan")

class ProjectMember(Base):
    __tablename__ = "project_members"
    id = Column(SQL_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    project_id = Column(SQL_UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False)
    user_id = Column(SQL_UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    role = Column(String(50), nullable=False) # Enforced via ProjectRole enum in app validation
    
    project = relationship("Project", back_populates="members")
    user = relationship("User")

class ProjectInvitation(Base):
    __tablename__ = "project_invitations"
    id = Column(SQL_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    project_id = Column(SQL_UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False)
    email = Column(String(255), nullable=False, index=True)
    role = Column(String(50), nullable=False)
    token = Column(String(255), unique=True, nullable=False, index=True)
    status = Column(String(50), default="pending") # pending, accepted, expired
    
    project = relationship("Project", back_populates="invitations")
