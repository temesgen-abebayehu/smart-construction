import logging
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.project import Project
from app.models.task import Task
from app.models.log import DailyLog, Manpower, Material, Equipment, EquipmentIdle
from app.services.weather import get_weather

logger = logging.getLogger(__name__)


async def _load_log_aggregates(
    db: AsyncSession, project_id: UUID
) -> tuple[list[Manpower], list[Material], list[Equipment], list[EquipmentIdle]]:
    """Pull all daily-log sub-entities (manpower, materials, equipment, idle) for a project."""
    logs_res = await db.execute(select(DailyLog).where(DailyLog.project_id == project_id))
    log_ids = [l.id for l in logs_res.scalars().all()]
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
        "feature_extractor: aggregated manpower=%d materials=%d equipment=%d idle=%d",
        len(manpower), len(materials), len(equipment), len(idle),
    )
    return manpower, materials, equipment, idle


def _compute_time_deviation(project: Project, task_progress: float) -> float | None:
    """0–1 ratio of how far behind expected progress; None if dates missing."""
    if not (project.planned_start_date and project.planned_end_date):
        return None
    start = project.planned_start_date
    end = project.planned_end_date
    if start.tzinfo is None:
        start = start.replace(tzinfo=timezone.utc)
    if end.tzinfo is None:
        end = end.replace(tzinfo=timezone.utc)
    planned_total = (end - start).days
    if planned_total <= 0:
        return None
    elapsed = max(0, (datetime.now(timezone.utc) - start).days)
    expected = min(elapsed / planned_total, 1.0)
    actual = task_progress / 100.0
    return max(0.0, expected - actual)


async def build_features(db: AsyncSession, project: Project) -> dict:
    """
    Build the 10-feature dict the ML model expects.
    
    Research-based approach for early-stage projects:
    - Planning phase (0 logs): Use industry baseline values for planning
    - Mobilization (1-4 logs): Blend actual + baseline values
    - Execution (5+ logs): Use actual values
    
    Industry baselines from construction risk management research:
    - Planning phase typically has LOW operational risk
    - Risk comes from planning quality, not operational metrics
    - Operational metrics should reflect "not yet applicable" state
    """
    logger.info("feature_extractor.build_features: project_id=%s location=%r", project.id, project.location)

    manpower, materials, equipment, idle = await _load_log_aggregates(db, project.id)
    
    # Count approved logs to determine project stage
    approved_logs_res = await db.execute(
        select(DailyLog).where(
            DailyLog.project_id == project.id,
            DailyLog.status == "pm_approved"
        )
    )
    approved_logs_count = len(list(approved_logs_res.scalars().all()))
    task_progress = float(project.progress_percentage or 0.0)
    
    logger.info(
        "feature_extractor: project stage - approved_logs=%d, progress=%.1f%%",
        approved_logs_count, task_progress
    )

    # Get weather data
    weather = await get_weather(project.location)
    temperature = weather["temperature"] if weather else None
    humidity = weather["humidity"] if weather else None

    # Calculate raw operational metrics
    material_usage_raw = sum((m.quantity or 0.0) for m in materials)
    worker_count_raw = len(manpower)
    hours_used = sum((e.hours_used or 0.0) for e in equipment)
    hours_idle = sum((i.hours_idle or 0.0) for i in idle)
    total_equip_hours = hours_used + hours_idle
    
    # Calculate financial metrics (always use actual)
    cost_deviation = None
    if project.total_budget and project.total_budget > 0:
        budget_pct = (float(project.budget_spent or 0.0) / float(project.total_budget)) * 100.0
        cost_deviation = budget_pct - task_progress

    time_deviation = _compute_time_deviation(project, task_progress)

    # Stage-based feature preparation
    if approved_logs_count == 0:
        # PLANNING PHASE: Project hasn't started operations
        # Use median values from model training data (imputer medians)
        # This tells the model "typical planning phase project"
        logger.info("feature_extractor: PLANNING phase - using training data medians")
        
        # Let imputer handle these (None = use training median)
        worker_count = None
        equipment_utilization_rate = None
        material_usage = None
        machinery_status = None
        material_shortage_alert = None
        
        # Override task_progress to reflect planning stage
        # Planning phase projects are typically 0-5% (setup/mobilization prep)
        if task_progress < 5.0:
            task_progress = max(1.0, task_progress)  # At least 1% to show project exists
            
    elif approved_logs_count < 5:
        # MOBILIZATION PHASE: Early operations, partial data
        logger.info("feature_extractor: MOBILIZATION phase - blending actual + baseline")
        
        # Use actual values if available, otherwise let imputer fill
        worker_count = float(worker_count_raw) if worker_count_raw > 0 else None
        equipment_utilization_rate = (
            (hours_used / total_equip_hours) * 100.0 if total_equip_hours > 0 else None
        )
        material_usage = material_usage_raw if material_usage_raw > 0 else None
        machinery_status = 1.0 if hours_used > 0 else None
        material_shortage_alert = None
        
    else:
        # EXECUTION PHASE: Active project, use actual data
        logger.info("feature_extractor: EXECUTION phase - using actual data")
        
        worker_count = float(worker_count_raw)
        equipment_utilization_rate = (
            (hours_used / total_equip_hours) * 100.0 if total_equip_hours > 0 else None
        )
        material_usage = material_usage_raw
        machinery_status = 1.0 if hours_used > 0 else 0.0
        material_shortage_alert = None  # Would need actual shortage detection logic

    features = {
        "temperature": temperature,
        "humidity": humidity,
        "material_usage": material_usage,
        "machinery_status": machinery_status,
        "worker_count": worker_count,
        "task_progress": task_progress,
        "cost_deviation": cost_deviation,
        "time_deviation": time_deviation,
        "equipment_utilization_rate": equipment_utilization_rate,
        "material_shortage_alert": material_shortage_alert,
    }
    
    logger.info("feature_extractor.build_features: final features=%s", features)
    logger.info("feature_extractor: None values will be filled by imputer with training medians")
    return features
