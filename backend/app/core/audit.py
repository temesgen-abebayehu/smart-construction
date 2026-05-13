"""Audit logging utilities for tracking system actions."""

from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.system import AuditLog
import uuid


async def log_audit(
    db: AsyncSession,
    user_id: UUID | None,
    action: str,
    entity_type: str | None = None,
    entity_id: str | None = None,
    project_id: UUID | None = None,
    details: str | None = None,
) -> None:
    """
    Create an audit log entry.
    
    Args:
        db: Database session
        user_id: ID of user performing the action
        action: Action name (e.g., "CREATE_PROJECT", "UPDATE_USER", "APPROVE_LOG")
        entity_type: Type of entity (e.g., "project", "user", "daily_log")
        entity_id: ID of the entity being acted upon
        project_id: Project context (if applicable)
        details: Additional details about the action
    """
    log = AuditLog(
        id=uuid.uuid4(),
        user_id=user_id,
        action=action,
        entity_type=entity_type,
        entity_id=str(entity_id) if entity_id else None,
        project_id=project_id,
        details=details,
    )
    db.add(log)
    # Note: Caller is responsible for committing the transaction
