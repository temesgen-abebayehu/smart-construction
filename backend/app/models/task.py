import uuid
from sqlalchemy import Column, String, Float, ForeignKey, DateTime, Integer
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID as SQL_UUID

from app.models.user import Base
from app.models.commons import TaskStatus

class Task(Base):
    __tablename__ = "tasks"
    id = Column(SQL_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    project_id = Column(SQL_UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False)
    name = Column(String(255), nullable=False)
    status = Column(String(50), default=TaskStatus.PENDING.value)
    progress_percentage = Column(Float, default=0.0)
    assigned_to = Column(SQL_UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    # Per-task budget (allocated cost). Project.total_budget remains the project-wide
    # ceiling; this column lets PMs track budget at the work-package level.
    budget = Column(Float, nullable=True, default=0.0)

    start_date = Column(DateTime(timezone=True))
    # duration_days is the source of truth for task length. end_date is kept as an
    # auto-synced column so existing reports/queries that filter on Task.end_date
    # continue to work. Whenever start_date or duration_days changes (or a
    # dependency cascade fires), end_date = start_date + duration_days.
    duration_days = Column(Integer, nullable=True)
    end_date = Column(DateTime(timezone=True))

    project = relationship("Project")
    assignee = relationship("User", foreign_keys=[assigned_to])

class TaskDependency(Base):
    __tablename__ = "task_dependencies"
    id = Column(SQL_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    task_id = Column(SQL_UUID(as_uuid=True), ForeignKey("tasks.id"), nullable=False)
    depends_on_task_id = Column(SQL_UUID(as_uuid=True), ForeignKey("tasks.id"), nullable=False)

    task = relationship("Task", foreign_keys=[task_id])
    depends_on = relationship("Task", foreign_keys=[depends_on_task_id])
