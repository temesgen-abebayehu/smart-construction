import uuid
from sqlalchemy import Column, String, Float, ForeignKey, DateTime, Text, Integer
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
    rejection_reason = Column(Text, nullable=True)

    # Relationships to isolated sub-entities
    manpower = relationship("Manpower", back_populates="log", cascade="all, delete-orphan")
    materials = relationship("Material", back_populates="log", cascade="all, delete-orphan")
    equipment = relationship("Equipment", back_populates="log", cascade="all, delete-orphan")
    photos = relationship("DailyLogPhoto", back_populates="log", cascade="all, delete-orphan")
    completed_activities = relationship("DailyLogActivity", back_populates="log", cascade="all, delete-orphan")

class Manpower(Base):
    """Tracks workers/hours/cost recorded against a daily log."""
    __tablename__ = "manpower"
    id = Column(SQL_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    log_id = Column(SQL_UUID(as_uuid=True), ForeignKey("daily_logs.id"), nullable=False)
    worker_type = Column(String(100))
    hours_worked = Column(Float, default=0.0)
    cost = Column(Float, default=0.0)
    log = relationship("DailyLog", back_populates="manpower")

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


class DailyLogPhoto(Base):
    """Picture attached to a daily log. Files live on local disk under
    backend/uploads/daily-logs/{log_id}/{photo_id}.{ext} and are served via
    FastAPI StaticFiles at /uploads/...
    """
    __tablename__ = "daily_log_photos"
    id = Column(SQL_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    log_id = Column(SQL_UUID(as_uuid=True), ForeignKey("daily_logs.id"), nullable=False)
    file_path = Column(String(500), nullable=False)         # disk path relative to UPLOAD_DIR
    url_path = Column(String(500), nullable=False)          # path the client hits, e.g. /uploads/daily-logs/.../foo.jpg
    original_filename = Column(String(255))
    content_type = Column(String(100))
    size_bytes = Column(Integer)
    uploaded_by_id = Column(SQL_UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    uploaded_at = Column(DateTime(timezone=True), default=utcnow)

    log = relationship("DailyLog", back_populates="photos")


class DailyLogActivity(Base):
    """Links a daily log to completed task activities.
    When a site engineer creates a log, they select which task activities
    were completed that day. This links log progress to task progress."""
    __tablename__ = "daily_log_activities"
    id = Column(SQL_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    log_id = Column(SQL_UUID(as_uuid=True), ForeignKey("daily_logs.id", ondelete="CASCADE"), nullable=False)
    task_activity_id = Column(SQL_UUID(as_uuid=True), ForeignKey("task_activities.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    log = relationship("DailyLog", back_populates="completed_activities")
