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
from app.models.task import Task, TaskActivity
from app.models.log import DailyLog, Manpower, Material, Equipment, EquipmentIdle, DailyLogActivity as DailyLogActivityModel
from app.models.project import Supplier
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
    regular_hours: float
    overtime_hours: float
    hourly_rate: float
    overtime_rate: float
    total_cost: float

class ManpowerReportSection(BaseModel):
    staff: list[ManpowerReportEntry]       # PM, SE, office_engineer
    technical: list[ManpowerReportEntry]    # surveyor, foreman, etc.
    labor: list[ManpowerReportEntry]        # mason, carpenter, unskilled, etc.

class MaterialReportEntry(BaseModel):
    name: str
    supplier_name: str | None
    supplier_role: str | None
    quantity: float
    unit: str
    unit_cost: float
    cost: float
    delivery_date: str | None

class EquipmentReportEntry(BaseModel):
    name: str
    quantity: int
    start_date: str | None
    hours_used: float
    unit_cost: float
    hours_idle: float
    idle_reasons: str
    cost: float

class TaskReportEntry(BaseModel):
    id: UUID
    name: str
    weight: float
    status: str
    progress_percentage: float
    activities_total: int
    activities_completed: int
    start_date: datetime | None = None
    end_date: datetime | None = None

class DailyLogReportEntry(BaseModel):
    date: str
    submitted_by: str
    status: str
    acts_done: int
    manpower_cost: float
    material_cost: float
    equipment_cost: float
    total_cost: float

class DailyLogSummary(BaseModel):
    total: int
    draft: int
    submitted: int
    consultant_approved: int
    pm_approved: int
    rejected: int
    total_cost: float

