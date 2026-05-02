from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.project import Project
from app.models.task import Task
from app.models.log import DailyLog, Labor, Material, Equipment, EquipmentIdle
from app.services.weather import get_weather


async def build_features(db: AsyncSession, project: Project) -> dict:
    """
    Build the 10-feature dict the ML model expects.
    Missing values are left as None — the SimpleImputer fills them with training medians.

    Feature scales (matched to training data):
      temperature, humidity            — °C, %        (from weather API)
      material_usage                   — absolute units
      machinery_status                 — binary 0/1
      worker_count                     — absolute count
      task_progress                    — 0–100
      cost_deviation                   — percent (budget% − progress%)
      time_deviation                   — 0–1 ratio (how far behind schedule)
      equipment_utilization_rate       — 0–100 percent
      material_shortage_alert          — binary 0/1
    """
    project_id = project.id

    # ── Pull related data ──
    logs_res = await db.execute(select(DailyLog).where(DailyLog.project_id == project_id))
    logs = list(logs_res.scalars().all())
    log_ids = [l.id for l in logs]

    labor: list[Labor] = []
    materials: list[Material] = []
    equipment: list[Equipment] = []
    idle: list[EquipmentIdle] = []

    if log_ids:
        labor = list((await db.execute(select(Labor).where(Labor.log_id.in_(log_ids)))).scalars().all())
        materials = list((await db.execute(select(Material).where(Material.log_id.in_(log_ids)))).scalars().all())
        equipment = list((await db.execute(select(Equipment).where(Equipment.log_id.in_(log_ids)))).scalars().all())

    if equipment:
        equip_ids = [e.id for e in equipment]
        idle = list((await db.execute(select(EquipmentIdle).where(EquipmentIdle.equipment_id.in_(equip_ids)))).scalars().all())

    # ── Weather ──
    weather = await get_weather(project.location)
    temperature = weather["temperature"] if weather else None
    humidity = weather["humidity"] if weather else None

    # ── Aggregate ──
    material_usage = sum((m.quantity or 0.0) for m in materials)
    worker_count = len(labor)  # number of labor entries logged

    hours_used = sum((e.hours_used or 0.0) for e in equipment)
    hours_idle = sum((i.hours_idle or 0.0) for i in idle)
    total_equip_hours = hours_used + hours_idle

    machinery_status = 1.0 if hours_used > 0 else 0.0
    equipment_utilization_rate = (
        (hours_used / total_equip_hours) * 100.0 if total_equip_hours > 0 else None
    )

    task_progress = float(project.progress_percentage or 0.0)  # already 0–100

    # cost_deviation — budget burn % minus progress %
    cost_deviation = None
    if project.total_budget and project.total_budget > 0:
        budget_pct = (float(project.budget_spent or 0.0) / float(project.total_budget)) * 100.0
        cost_deviation = budget_pct - task_progress

    # time_deviation — 0–1 ratio of how far behind expected progress
    time_deviation = None
    if project.planned_start_date and project.planned_end_date:
        start = project.planned_start_date
        end = project.planned_end_date
        if start.tzinfo is None:
            start = start.replace(tzinfo=timezone.utc)
        if end.tzinfo is None:
            end = end.replace(tzinfo=timezone.utc)
        planned_total = (end - start).days
        if planned_total > 0:
            elapsed = max(0, (datetime.now(timezone.utc) - start).days)
            expected = min(elapsed / planned_total, 1.0)
            actual = task_progress / 100.0
            time_deviation = max(0.0, expected - actual)

    # No explicit shortage flag in the schema — leave to imputer (median is 0).
    material_shortage_alert = None

    return {
        "temperature": temperature,
        "humidity": humidity,
        "material_usage": material_usage,
        "machinery_status": machinery_status,
        "worker_count": float(worker_count),
        "task_progress": task_progress,
        "cost_deviation": cost_deviation,
        "time_deviation": time_deviation,
        "equipment_utilization_rate": equipment_utilization_rate,
        "material_shortage_alert": material_shortage_alert,
    }
