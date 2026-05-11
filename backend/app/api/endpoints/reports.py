import logging
from collections import defaultdict
from datetime import date, datetime, timezone
from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import DbSession, get_current_active_user, require_project_role
from app.models.commons import ProjectRole
from app.models.user import User
from app.models.project import Project
from app.models.task import Task
from app.models.log import DailyLog, Manpower, Material, Equipment, EquipmentIdle
from app.repositories.project import ProjectRepository

logger = logging.getLogger(__name__)
router = APIRouter()
project_repo = ProjectRepository()

REPORT_ROLES = [
    ProjectRole.OWNER,
    ProjectRole.PROJECT_MANAGER,
    ProjectRole.OFFICE_ENGINEER,
    ProjectRole.CONSULTANT,
]


# ── Response schemas ──

class ManpowerReportEntry(BaseModel):
    worker_type: str
    total_workers: int
    total_hours: float
    total_cost: float

class ManpowerReportSection(BaseModel):
    staff: list[ManpowerReportEntry]       # PM, SE, office_engineer
    technical: list[ManpowerReportEntry]    # surveyor, foreman, etc.
    labor: list[ManpowerReportEntry]        # mason, carpenter, unskilled, etc.

class MaterialReportEntry(BaseModel):
    name: str
    quantity: float
    unit: str
    cost: float

class EquipmentReportEntry(BaseModel):
    name: str
    hours_used: float
    hours_idle: float
    cost: float

class TaskReportEntry(BaseModel):
    id: UUID
    name: str
    status: str
    progress_percentage: float
    budget: float | None = None

class ReportResponse(BaseModel):
    # Project info
    project_id: UUID
    project_name: str
    project_status: str
    project_location: str | None = None
    project_progress: float
    planned_start_date: datetime | None = None
    planned_end_date: datetime | None = None

    # Contractor
    contractor_name: str | None = None

    # Report date range
    start_date: date
    end_date: date
    total_days: int

    # Manpower breakdown
    manpower: ManpowerReportSection

    # Materials
    materials: list[MaterialReportEntry]

    # Equipment
    equipment: list[EquipmentReportEntry]

    # Tasks summary
    tasks: list[TaskReportEntry]
    tasks_total: int
    tasks_completed: int
    tasks_in_progress: int
    tasks_pending: int

    # Budget
    total_budget: float
    used_budget: float
    remaining_budget: float
    budget_spent_in_period: float

    generated_at: datetime


# ── Manpower classification ──

STAFF_TYPES = {"project_manager", "site_engineer", "office_engineer", "pm", "se"}
TECHNICAL_TYPES = {"surveyor", "foreman", "supervisor", "inspector", "technician"}
# Everything else falls into "labor"


def _classify_manpower(worker_type: str) -> str:
    wt = (worker_type or "").lower().strip()
    if wt in STAFF_TYPES:
        return "staff"
    if wt in TECHNICAL_TYPES:
        return "technical"
    return "labor"


