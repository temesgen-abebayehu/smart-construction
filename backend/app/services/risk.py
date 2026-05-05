"""Shared risk + project-metrics helpers used by both /prediction and /reports."""
import logging
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.project import Project
from app.models.task import Task
from app.models.commons import TaskStatus
from app.services import ml_predictor
from app.services.feature_extractor import build_features

logger = logging.getLogger(__name__)


def days_between(d1: datetime | None, d2: datetime | None) -> int:
    if not d1 or not d2:
        return 0
    if d1.tzinfo is None:
        d1 = d1.replace(tzinfo=timezone.utc)
    if d2.tzinfo is None:
        d2 = d2.replace(tzinfo=timezone.utc)
    return max(0, (d2 - d1).days)


async def compute_metrics(db: AsyncSession, project: Project) -> dict:
    """Pull schedule/budget/task numbers used for both numeric outputs and the rule fallback."""
    tasks = list((await db.execute(select(Task).where(Task.project_id == project.id))).scalars().all())
    total_tasks = len(tasks)
    completed = sum(1 for t in tasks if t.status == TaskStatus.COMPLETED.value)
    in_progress = sum(1 for t in tasks if t.status == TaskStatus.IN_PROGRESS.value)
    task_completion_rate = (completed / total_tasks) if total_tasks > 0 else 0.0

    progress = (project.progress_percentage or 0.0) / 100.0
    budget_ratio = (project.budget_spent / project.total_budget) if project.total_budget else 0.0
    budget_efficiency = budget_ratio / progress if progress > 0 else budget_ratio

    planned_total_days = days_between(project.planned_start_date, project.planned_end_date)
    schedule_deviation = 0.0
    if planned_total_days > 0 and project.planned_start_date:
        elapsed = days_between(project.planned_start_date, datetime.now(timezone.utc))
        expected = min(elapsed / planned_total_days, 1.0)
        schedule_deviation = expected - progress

    delay_estimate_days = (
        int(schedule_deviation * planned_total_days)
        if planned_total_days > 0 and schedule_deviation > 0 else 0
    )

    budget_overrun_estimate = 0.0
    if budget_efficiency > 1.0 and progress > 0:
        projected = project.budget_spent / progress
        budget_overrun_estimate = max(0.0, projected - project.total_budget)

    return {
        "total_tasks": total_tasks,
        "completed_tasks": completed,
        "in_progress_tasks": in_progress,
        "task_completion_rate": task_completion_rate,
        "progress": progress,
        "budget_ratio": budget_ratio,
        "budget_efficiency": budget_efficiency,
        "schedule_deviation": schedule_deviation,
        "planned_total_days": planned_total_days,
        "delay_estimate_days": delay_estimate_days,
        "budget_overrun_estimate": budget_overrun_estimate,
    }


def rule_based_risk(budget_efficiency: float, schedule_deviation: float,
                    task_completion_rate: float) -> tuple[str, float]:
    """Fallback used when the ML model is unavailable. Returns (risk_level, confidence)."""
    score = 0.0
    score += min(max(budget_efficiency - 1.0, 0.0), 1.0) * 0.4
    score += max(schedule_deviation, 0.0) * 0.4
    score += (1.0 - task_completion_rate) * 0.2
    score = max(0.0, min(score, 1.0))
    if score >= 0.6:
        level = "high"
    elif score >= 0.3:
        level = "medium"
    else:
        level = "low"
    return level, 0.5


async def resolve_risk(db: AsyncSession, project: Project, m: dict) -> tuple[str, float, str, dict | None, dict]:
    """Returns (risk_level, confidence, source, ml_result, features)."""
    if ml_predictor.is_loaded():
        features = await build_features(db, project)
        ml_result = ml_predictor.predict(features)
        if ml_result:
            return ml_result["risk_level"], ml_result["confidence"], "ml", ml_result, features
        logger.warning("risk: ML predictor returned None, falling back to rule-based")
    else:
        logger.warning("risk: ML model not loaded — using rule-based fallback")

    level, confidence = rule_based_risk(
        m["budget_efficiency"], m["schedule_deviation"], m["task_completion_rate"]
    )
    return level, confidence, "rule-based", None, {}


def build_factors(project: Project, m: dict, ml_result: dict | None, features: dict) -> dict:
    factors = {
        "budget_ratio": round(m["budget_ratio"], 3),
        "budget_efficiency": round(m["budget_efficiency"], 3),
        "schedule_deviation": round(m["schedule_deviation"], 3),
        "progress_percentage": project.progress_percentage,
        "task_completion_rate": round(m["task_completion_rate"], 3),
        "total_tasks": m["total_tasks"],
        "completed_tasks": m["completed_tasks"],
        "in_progress_tasks": m["in_progress_tasks"],
        "planned_total_days": m["planned_total_days"],
        "delay_estimate_days": m["delay_estimate_days"],
    }
    if ml_result:
        factors["ml_class_index"] = ml_result["class_index"]
        factors["ml_probabilities"] = {k: round(v, 4) for k, v in ml_result["probabilities"].items()}
        factors["ml_features"] = {k: (round(v, 4) if isinstance(v, float) else v) for k, v in features.items()}
    return factors
