import logging
import os
import uuid as uuid_lib
from pathlib import Path
from typing import Any, List
from uuid import UUID
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy import select

import cloudinary
import cloudinary.uploader

from app.api.dependencies import DbSession, get_current_active_user
from app.core.config import settings
from app.models.user import User
from app.models.log import (
    DailyLog, Manpower, Material, Equipment, EquipmentIdle, DailyLogPhoto,
)
from app.models.task import TaskDependency, Task
from app.schemas.log import (
    DailyLogCreate, DailyLogResponse, DailyLogReject,
    ManpowerCreate, ManpowerResponse,
    MaterialCreate, MaterialResponse,
    EquipmentCreate, EquipmentResponse,
    EquipmentIdleCreate, EquipmentIdleResponse,
    DailyLogPhotoResponse,
)
from app.services.log import DailyLogService
from app.repositories.log import DailyLogRepository

logger = logging.getLogger(__name__)

# ── Router A: project-scoped routes  (prefix will be /projects) ──
project_logs_router = APIRouter()

# ── Router B: log-level / sub-entity routes  (prefix will be "") ──
logs_router = APIRouter()

log_repo = DailyLogRepository()


# ── Photo storage config ──
UPLOAD_ROOT = Path(__file__).resolve().parents[3] / "uploads"
DAILY_LOG_PHOTO_DIR = UPLOAD_ROOT / "daily-logs"
ALLOWED_PHOTO_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
MAX_PHOTO_BYTES = 10 * 1024 * 1024  # 10 MB
CLOUDINARY_FOLDER = "smart-construction/daily-logs"


def _cloudinary_configured() -> bool:
    return bool(
        settings.CLOUDINARY_CLOUD_NAME
        and settings.CLOUDINARY_API_KEY
        and settings.CLOUDINARY_API_SECRET
    )


def _configure_cloudinary() -> None:
    cloudinary.config(
        cloud_name=settings.CLOUDINARY_CLOUD_NAME,
        api_key=settings.CLOUDINARY_API_KEY,
        api_secret=settings.CLOUDINARY_API_SECRET,
        secure=True,
    )


async def _ensure_no_blocking_dependency(db, task_id: UUID) -> None:
    """Block daily-log creation against a task whose predecessors are not yet complete."""
    deps_res = await db.execute(
        select(TaskDependency).where(TaskDependency.task_id == task_id)
    )
    for dep in deps_res.scalars().all():
        blocker = await db.get(Task, dep.depends_on_task_id)
        if blocker and blocker.status != "completed":
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Cannot log against this task — dependency "
                    f"'{blocker.name}' is not completed yet."
                ),
            )


# ══════════════════════════════════════════════════════════════
# A) PROJECT-SCOPED: /projects/{project_id}/daily-logs
# ══════════════════════════════════════════════════════════════

@project_logs_router.get("/{project_id}/daily-logs", response_model=List[DailyLogResponse], summary="List daily logs")
async def list_daily_logs(
    project_id: UUID, db: DbSession, status: str = None,
    created_by: UUID = None,
    start_date: datetime = None, end_date: datetime = None,
    skip: int = 0, limit: int = 100,
    _: User = Depends(get_current_active_user),
) -> Any:
    query = select(DailyLog).where(DailyLog.project_id == project_id)
    if status:
        query = query.where(DailyLog.status == status)
    if created_by:
        query = query.where(DailyLog.created_by_id == created_by)
    if start_date:
        query = query.where(DailyLog.date >= start_date)
    if end_date:
        query = query.where(DailyLog.date <= end_date)
    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    return list(result.scalars().all())


# ── Task-scoped: /projects/{project_id}/tasks/{task_id}/daily-logs ──

