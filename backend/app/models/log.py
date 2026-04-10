import uuid
from sqlalchemy import Column, String, Float, ForeignKey, DateTime, Text
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID as SQL_UUID

from app.models.user import Base, utcnow
from app.models.commons import LogStatus

class DailyLog(Base):
    __tablename__ = "daily_logs"
    id = Column(SQL_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    project_id = Column(SQL_UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False)
    task_id = Column(SQL_UUID(as_uuid=True), ForeignKey("tasks.id"), nullable=True)  # optional—set when created via /tasks/{task_id}/daily-logs
    created_by_id = Column(SQL_UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    
    date = Column(DateTime(timezone=True), default=utcnow)
    status = Column(String(50), default=LogStatus.DRAFT.value)
    notes = Column(Text)
    weather = Column(String(100))
    
    # Relationships to isolated sub-entities
    shifts = relationship("Shift", back_populates="log", cascade="all, delete-orphan")
    labor = relationship("Labor", back_populates="log", cascade="all, delete-orphan")
    materials = relationship("Material", back_populates="log", cascade="all, delete-orphan")
    equipment = relationship("Equipment", back_populates="log", cascade="all, delete-orphan")

class Shift(Base):
    __tablename__ = "shifts"
    id = Column(SQL_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    log_id = Column(SQL_UUID(as_uuid=True), ForeignKey("daily_logs.id"), nullable=False)
    shift_type = Column(String(50)) # e.g. Day, Night
    log = relationship("DailyLog", back_populates="shifts")

class Labor(Base):
    __tablename__ = "labor"
    id = Column(SQL_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    log_id = Column(SQL_UUID(as_uuid=True), ForeignKey("daily_logs.id"), nullable=False)
    worker_type = Column(String(100))
    hours_worked = Column(Float, default=0.0)
    cost = Column(Float, default=0.0)
    log = relationship("DailyLog", back_populates="labor")

class Material(Base):
    __tablename__ = "materials"
    id = Column(SQL_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    log_id = Column(SQL_UUID(as_uuid=True), ForeignKey("daily_logs.id"), nullable=False)
    name = Column(String(255))
    quantity = Column(Float, default=0.0)
    unit = Column(String(50))
    cost = Column(Float, default=0.0)
    log = relationship("DailyLog", back_populates="materials")

class Equipment(Base):
    __tablename__ = "equipment"
    id = Column(SQL_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    log_id = Column(SQL_UUID(as_uuid=True), ForeignKey("daily_logs.id"), nullable=False)
    name = Column(String(255))
    hours_used = Column(Float, default=0.0)
    cost = Column(Float, default=0.0)
    log = relationship("DailyLog", back_populates="equipment")

class EquipmentIdle(Base):
    __tablename__ = "equipment_idle"
    id = Column(SQL_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    equipment_id = Column(SQL_UUID(as_uuid=True), ForeignKey("equipment.id"), nullable=False)
    reason = Column(Text)
    hours_idle = Column(Float, default=0.0)