@router.get(
    "/{project_id}/reports/generate",
    response_model=ReportResponse,
    summary="Generate a project report for a date range",
    dependencies=[Depends(require_project_role(REPORT_ROLES))],
)
async def generate_report(
    project_id: UUID,
    db: DbSession,
    start_date: Annotated[date, Query(description="Report start date YYYY-MM-DD")],
    end_date: Annotated[date, Query(description="Report end date YYYY-MM-DD")],
    current_user: User = Depends(get_current_active_user),
) -> Any:
    """Generate a project report aggregating data between start_date and end_date.
    Can be 1 day, 20 days, or 100 days — the backend aggregates accordingly.
    Returns structured JSON; the frontend handles styling and formatting."""

    project = await project_repo.get_by_id(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if end_date < start_date:
        raise HTTPException(status_code=400, detail="end_date must be >= start_date")

    start_dt = datetime.combine(start_date, datetime.min.time(), tzinfo=timezone.utc)
    end_dt = datetime.combine(end_date, datetime.max.time(), tzinfo=timezone.utc)
    total_days = (end_date - start_date).days + 1

    # ── Fetch daily logs in the date range ──
    logs_res = await db.execute(
        select(DailyLog)
        .where(DailyLog.project_id == project_id)
        .where(DailyLog.date >= start_dt)
        .where(DailyLog.date <= end_dt)
    )
    logs = list(logs_res.scalars().all())
    log_ids = [l.id for l in logs]

    # ── Manpower aggregation ──
    manpower_rows: list[Manpower] = []
    if log_ids:
        mp_res = await db.execute(select(Manpower).where(Manpower.log_id.in_(log_ids)))
        manpower_rows = list(mp_res.scalars().all())

    # Aggregate by worker_type
    mp_agg: dict[str, dict] = defaultdict(lambda: {"count": 0, "hours": 0.0, "cost": 0.0})
    for mp in manpower_rows:
        wt = mp.worker_type or "unspecified"
        mp_agg[wt]["count"] += 1
        mp_agg[wt]["hours"] += float(mp.hours_worked or 0.0)
        mp_agg[wt]["cost"] += float(mp.cost or 0.0)

    # Classify into staff / technical / labor
    staff_entries, tech_entries, labor_entries = [], [], []
    for wt, data in mp_agg.items():
        entry = ManpowerReportEntry(
            worker_type=wt,
            total_workers=data["count"],
            total_hours=round(data["hours"], 2),
            total_cost=round(data["cost"], 2),
        )
        category = _classify_manpower(wt)
        if category == "staff":
            staff_entries.append(entry)
        elif category == "technical":
            tech_entries.append(entry)
        else:
            labor_entries.append(entry)

    # ── Materials aggregation ──
    material_rows: list[Material] = []
    if log_ids:
        mat_res = await db.execute(select(Material).where(Material.log_id.in_(log_ids)))
        material_rows = list(mat_res.scalars().all())

    mat_agg: dict[str, dict] = defaultdict(lambda: {"qty": 0.0, "cost": 0.0, "unit": ""})
    for m in material_rows:
        key = m.name or "unspecified"
        mat_agg[key]["qty"] += float(m.quantity or 0.0)
        mat_agg[key]["cost"] += float(m.cost or 0.0)
        mat_agg[key]["unit"] = m.unit or mat_agg[key]["unit"]

    materials = [
        MaterialReportEntry(
            name=name, quantity=round(d["qty"], 2), unit=d["unit"], cost=round(d["cost"], 2)
        )
        for name, d in sorted(mat_agg.items(), key=lambda x: x[1]["cost"], reverse=True)
    ]

    # ── Equipment aggregation ──
    equip_rows: list[Equipment] = []
    if log_ids:
        eq_res = await db.execute(select(Equipment).where(Equipment.log_id.in_(log_ids)))
        equip_rows = list(eq_res.scalars().all())

    equip_ids = [e.id for e in equip_rows]
    idle_rows: list[EquipmentIdle] = []
    if equip_ids:
        idle_res = await db.execute(select(EquipmentIdle).where(EquipmentIdle.equipment_id.in_(equip_ids)))
        idle_rows = list(idle_res.scalars().all())

    idle_by_equip: dict[UUID, float] = defaultdict(float)
    for i in idle_rows:
        idle_by_equip[i.equipment_id] += float(i.hours_idle or 0.0)

    eq_agg: dict[str, dict] = defaultdict(lambda: {"hours": 0.0, "idle": 0.0, "cost": 0.0})
    for e in equip_rows:
        name = e.name or "unspecified"
        eq_agg[name]["hours"] += float(e.hours_used or 0.0)
        eq_agg[name]["idle"] += idle_by_equip.get(e.id, 0.0)
        eq_agg[name]["cost"] += float(e.cost or 0.0)

    equipment_entries = [
        EquipmentReportEntry(
            name=name,
            hours_used=round(d["hours"], 2),
            hours_idle=round(d["idle"], 2),
            cost=round(d["cost"], 2),
        )
        for name, d in sorted(eq_agg.items(), key=lambda x: x[1]["hours"], reverse=True)
    ]

    # ── Tasks ──
    tasks_res = await db.execute(select(Task).where(Task.project_id == project_id))
    tasks = list(tasks_res.scalars().all())

    task_entries = [
        TaskReportEntry(
            id=t.id, name=t.name, status=t.status,
            progress_percentage=t.progress_percentage, budget=t.budget,
        )
        for t in tasks
    ]
    completed = sum(1 for t in tasks if t.status == "completed")
    in_progress = sum(1 for t in tasks if t.status == "in_progress")
    pending = sum(1 for t in tasks if t.status == "pending")

    # ── Budget spent in this period ──
    period_cost = (
        sum(float(mp.cost or 0) for mp in manpower_rows)
        + sum(float(m.cost or 0) for m in material_rows)
        + sum(float(e.cost or 0) for e in equip_rows)
    )

    # ── Contractor name ──
    contractor_name = None
    if project.client:
        contractor_name = project.client.name

    return ReportResponse(
        project_id=project.id,
        project_name=project.name,
        project_status=project.status,
        project_location=project.location,
        project_progress=round(float(project.progress_percentage or 0), 2),
        planned_start_date=project.planned_start_date,
        planned_end_date=project.planned_end_date,
        contractor_name=contractor_name,
        start_date=start_date,
        end_date=end_date,
        total_days=total_days,
        manpower=ManpowerReportSection(
            staff=staff_entries,
            technical=tech_entries,
            labor=labor_entries,
        ),
        materials=materials,
        equipment=equipment_entries,
        tasks=task_entries,
        tasks_total=len(tasks),
        tasks_completed=completed,
        tasks_in_progress=in_progress,
        tasks_pending=pending,
        total_budget=float(project.total_budget or 0),
        used_budget=float(project.budget_spent or 0),
        remaining_budget=float((project.total_budget or 0) - (project.budget_spent or 0)),
        budget_spent_in_period=round(period_cost, 2),
        generated_at=datetime.now(timezone.utc),
    )