@project_logs_router.post("/{project_id}/tasks/{task_id}/daily-logs", response_model=DailyLogResponse, status_code=201, summary="Create daily log for a task")
async def create_task_daily_log(
    *, db: DbSession, project_id: UUID, task_id: UUID, log_in: DailyLogCreate,
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """Create a daily log scoped to a specific task.
    Blocked when the task has any incomplete dependency."""
    task = await db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if task.project_id != project_id:
        raise HTTPException(status_code=400, detail="Task does not belong to this project")

    await _ensure_no_blocking_dependency(db, task_id)

    return await DailyLogService.create_log(
        db=db,
        project_id=project_id,
        task_id=task_id,
        user_id=current_user.id,
        notes=log_in.notes,
        weather=log_in.weather,
    )



# ══════════════════════════════════════════════════════════════
# B) LOG-LEVEL ROUTES: /daily-logs/{log_id}/...
# ══════════════════════════════════════════════════════════════

@logs_router.get("/daily-logs/{log_id}", response_model=DailyLogResponse, summary="Get daily log details")
async def get_daily_log(log_id: UUID, db: DbSession, _: User = Depends(get_current_active_user)) -> Any:
    log = await log_repo.get_by_id(db, log_id)
    if not log:
        raise HTTPException(status_code=404, detail="Daily log not found")
    return log


# ── 3-step Approval Workflow: submit → consultant-approve → pm-approve ──

async def _do_transition(db, log_id: UUID, action: str, current_user: User):
    log = await log_repo.get_by_id(db, log_id)
    if not log:
        raise HTTPException(status_code=404, detail="Daily log not found")
    from app.repositories.project import ProjectMemberRepository
    member = await ProjectMemberRepository().get_by_project_and_user(db, log.project_id, current_user.id)
    if not member:
        raise HTTPException(status_code=403, detail="Not a project member")
    return await DailyLogService.transition_log(db, log_id, action, member.role)


@logs_router.patch("/daily-logs/{log_id}/submit", response_model=DailyLogResponse, summary="Submit log (Site Engineer)")
async def submit_log(log_id: UUID, db: DbSession, current_user: User = Depends(get_current_active_user)) -> Any:
    return await _do_transition(db, log_id, "submit", current_user)

@logs_router.patch("/daily-logs/{log_id}/consultant-approve", response_model=DailyLogResponse, summary="Consultant approve")
async def consultant_approve_log(log_id: UUID, db: DbSession, current_user: User = Depends(get_current_active_user)) -> Any:
    return await _do_transition(db, log_id, "consultant-approve", current_user)

@logs_router.patch("/daily-logs/{log_id}/pm-approve", response_model=DailyLogResponse, summary="PM final approval")
async def pm_approve_log(log_id: UUID, db: DbSession, current_user: User = Depends(get_current_active_user)) -> Any:
    return await _do_transition(db, log_id, "pm-approve", current_user)

@logs_router.patch("/daily-logs/{log_id}/reject", response_model=DailyLogResponse, summary="Reject log (with note)")
async def reject_log(
    log_id: UUID, db: DbSession,
    body: DailyLogReject = None,
    _: User = Depends(get_current_active_user),
) -> Any:
    reason = body.rejection_reason if body else "No reason provided"
    return await DailyLogService.reject_log(db, log_id, rejection_reason=reason)


# ── Sub-Entities: Manpower ──

@logs_router.post("/daily-logs/{log_id}/manpower", response_model=ManpowerResponse, status_code=201, summary="Add manpower entry")
async def add_manpower(*, db: DbSession, log_id: UUID, manpower_in: ManpowerCreate, _: User = Depends(get_current_active_user)) -> Any:
    obj = Manpower(log_id=log_id, worker_type=manpower_in.worker_type, hours_worked=manpower_in.hours_worked, cost=manpower_in.cost)
    db.add(obj); await db.commit(); await db.refresh(obj)
    return obj

@logs_router.get("/daily-logs/{log_id}/manpower", response_model=List[ManpowerResponse], summary="List manpower entries")
async def list_manpower(log_id: UUID, db: DbSession, _: User = Depends(get_current_active_user)) -> Any:
    result = await db.execute(select(Manpower).where(Manpower.log_id == log_id))
    return list(result.scalars().all())


# ── Sub-Entities: Materials ──

@logs_router.post("/daily-logs/{log_id}/materials", response_model=MaterialResponse, status_code=201, summary="Add material entry")
async def add_material(*, db: DbSession, log_id: UUID, mat_in: MaterialCreate, _: User = Depends(get_current_active_user)) -> Any:
    obj = Material(log_id=log_id, name=mat_in.name, quantity=mat_in.quantity, unit=mat_in.unit, cost=mat_in.cost)
    db.add(obj); await db.commit(); await db.refresh(obj)
    return obj

@logs_router.get("/daily-logs/{log_id}/materials", response_model=List[MaterialResponse], summary="List material entries")
async def list_materials(log_id: UUID, db: DbSession, _: User = Depends(get_current_active_user)) -> Any:
    result = await db.execute(select(Material).where(Material.log_id == log_id))
    return list(result.scalars().all())


# ── Sub-Entities: Equipment ──

@logs_router.post("/daily-logs/{log_id}/equipment", response_model=EquipmentResponse, status_code=201, summary="Add equipment entry")
async def add_equipment(*, db: DbSession, log_id: UUID, equip_in: EquipmentCreate, _: User = Depends(get_current_active_user)) -> Any:
    obj = Equipment(log_id=log_id, name=equip_in.name, hours_used=equip_in.hours_used, cost=equip_in.cost)
    db.add(obj); await db.commit(); await db.refresh(obj)
    return obj

@logs_router.get("/daily-logs/{log_id}/equipment", response_model=List[EquipmentResponse], summary="List equipment entries")
async def list_equipment(log_id: UUID, db: DbSession, _: User = Depends(get_current_active_user)) -> Any:
    result = await db.execute(select(Equipment).where(Equipment.log_id == log_id))
    return list(result.scalars().all())


# ── Sub-Entities: Equipment Idle ──

@logs_router.post("/equipment/{equipment_id}/idle", response_model=EquipmentIdleResponse, status_code=201, summary="Record equipment idle time")
async def add_equipment_idle(*, db: DbSession, equipment_id: UUID, idle_in: EquipmentIdleCreate, _: User = Depends(get_current_active_user)) -> Any:
    obj = EquipmentIdle(equipment_id=equipment_id, reason=idle_in.reason, hours_idle=idle_in.hours_idle)
    db.add(obj); await db.commit(); await db.refresh(obj)
    return obj

@logs_router.get("/equipment/{equipment_id}/idle", response_model=List[EquipmentIdleResponse], summary="List equipment idle records")
async def list_equipment_idle(equipment_id: UUID, db: DbSession, _: User = Depends(get_current_active_user)) -> Any:
    result = await db.execute(select(EquipmentIdle).where(EquipmentIdle.equipment_id == equipment_id))
    return list(result.scalars().all())


# ── Sub-Entities: Photos ──

def _photo_extension(filename: str | None, content_type: str | None) -> str:
    if filename and "." in filename:
        ext = filename.rsplit(".", 1)[-1].lower()
        if 1 <= len(ext) <= 5 and ext.isalnum():
            return ext
    if content_type:
        m = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif"}
        if content_type in m:
            return m[content_type]
    return "bin"


@logs_router.post("/daily-logs/{log_id}/photos", response_model=DailyLogPhotoResponse, status_code=201, summary="Upload photo to daily log")
async def upload_daily_log_photo(
    log_id: UUID, db: DbSession,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """Attach a picture to a daily log. Stored on Cloudinary when configured,
    otherwise on local disk under backend/uploads/daily-logs/{log_id}/."""
    log = await log_repo.get_by_id(db, log_id)
    if not log:
        raise HTTPException(status_code=404, detail="Daily log not found")

    if file.content_type not in ALLOWED_PHOTO_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported content_type {file.content_type!r}. Allowed: {sorted(ALLOWED_PHOTO_TYPES)}",
        )

    contents = await file.read()
    if len(contents) > MAX_PHOTO_BYTES:
        raise HTTPException(status_code=413, detail=f"File too large (max {MAX_PHOTO_BYTES // (1024 * 1024)} MB)")

    photo_id = uuid_lib.uuid4()

    if _cloudinary_configured():
        _configure_cloudinary()
        public_id = f"{CLOUDINARY_FOLDER}/{log_id}/{photo_id}"
        try:
            result = cloudinary.uploader.upload(
                contents,
                public_id=public_id,
                resource_type="image",
                overwrite=False,
            )
        except Exception as e:
            logger.exception("Cloudinary upload failed for log_id=%s: %s", log_id, e)
            raise HTTPException(status_code=502, detail=f"Cloudinary upload failed: {e}")
        file_path = result["public_id"]
        url_path = result["secure_url"]
        logger.info("Uploaded daily-log photo to Cloudinary: log_id=%s public_id=%s", log_id, file_path)
    else:
        ext = _photo_extension(file.filename, file.content_type)
        target_dir = DAILY_LOG_PHOTO_DIR / str(log_id)
        target_dir.mkdir(parents=True, exist_ok=True)
        rel_path = f"daily-logs/{log_id}/{photo_id}.{ext}"
        abs_path = UPLOAD_ROOT / rel_path
        abs_path.write_bytes(contents)
        file_path = str(rel_path)
        url_path = f"/uploads/{rel_path}"
        logger.info("Uploaded daily-log photo locally: log_id=%s photo_id=%s size=%dB", log_id, photo_id, len(contents))

    photo = DailyLogPhoto(
        id=photo_id,
        log_id=log_id,
        file_path=file_path,
        url_path=url_path,
        original_filename=file.filename,
        content_type=file.content_type,
        size_bytes=len(contents),
        uploaded_by_id=current_user.id,
    )
    db.add(photo)
    await db.commit()
    await db.refresh(photo)
    return photo


@logs_router.get("/daily-logs/{log_id}/photos", response_model=List[DailyLogPhotoResponse], summary="List daily log photos")
async def list_daily_log_photos(
    log_id: UUID, db: DbSession,
    _: User = Depends(get_current_active_user),
) -> Any:
    result = await db.execute(select(DailyLogPhoto).where(DailyLogPhoto.log_id == log_id))
    return list(result.scalars().all())


@logs_router.delete("/daily-logs/{log_id}/photos/{photo_id}", status_code=204, summary="Delete daily log photo")
async def delete_daily_log_photo(
    log_id: UUID, photo_id: UUID, db: DbSession,
    _: User = Depends(get_current_active_user),
) -> None:
    result = await db.execute(
        select(DailyLogPhoto).where(DailyLogPhoto.id == photo_id, DailyLogPhoto.log_id == log_id)
    )
    photo = result.scalars().first()
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")

    if photo.url_path and photo.url_path.startswith("https://") and _cloudinary_configured():
        _configure_cloudinary()
        try:
            cloudinary.uploader.destroy(photo.file_path, resource_type="image")
        except Exception as e:
            logger.warning("Cloudinary destroy failed for public_id=%s: %s", photo.file_path, e)
    else:
        abs_path = UPLOAD_ROOT / photo.file_path
        try:
            if abs_path.exists():
                os.remove(abs_path)
        except OSError as e:
            logger.warning("Failed to remove local photo file %s: %s", abs_path, e)

    await db.delete(photo)
    await db.commit()