class ReportResponse(BaseModel):
    # Project info
    project_id: UUID
    project_name: str
    project_status: str
    project_location: str | None = None
    project_progress: float
    planned_start_date: datetime | None = None
    planned_end_date: datetime | None = None

    # Client
    client_name: str | None = None

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

    # Daily logs
    daily_logs: list[DailyLogReportEntry]
    daily_logs_summary: DailyLogSummary

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

    # Aggregate by worker_type - separate regular and overtime hours
    mp_agg: dict[str, dict] = defaultdict(lambda: {"workers": 0, "regular_hours": 0.0, "overtime_hours": 0.0, "cost": 0.0, "hourly_rate": 0.0, "overtime_rate": 0.0})
    for mp in manpower_rows:
        wt = mp.worker_type or "unspecified"
        mp_agg[wt]["workers"] += int(mp.number_of_workers or 1)
        mp_agg[wt]["regular_hours"] += float(mp.hours_worked or 0.0)
        mp_agg[wt]["overtime_hours"] += float(mp.overtime_hours or 0.0)
        mp_agg[wt]["cost"] += float(mp.cost or 0.0)
        # Store rates for averaging (weighted by workers)
        mp_agg[wt]["hourly_rate"] += float(mp.hourly_rate or 0.0) * int(mp.number_of_workers or 1)
        mp_agg[wt]["overtime_rate"] += float(mp.overtime_rate or 0.0) * int(mp.number_of_workers or 1)

    # Classify into staff / technical / labor
    staff_entries, tech_entries, labor_entries = [], [], []
    for wt, data in mp_agg.items():
        workers = data["workers"]
        reg_hrs = data["regular_hours"]
        ot_hrs = data["overtime_hours"]
        # Calculate average rates
        avg_hourly = round(data["hourly_rate"] / workers, 2) if workers > 0 else 0.0
        avg_overtime = round(data["overtime_rate"] / workers, 2) if workers > 0 else 0.0
        
        entry = ManpowerReportEntry(
            worker_type=wt,
            total_workers=workers,
            regular_hours=round(reg_hrs, 2),
            overtime_hours=round(ot_hrs, 2),
            hourly_rate=avg_hourly,
            overtime_rate=avg_overtime,
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

    # Fetch all unique supplier IDs from materials
    supplier_ids = list({m.supplier_id for m in material_rows if m.supplier_id})
    suppliers_map: dict[str, Supplier] = {}
    if supplier_ids:
        supp_res = await db.execute(select(Supplier).where(Supplier.id.in_(supplier_ids)))
        suppliers_map = {str(s.id): s for s in supp_res.scalars().all()}

    mat_agg: dict[str, dict] = defaultdict(lambda: {"qty": 0.0, "cost": 0.0, "unit": "", "supplier_id": None, "delivery_dates": []})
    for m in material_rows:
        key = m.name or "unspecified"
        mat_agg[key]["qty"] += float(m.quantity or 0.0)
        mat_agg[key]["cost"] += float(m.cost or 0.0)
        mat_agg[key]["unit"] = m.unit or mat_agg[key]["unit"]
        mat_agg[key]["supplier_id"] = mat_agg[key]["supplier_id"] or m.supplier_id
        if m.delivery_date:
            mat_agg[key]["delivery_dates"].append(m.delivery_date)

    materials = []
    for name, d in sorted(mat_agg.items(), key=lambda x: x[1]["cost"], reverse=True):
        supplier = suppliers_map.get(str(d["supplier_id"])) if d["supplier_id"] else None
        # Get earliest delivery date if any
        earliest_delivery = None
        if d["delivery_dates"]:
            earliest_delivery = min(d["delivery_dates"]).date().isoformat()
        
        materials.append(MaterialReportEntry(
            name=name,
            supplier_name=supplier.name if supplier else None,
            supplier_role=supplier.role if supplier else None,
            quantity=round(d["qty"], 2),
            unit=d["unit"],
            unit_cost=round(d["cost"] / d["qty"], 2) if d["qty"] > 0 else 0.0,
            cost=round(d["cost"], 2),
            delivery_date=earliest_delivery,
        ))

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

    log_date_map: dict[UUID, str] = {
        l.id: (l.date.date().isoformat() if l.date else "") for l in logs
    }
    idle_by_equip: dict[UUID, float] = defaultdict(float)
    idle_reasons_by_equip: dict[UUID, list[str]] = defaultdict(list)
    for i in idle_rows:
        idle_by_equip[i.equipment_id] += float(i.hours_idle or 0.0)
        if i.reason:
            idle_reasons_by_equip[i.equipment_id].append(i.reason)

    eq_agg: dict[str, dict] = defaultdict(
        lambda: {"quantity": 0, "hours": 0.0, "idle": 0.0, "cost": 0.0, "start_date": None, "reasons": []}
    )
    for e in equip_rows:
        name = e.name or "unspecified"
        eq_agg[name]["quantity"] += int(e.quantity or 1)
        eq_agg[name]["hours"] += float(e.hours_used or 0.0)
        # Add idle hours from both the equipment record and the idle table
        eq_agg[name]["idle"] += float(e.idle_hours or 0.0) + idle_by_equip.get(e.id, 0.0)
        eq_agg[name]["cost"] += float(e.cost or 0.0)
        # Collect idle reasons from both sources
        if e.idle_reason:
            eq_agg[name]["reasons"].append(e.idle_reason)
        eq_agg[name]["reasons"] += idle_reasons_by_equip.get(e.id, [])
        log_date = log_date_map.get(e.log_id)
        if log_date and (eq_agg[name]["start_date"] is None or log_date < eq_agg[name]["start_date"]):
            eq_agg[name]["start_date"] = log_date

    equipment_entries = [
        EquipmentReportEntry(
            name=name,
            quantity=d["quantity"],
            start_date=d["start_date"],
            hours_used=round(d["hours"], 2),
            unit_cost=round(d["cost"] / d["hours"], 2) if d["hours"] > 0 else 0.0,
            hours_idle=round(d["idle"], 2),
            idle_reasons="; ".join(dict.fromkeys(d["reasons"])) or "—",
            cost=round(d["cost"], 2),
        )
        for name, d in sorted(eq_agg.items(), key=lambda x: x[1]["hours"], reverse=True)
    ]

    # ── Tasks ──
    tasks_res = await db.execute(select(Task).where(Task.project_id == project_id))
    tasks = list(tasks_res.scalars().all())

    task_ids = [t.id for t in tasks]
    activities_res = await db.execute(
        select(TaskActivity).where(TaskActivity.task_id.in_(task_ids))
    ) if task_ids else None
    all_activities = list(activities_res.scalars().all()) if activities_res else []
    acts_by_task: dict[UUID, list[TaskActivity]] = defaultdict(list)
    for a in all_activities:
        acts_by_task[a.task_id].append(a)

    task_entries = [
        TaskReportEntry(
            id=t.id,
            name=t.name,
            weight=round(float(t.weight or 0), 2),
            status=t.status,
            progress_percentage=round(float(t.progress_percentage or 0), 2),
            activities_total=len(acts_by_task[t.id]),
            activities_completed=sum(1 for a in acts_by_task[t.id] if a.is_completed),
            budget=t.budget,
            start_date=t.start_date,
            end_date=t.end_date,
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

    # ── Client name ──
    first_client = project.clients[0] if project.clients else None
    client_name = first_client.name if first_client else None

    # ── Project progress (computed live from tasks) ──
    computed_progress = round(
        sum((t.progress_percentage or 0) / 100.0 * (t.weight or 0) for t in tasks), 2
    )

    # ── Daily logs aggregation ──
    mp_cost_by_log: dict = defaultdict(float)
    mat_cost_by_log: dict = defaultdict(float)
    eq_cost_by_log: dict = defaultdict(float)
    for mp in manpower_rows:
        mp_cost_by_log[mp.log_id] += float(mp.cost or 0)
    for m in material_rows:
        mat_cost_by_log[m.log_id] += float(m.cost or 0)
    for e in equip_rows:
        eq_cost_by_log[e.log_id] += float(e.cost or 0)

    creator_ids = list({l.created_by_id for l in logs if l.created_by_id})
    creators: dict = {}
    if creator_ids:
        u_res = await db.execute(select(User).where(User.id.in_(creator_ids)))
        creators = {u.id: (u.full_name or u.email) for u in u_res.scalars().all()}

    # Count completed activities per log
    acts_by_log: dict[UUID, int] = defaultdict(int)
    if log_ids:
        dla_res = await db.execute(
            select(DailyLogActivityModel).where(DailyLogActivityModel.log_id.in_(log_ids))
        )
        for dla in dla_res.scalars().all():
            acts_by_log[dla.log_id] += 1

    log_entries: list[DailyLogReportEntry] = []
    status_counts: dict = {"draft": 0, "submitted": 0, "consultant_approved": 0, "pm_approved": 0, "rejected": 0}
    total_log_cost = 0.0
    for lg in sorted(logs, key=lambda x: x.date or datetime.min):
        mp_c = round(mp_cost_by_log.get(lg.id, 0.0), 2)
        mat_c = round(mat_cost_by_log.get(lg.id, 0.0), 2)
        eq_c = round(eq_cost_by_log.get(lg.id, 0.0), 2)
        day_cost = round(mp_c + mat_c + eq_c, 2)
        total_log_cost += day_cost
        st = (lg.status or "draft").lower()
        if st in status_counts:
            status_counts[st] += 1
        log_entries.append(DailyLogReportEntry(
            date=lg.date.date().isoformat() if lg.date else "—",
            submitted_by=creators.get(lg.created_by_id, "—"),
            status=st.replace("_", " ").title(),
            acts_done=acts_by_log.get(lg.id, 0),
            manpower_cost=mp_c,
            material_cost=mat_c,
            equipment_cost=eq_c,
            total_cost=day_cost,
        ))

    daily_logs_summary = DailyLogSummary(
        total=len(logs),
        draft=status_counts["draft"],
        submitted=status_counts["submitted"],
        consultant_approved=status_counts["consultant_approved"],
        pm_approved=status_counts["pm_approved"],
        rejected=status_counts["rejected"],
        total_cost=round(total_log_cost, 2),
    )

    return ReportResponse(
        project_id=project.id,
        project_name=project.name,
        project_status=project.status,
        project_location=project.location,
        project_progress=computed_progress,
        planned_start_date=project.planned_start_date,
        planned_end_date=project.planned_end_date,
        client_name=client_name,
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
        daily_logs=log_entries,
        daily_logs_summary=daily_logs_summary,
        generated_at=datetime.now(timezone.utc),
    )
