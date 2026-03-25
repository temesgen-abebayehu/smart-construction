from typing import Any, List
from uuid import UUID
from fastapi import APIRouter, Depends
from sqlalchemy import select

from app.api.dependencies import DbSession, get_current_active_user, get_current_admin_user
from app.models.user import User
from app.models.system import Message, AuditLog, SystemSetting
from app.schemas.system import (
    MessageResponse, AuditLogResponse,
    SystemSettingCreate, SystemSettingUpdate, SystemSettingResponse,
)

# ══════════════════════ Messages ══════════════════════
messages_router = APIRouter()

@messages_router.get("", response_model=List[MessageResponse])
async def list_messages(
    db: DbSession, current_user: User = Depends(get_current_active_user),
) -> Any:
    result = await db.execute(select(Message).where(Message.user_id == current_user.id).order_by(Message.created_at.desc()))
    return list(result.scalars().all())

@messages_router.patch("/{message_id}/read", response_model=MessageResponse)
async def mark_message_read(
    message_id: UUID, db: DbSession,
    _: User = Depends(get_current_active_user),
) -> Any:
    msg = await db.get(Message, message_id)
    if not msg:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Message not found")
    msg.is_read = True
    db.add(msg)
    await db.commit()
    await db.refresh(msg)
    return msg

# ══════════════════════ Audit Logs ══════════════════════
audit_router = APIRouter()

@audit_router.get("", response_model=List[AuditLogResponse])
async def list_audit_logs(
    db: DbSession, skip: int = 0, limit: int = 100,
    _: User = Depends(get_current_admin_user),
) -> Any:
    result = await db.execute(select(AuditLog).order_by(AuditLog.created_at.desc()).offset(skip).limit(limit))
    return list(result.scalars().all())

@audit_router.get("/projects/{project_id}", response_model=List[AuditLogResponse])
async def list_project_audit_logs(
    project_id: UUID, db: DbSession, skip: int = 0, limit: int = 100,
    _: User = Depends(get_current_active_user),
) -> Any:
    result = await db.execute(
        select(AuditLog).where(AuditLog.project_id == project_id)
        .order_by(AuditLog.created_at.desc()).offset(skip).limit(limit)
    )
    return list(result.scalars().all())

# ══════════════════════ System Settings ══════════════════════
settings_router = APIRouter()

@settings_router.get("", response_model=List[SystemSettingResponse])
async def list_settings(
    db: DbSession, _: User = Depends(get_current_admin_user),
) -> Any:
    result = await db.execute(select(SystemSetting))
    return list(result.scalars().all())

@settings_router.put("", response_model=SystemSettingResponse)
async def upsert_setting(
    *, db: DbSession, setting_in: SystemSettingCreate,
    _: User = Depends(get_current_admin_user),
) -> Any:
    result = await db.execute(select(SystemSetting).where(SystemSetting.key == setting_in.key))
    existing = result.scalars().first()
    if existing:
        existing.value = setting_in.value
        db.add(existing)
        await db.commit()
        await db.refresh(existing)
        return existing
    else:
        import uuid
        obj = SystemSetting(id=uuid.uuid4(), key=setting_in.key, value=setting_in.value)
        db.add(obj)
        await db.commit()
        await db.refresh(obj)
        return obj
