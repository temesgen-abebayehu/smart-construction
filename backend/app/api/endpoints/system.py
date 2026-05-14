from typing import Any, List
from uuid import UUID
from fastapi import APIRouter, Depends
from sqlalchemy import select, func

from app.api.dependencies import DbSession, get_current_active_user, get_current_admin_user
from app.models.user import User
from app.models.system import Message, AuditLog, SystemSetting, Announcement
from app.models.project import Project, Supplier
from app.schemas.system import (
    MessageResponse, AuditLogResponse,
    SystemSettingCreate, SystemSettingUpdate, SystemSettingResponse,
    SystemSettingsStructured, SystemSettingsUpdateRequest,
    AdminStatsResponse,
    AnnouncementCreate, AnnouncementUpdate, AnnouncementResponse,
)
from datetime import datetime, timedelta
from app.core.audit import log_audit

# ══════════════════════ Messages ══════════════════════
messages_router = APIRouter()

@messages_router.get("", response_model=List[MessageResponse], summary="List my messages")
async def list_messages(
    db: DbSession, current_user: User = Depends(get_current_active_user),
) -> Any:
    result = await db.execute(select(Message).where(Message.user_id == current_user.id).order_by(Message.created_at.desc()))
    return list(result.scalars().all())

@messages_router.patch("/{message_id}/read", response_model=MessageResponse, summary="Mark message as read")
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

@audit_router.get("", response_model=List[AuditLogResponse], summary="List audit logs (Admin)")
async def list_audit_logs(
    db: DbSession, skip: int = 0, limit: int = 100,
    _: User = Depends(get_current_admin_user),
) -> Any:
    result = await db.execute(select(AuditLog).order_by(AuditLog.created_at.desc()).offset(skip).limit(limit))
    return list(result.scalars().all())

@audit_router.get("/projects/{project_id}", response_model=List[AuditLogResponse], summary="List project audit logs")
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

@settings_router.get("", response_model=List[SystemSettingResponse], summary="List settings (Admin)")
async def list_settings(
    db: DbSession, _: User = Depends(get_current_admin_user),
) -> Any:
    result = await db.execute(select(SystemSetting))
    return list(result.scalars().all())

@settings_router.put("", response_model=SystemSettingResponse, summary="Create/update setting (Admin)")
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

@settings_router.get("/structured", response_model=SystemSettingsStructured, summary="Get structured settings (Admin)")
async def get_structured_settings(
    db: DbSession, _: User = Depends(get_current_admin_user),
) -> Any:
    """Get all system settings in a structured format"""
    result = await db.execute(select(SystemSetting))
    settings = {s.key: s.value for s in result.scalars().all()}
    
    return SystemSettingsStructured(
        working_hours_per_day=float(settings.get("working_hours_per_day", "8.0")),
        working_days_per_week=int(settings.get("working_days_per_week", "6")),
        overtime_multiplier=float(settings.get("overtime_multiplier", "1.5")),
        delay_risk_threshold_pct=float(settings.get("delay_risk_threshold_pct", "60.0")),
        budget_alert_threshold_pct=float(settings.get("budget_alert_threshold_pct", "80.0")),
        maintenance_mode=settings.get("maintenance_mode", "false").lower() == "true",
    )

@settings_router.put("/structured", response_model=SystemSettingsStructured, summary="Update structured settings (Admin)")
async def update_structured_settings(
    *, db: DbSession, settings_in: SystemSettingsUpdateRequest,
    current_user: User = Depends(get_current_admin_user),
) -> Any:
    """Update system settings in a structured format"""
    import uuid
    
    updates = settings_in.model_dump(exclude_unset=True)
    
    for key, value in updates.items():
        # Convert value to string for storage
        str_value = str(value).lower() if isinstance(value, bool) else str(value)
        
        result = await db.execute(select(SystemSetting).where(SystemSetting.key == key))
        existing = result.scalars().first()
        
        if existing:
            existing.value = str_value
            db.add(existing)
        else:
            obj = SystemSetting(id=uuid.uuid4(), key=key, value=str_value)
            db.add(obj)
    
    # Audit log
    await log_audit(
        db=db,
        user_id=current_user.id,
        action="UPDATE_SETTINGS",
        entity_type="system_settings",
        details=f"Updated settings: {', '.join(updates.keys())}"
    )
    
    await db.commit()
    
    # Return updated settings
    return await get_structured_settings(db, current_user)

# ══════════════════════ Admin Stats ══════════════════════
admin_router = APIRouter()

