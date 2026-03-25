from typing import Any, List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select

from app.api.dependencies import DbSession, get_current_active_user, get_project_member
from app.models.user import User
from app.models.project import ProjectMember
from app.models.log import DailyLog, Shift, Labor, Material, Equipment, EquipmentIdle
from app.models.commons import ProjectRole
from app.schemas.log import (
    DailyLogCreate, DailyLogResponse,
    ShiftCreate, ShiftResponse,
    LaborCreate, LaborResponse,
    MaterialCreate, MaterialResponse,
    EquipmentCreate, EquipmentResponse,
    EquipmentIdleCreate, EquipmentIdleResponse,
)
from app.services.log import DailyLogService
from app.repositories.log import DailyLogRepository

router = APIRouter()
log_repo = DailyLogRepository()

# ── Daily Logs ──

@router.post("/tasks/{task_id}/daily-logs", response_model=DailyLogResponse, status_code=201)
async def create_daily_log(
    *, db: DbSession, task_id: UUID, log_in: DailyLogCreate,
    current_user: User = Depends(get_current_active_user),
) -> Any:
    from app.models.task import Task
    task = await db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return await DailyLogService.create_log(db, task.project_id, task_id, current_user.id, log_in.notes)

@router.get("/{project_id}/daily-logs", response_model=List[DailyLogResponse])
async def list_daily_logs(
    project_id: UUID, db: DbSession, status: str = None,
    skip: int = 0, limit: int = 100,
    _: User = Depends(get_current_active_user),
) -> Any:
    return await log_repo.get_by_project(db, project_id, skip=skip, limit=limit, status=status)

@router.get("/daily-logs/{log_id}", response_model=DailyLogResponse)
async def get_daily_log(log_id: UUID, db: DbSession, _: User = Depends(get_current_active_user)) -> Any:
    log = await log_repo.get_by_id(db, log_id)
    if not log:
        raise HTTPException(status_code=404, detail="Daily log not found")
    return log

# ── Workflow Actions ──

async def _do_transition(db, log_id: UUID, action: str, current_user: User):
    log = await log_repo.get_by_id(db, log_id)
    if not log:
        raise HTTPException(status_code=404, detail="Daily log not found")
    from app.repositories.project import ProjectMemberRepository
    member_repo = ProjectMemberRepository()
    member = await member_repo.get_by_project_and_user(db, log.project_id, current_user.id)
    if not member:
        raise HTTPException(status_code=403, detail="Not a project member")
    return await DailyLogService.transition_log(db, log_id, action, member.role)

@router.patch("/daily-logs/{log_id}/submit", response_model=DailyLogResponse)
async def submit_log(log_id: UUID, db: DbSession, current_user: User = Depends(get_current_active_user)) -> Any:
    return await _do_transition(db, log_id, "submit", current_user)

@router.patch("/daily-logs/{log_id}/review", response_model=DailyLogResponse)
async def review_log(log_id: UUID, db: DbSession, current_user: User = Depends(get_current_active_user)) -> Any:
    return await _do_transition(db, log_id, "review", current_user)

@router.patch("/daily-logs/{log_id}/consultant-approve", response_model=DailyLogResponse)
async def consultant_approve_log(log_id: UUID, db: DbSession, current_user: User = Depends(get_current_active_user)) -> Any:
    return await _do_transition(db, log_id, "consultant-approve", current_user)

@router.patch("/daily-logs/{log_id}/pm-approve", response_model=DailyLogResponse)
async def pm_approve_log(log_id: UUID, db: DbSession, current_user: User = Depends(get_current_active_user)) -> Any:
    return await _do_transition(db, log_id, "pm-approve", current_user)

@router.patch("/daily-logs/{log_id}/reject", response_model=DailyLogResponse)
async def reject_log(log_id: UUID, db: DbSession, _: User = Depends(get_current_active_user)) -> Any:
    return await DailyLogService.reject_log(db, log_id)

# ── Sub-Entities: Shifts ──

