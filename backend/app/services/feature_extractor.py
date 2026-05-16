import logging
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.project import Project
from app.models.log import DailyLog, Manpower, Material, Equipment, EquipmentIdle
from app.services.weather import get_weather

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Feature contract — must match feature_names.json shipped with the model.
# Units below are the units the model was trained on (see
# construction_ml_training.ipynb, Cell 2).
#
#   cost_deviation              percentage points  (-30..+50)
#   time_deviation              fraction           (-0.3..+0.5)
#   task_progress               %                  (0..100)
#   equipment_utilization_rate  %                  (0..100)
#   worker_count                avg workers/day    (0..80)
#   material_usage              avg units/log      (0..200)
#   temperature                 °C                 (15..40)
#   humidity                    %                  (20..80)
#   machinery_status            binary             (0/1)
# ---------------------------------------------------------------------------


async def _load_log_aggregates(
    db: AsyncSession, project_id: UUID
) -> tuple[list[DailyLog], list[Manpower], list[Material], list[Equipment], list[EquipmentIdle]]:
    """Pull all daily logs and their sub-entities (manpower, materials, equipment, idle)."""
    logs_res = await db.execute(select(DailyLog).where(DailyLog.project_id == project_id))
    logs = list(logs_res.scalars().all())
    log_ids = [l.id for l in logs]
    logger.info("feature_extractor: found %d daily logs", len(log_ids))

    manpower: list[Manpower] = []
    materials: list[Material] = []
    equipment: list[Equipment] = []
    idle: list[EquipmentIdle] = []

    if log_ids:
        manpower = list((await db.execute(select(Manpower).where(Manpower.log_id.in_(log_ids)))).scalars().all())
        materials = list((await db.execute(select(Material).where(Material.log_id.in_(log_ids)))).scalars().all())
        equipment = list((await db.execute(select(Equipment).where(Equipment.log_id.in_(log_ids)))).scalars().all())

    if equipment:
        equip_ids = [e.id for e in equipment]
        idle = list((await db.execute(select(EquipmentIdle).where(EquipmentIdle.equipment_id.in_(equip_ids)))).scalars().all())

    logger.info(
        "feature_extractor: aggregated logs=%d manpower=%d materials=%d equipment=%d idle=%d",
        len(logs), len(manpower), len(materials), len(equipment), len(idle),
    )
    return logs, manpower, materials, equipment, idle


def _compute_time_deviation(project: Project, task_progress: float) -> float:
    """Schedule deviation as a fraction: expected_progress_fraction - actual_progress_fraction.
    Range used during training: -0.3..+0.5 (positive = behind schedule).
    Returns 0.0 when planned dates are missing.
    """
    if not (project.planned_start_date and project.planned_end_date):
        return 0.0
    start = project.planned_start_date
    end = project.planned_end_date
    if start.tzinfo is None:
        start = start.replace(tzinfo=timezone.utc)
    if end.tzinfo is None:
        end = end.replace(tzinfo=timezone.utc)
    planned_total = (end - start).days
    if planned_total <= 0:
        return 0.0
    elapsed = (datetime.now(timezone.utc) - start).days
    expected = max(0.0, min(elapsed / planned_total, 1.0))
    actual = max(0.0, min(task_progress / 100.0, 1.0))
    # Allow negative (ahead of schedule) and positive (behind).
    return expected - actual


async def build_features(db: AsyncSession, project: Project) -> dict:
    """
    Build the 9-feature dict the ML model expects.

    All formulas here are aligned with the training notebook
    (construction_ml_training.ipynb). If you change a unit or formula
    here, you MUST retrain and ship a new feature_names.json.
    """
    logger.info("feature_extractor.build_features: project_id=%s location=%r", project.id, project.location)

    logs, manpower, materials, equipment, idle = await _load_log_aggregates(db, project.id)

    # Approved logs are the canonical denominator for "per-day average" metrics.
    approved_logs = [l for l in logs if str(getattr(l, "status", "")) == "pm_approved"]
    approved_count = len(approved_logs)
    approved_log_ids = {l.id for l in approved_logs}

    task_progress = float(project.progress_percentage or 0.0)

    # --- Weather (training range 15-40°C, 20-80%) -------------------------
    weather = await get_weather(project.location)
    temperature = weather["temperature"] if weather else 27.5  # imputer median fallback
    humidity = weather["humidity"] if weather else 50.0
    temperature = max(15.0, min(40.0, float(temperature)))
    humidity = max(20.0, min(80.0, float(humidity)))

    # --- worker_count: AVG workers per day across approved logs -----------
    # Training expects an average headcount, NOT a row count of manpower
    # entries. Use Manpower.number_of_workers and group by log.
    worker_count = 0.0
    if approved_count > 0:
        approved_manpower = [m for m in manpower if m.log_id in approved_log_ids]
        total_workers = sum(int(m.number_of_workers or 0) for m in approved_manpower)
        worker_count = total_workers / approved_count
    worker_count = max(0.0, min(80.0, worker_count))

    # --- material_usage: AVG quantity per approved log --------------------
    # Training expects a per-day rate, not a cumulative sum. This keeps the
    # value bounded regardless of how long the project has been running.
    material_usage = 0.0
    if approved_count > 0:
        approved_materials = [m for m in materials if m.log_id in approved_log_ids]
        total_qty = sum(float(m.quantity or 0.0) for m in approved_materials)
        material_usage = total_qty / approved_count
    material_usage = max(0.0, min(200.0, material_usage))

    # --- equipment_utilization_rate: 0..100 (no longer clamped to 50) -----
    hours_used = sum((e.hours_used or 0.0) for e in equipment)
    hours_idle = sum((i.hours_idle or 0.0) for i in idle)
    total_equip_hours = hours_used + hours_idle
    if total_equip_hours > 0:
        equipment_utilization_rate = (hours_used / total_equip_hours) * 100.0
    else:
        # No equipment recorded → fall back to imputer median (75 in training).
        equipment_utilization_rate = 75.0
    equipment_utilization_rate = max(0.0, min(100.0, equipment_utilization_rate))

    # --- machinery_status: binary -----------------------------------------
    machinery_status = 1 if hours_used > 0 else 0

    # --- cost_deviation: percentage points (budget% - progress%) ----------
    # Training range: -30..+50. Positive = spending faster than progressing.
    cost_deviation = 0.0
    if project.total_budget and project.total_budget > 0:
        budget_pct = (float(project.budget_spent or 0.0) / float(project.total_budget)) * 100.0
        cost_deviation = budget_pct - task_progress
    cost_deviation = max(-30.0, min(50.0, cost_deviation))

    # --- time_deviation: fraction -----------------------------------------
    # Training range: -0.3..+0.5. Positive = behind schedule.
    time_deviation = _compute_time_deviation(project, task_progress)
    time_deviation = max(-0.3, min(0.5, time_deviation))

    features = {
        "cost_deviation": cost_deviation,
        "time_deviation": time_deviation,
        "task_progress": task_progress,
        "equipment_utilization_rate": equipment_utilization_rate,
        "worker_count": worker_count,
        "material_usage": material_usage,
        "temperature": temperature,
        "humidity": humidity,
        "machinery_status": float(machinery_status),
    }

    logger.info(
        "feature_extractor.build_features: approved_logs=%d features=%s",
        approved_count, features,
    )
    return features