@admin_router.get("/stats", response_model=AdminStatsResponse, summary="Get platform stats (Admin)")
async def get_admin_stats(
    db: DbSession, _: User = Depends(get_current_admin_user),
) -> Any:
    """Get platform-wide statistics for admin dashboard"""
    
    # Total users
    total_users_result = await db.execute(select(func.count(User.id)))
    total_users = total_users_result.scalar() or 0
    
    # Active users
    active_users_result = await db.execute(select(func.count(User.id)).where(User.is_active == True))
    active_users = active_users_result.scalar() or 0
    
    # Total projects
    total_projects_result = await db.execute(select(func.count(Project.id)))
    total_projects = total_projects_result.scalar() or 0
    
    # Projects by status
    projects_result = await db.execute(select(Project.status, func.count(Project.id)).group_by(Project.status))
    projects_by_status = {status: count for status, count in projects_result.all()}
    
    # Total suppliers
    total_suppliers_result = await db.execute(select(func.count(Supplier.id)))
    total_suppliers = total_suppliers_result.scalar() or 0
    
    # Recent activity (last 7 days)
    seven_days_ago = datetime.utcnow() - timedelta(days=7)
    recent_activity_result = await db.execute(
        select(func.count(AuditLog.id)).where(AuditLog.created_at >= seven_days_ago)
    )
    recent_activity_count = recent_activity_result.scalar() or 0
    
    return AdminStatsResponse(
        total_users=total_users,
        active_users=active_users,
        total_projects=total_projects,
        projects_by_status=projects_by_status,
        total_suppliers=total_suppliers,
        recent_activity_count=recent_activity_count,
    )


# ══════════════════════ Announcements ══════════════════════
announcements_router = APIRouter()

@announcements_router.get("", response_model=List[AnnouncementResponse], summary="List active announcements")
async def list_announcements(
    db: DbSession, 
    skip: int = 0, 
    limit: int = 100,
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """List all active announcements (non-expired)"""
    now = datetime.utcnow()
    result = await db.execute(
        select(Announcement)
        .where(Announcement.is_active == True)
        .where((Announcement.expires_at == None) | (Announcement.expires_at > now))
        .order_by(Announcement.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    return list(result.scalars().all())

@announcements_router.get("/all", response_model=List[AnnouncementResponse], summary="List all announcements (Admin)")
async def list_all_announcements(
    db: DbSession, 
    skip: int = 0, 
    limit: int = 100,
    _: User = Depends(get_current_admin_user),
) -> Any:
    """List all announcements including inactive and expired. Admin only."""
    result = await db.execute(
        select(Announcement)
        .order_by(Announcement.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    return list(result.scalars().all())

@announcements_router.post("", response_model=AnnouncementResponse, summary="Create announcement (Admin)")
async def create_announcement(
    *, 
    db: DbSession, 
    announcement_in: AnnouncementCreate,
    current_user: User = Depends(get_current_admin_user),
) -> Any:
    """Create a new platform-wide announcement. Admin only."""
    import uuid
    obj = Announcement(
        id=uuid.uuid4(),
        title=announcement_in.title,
        content=announcement_in.content,
        priority=announcement_in.priority,
        expires_at=announcement_in.expires_at,
        created_by=current_user.id,
    )
    db.add(obj)
    
    # Audit log
    await log_audit(
        db=db,
        user_id=current_user.id,
        action="CREATE_ANNOUNCEMENT",
        entity_type="announcement",
        entity_id=str(obj.id),
        details=f"Created announcement: {announcement_in.title}"
    )
    
    await db.commit()
    await db.refresh(obj)
    return obj

@announcements_router.put("/{announcement_id}", response_model=AnnouncementResponse, summary="Update announcement (Admin)")
async def update_announcement(
    announcement_id: UUID,
    *,
    db: DbSession,
    announcement_in: AnnouncementUpdate,
    _: User = Depends(get_current_admin_user),
) -> Any:
    """Update an announcement. Admin only."""
    announcement = await db.get(Announcement, announcement_id)
    if not announcement:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Announcement not found")
    
    update_data = announcement_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(announcement, field, value)
    
    db.add(announcement)
    await db.commit()
    await db.refresh(announcement)
    return announcement

@announcements_router.delete("/{announcement_id}", summary="Delete announcement (Admin)")
async def delete_announcement(
    announcement_id: UUID,
    db: DbSession,
    current_user: User = Depends(get_current_admin_user),
) -> Any:
    """Delete an announcement. Admin only."""
    announcement = await db.get(Announcement, announcement_id)
    if not announcement:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Announcement not found")
    
    title = announcement.title
    await db.delete(announcement)
    
    # Audit log
    await log_audit(
        db=db,
        user_id=current_user.id,
        action="DELETE_ANNOUNCEMENT",
        entity_type="announcement",
        entity_id=str(announcement_id),
        details=f"Deleted announcement: {title}"
    )
    
    await db.commit()
    return {"message": "Announcement deleted successfully"}