@router.post("/daily-logs/{log_id}/shifts", response_model=ShiftResponse, status_code=201)
async def add_shift(*, db: DbSession, log_id: UUID, shift_in: ShiftCreate, _: User = Depends(get_current_active_user)) -> Any:
    obj = Shift(log_id=log_id, shift_type=shift_in.shift_type)
    db.add(obj); await db.commit(); await db.refresh(obj)
    return obj

@router.get("/daily-logs/{log_id}/shifts", response_model=List[ShiftResponse])
async def list_shifts(log_id: UUID, db: DbSession, _: User = Depends(get_current_active_user)) -> Any:
    result = await db.execute(select(Shift).where(Shift.log_id == log_id))
    return list(result.scalars().all())

# ── Sub-Entities: Labor ──

@router.post("/daily-logs/{log_id}/labor", response_model=LaborResponse, status_code=201)
async def add_labor(*, db: DbSession, log_id: UUID, labor_in: LaborCreate, _: User = Depends(get_current_active_user)) -> Any:
    obj = Labor(log_id=log_id, worker_type=labor_in.worker_type, hours_worked=labor_in.hours_worked, cost=labor_in.cost)
    db.add(obj); await db.commit(); await db.refresh(obj)
    return obj

@router.get("/daily-logs/{log_id}/labor", response_model=List[LaborResponse])
async def list_labor(log_id: UUID, db: DbSession, _: User = Depends(get_current_active_user)) -> Any:
    result = await db.execute(select(Labor).where(Labor.log_id == log_id))
    return list(result.scalars().all())

# ── Sub-Entities: Materials ──

@router.post("/daily-logs/{log_id}/materials", response_model=MaterialResponse, status_code=201)
async def add_material(*, db: DbSession, log_id: UUID, mat_in: MaterialCreate, _: User = Depends(get_current_active_user)) -> Any:
    obj = Material(log_id=log_id, name=mat_in.name, quantity=mat_in.quantity, unit=mat_in.unit, cost=mat_in.cost)
    db.add(obj); await db.commit(); await db.refresh(obj)
    return obj

@router.get("/daily-logs/{log_id}/materials", response_model=List[MaterialResponse])
async def list_materials(log_id: UUID, db: DbSession, _: User = Depends(get_current_active_user)) -> Any:
    result = await db.execute(select(Material).where(Material.log_id == log_id))
    return list(result.scalars().all())

# ── Sub-Entities: Equipment ──

@router.post("/daily-logs/{log_id}/equipment", response_model=EquipmentResponse, status_code=201)
async def add_equipment(*, db: DbSession, log_id: UUID, equip_in: EquipmentCreate, _: User = Depends(get_current_active_user)) -> Any:
    obj = Equipment(log_id=log_id, name=equip_in.name, hours_used=equip_in.hours_used, cost=equip_in.cost)
    db.add(obj); await db.commit(); await db.refresh(obj)
    return obj

@router.get("/daily-logs/{log_id}/equipment", response_model=List[EquipmentResponse])
async def list_equipment(log_id: UUID, db: DbSession, _: User = Depends(get_current_active_user)) -> Any:
    result = await db.execute(select(Equipment).where(Equipment.log_id == log_id))
    return list(result.scalars().all())

# ── Sub-Entities: Equipment Idle ──

@router.post("/equipment/{equipment_id}/idle", response_model=EquipmentIdleResponse, status_code=201)
async def add_equipment_idle(*, db: DbSession, equipment_id: UUID, idle_in: EquipmentIdleCreate, _: User = Depends(get_current_active_user)) -> Any:
    obj = EquipmentIdle(equipment_id=equipment_id, reason=idle_in.reason, hours_idle=idle_in.hours_idle)
    db.add(obj); await db.commit(); await db.refresh(obj)
    return obj

@router.get("/equipment/{equipment_id}/idle", response_model=List[EquipmentIdleResponse])
async def list_equipment_idle(equipment_id: UUID, db: DbSession, _: User = Depends(get_current_active_user)) -> Any:
    result = await db.execute(select(EquipmentIdle).where(EquipmentIdle.equipment_id == equipment_id))
    return list(result.scalars().all())
