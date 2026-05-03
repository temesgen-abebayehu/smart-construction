import logging
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select

from app.api.dependencies import DbSession, get_current_active_user
from app.models.user import User
from app.models.task import Task
from app.models.commons import TaskStatus
from app.repositories.project import ProjectRepository
from app.services import ml_predictor
from app.services.feature_extractor import build_features

logger = logging.getLogger(__name__)
router = APIRouter()
project_repo = ProjectRepository()


class RiskPredictionResponse(BaseModel):
    project_id: UUID
    risk_level: str                   # "low" | "medium" | "high" | "critical"
    delay_estimate_days: int
    budget_overrun_estimate: float
    confidence_score: float           # 0.0 – 1.0
    source: str                       # "ml" | "rule-based"
    factors: dict


def _days_between(d1: datetime, d2: datetime) -> int:
    if not d1 or not d2:
        return 0
    if d1.tzinfo is None:
        d1 = d1.replace(tzinfo=timezone.utc)
    if d2.tzinfo is None:
        d2 = d2.replace(tzinfo=timezone.utc)
    return max(0, (d2 - d1).days)


async def _compute_metrics(db, project) -> dict:
    """Pull schedule/budget/task numbers used for both numeric outputs and the rule fallback."""
    tasks = list((await db.execute(select(Task).where(Task.project_id == project.id))).scalars().all())
    total_tasks = len(tasks)
    completed = sum(1 for t in tasks if t.status == TaskStatus.COMPLETED.value)
    in_progress = sum(1 for t in tasks if t.status == TaskStatus.IN_PROGRESS.value)
    task_completion_rate = (completed / total_tasks) if total_tasks > 0 else 0.0

    progress = (project.progress_percentage or 0.0) / 100.0
    budget_ratio = (project.budget_spent / project.total_budget) if project.total_budget else 0.0
    budget_efficiency = budget_ratio / progress if progress > 0 else budget_ratio

    planned_total_days = _days_between(project.planned_start_date, project.planned_end_date)
    schedule_deviation = 0.0
    if planned_total_days > 0 and project.planned_start_date:
        elapsed = _days_between(project.planned_start_date, datetime.now(timezone.utc))
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


def _rule_based_risk(budget_efficiency: float, schedule_deviation: float,
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
    # Rule-based confidence is intentionally lower than ML's max-prob.
    return level, 0.5


async def _resolve_risk(db, project, m: dict) -> tuple[str, float, str, dict | None, dict]:
    """Returns (risk_level, confidence, source, ml_result, features)."""
    if ml_predictor.is_loaded():
        logger.info("prediction: ML model is loaded, building features and calling predictor")
        features = await build_features(db, project)
        ml_result = ml_predictor.predict(features)
        if ml_result:
            logger.info(
                "prediction: ML path SUCCESS — risk_level=%s confidence=%.3f class_index=%d",
                ml_result["risk_level"], ml_result["confidence"], ml_result["class_index"],
            )
            return ml_result["risk_level"], ml_result["confidence"], "ml", ml_result, features
        logger.warning("prediction: ML predictor returned None, falling back to rule-based")
    else:
        logger.warning(
            "prediction: ML model NOT loaded (file missing at startup or load failed) — using rule-based fallback"
        )

    level, confidence = _rule_based_risk(
        m["budget_efficiency"], m["schedule_deviation"], m["task_completion_rate"]
    )
    logger.info("prediction: rule-based path — risk_level=%s confidence=%.2f", level, confidence)
    return level, confidence, "rule-based", None, {}


def _build_factors(project, m: dict, ml_result: dict | None, features: dict) -> dict:
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


@router.get("/{project_id}/prediction", response_model=RiskPredictionResponse)
async def get_risk_prediction(
    project_id: UUID, db: DbSession,
    _: User = Depends(get_current_active_user),
) -> Any:
    """
    Risk + delay + budget-overrun prediction for a project.

    - `risk_level` and `confidence_score` come from the trained Random Forest classifier
      when the model is loaded; otherwise from a rule-based fallback.
    - `delay_estimate_days` and `budget_overrun_estimate` are always derived from
      project schedule/budget math (the classifier doesn't predict numeric values).
    """
    logger.info("prediction: GET /projects/%s/prediction called", project_id)
    project = await project_repo.get_by_id(db, project_id)
    if not project:
        logger.warning("prediction: project_id=%s not found", project_id)
        raise HTTPException(status_code=404, detail="Project not found")

    m = await _compute_metrics(db, project)
    logger.info(
        "prediction: metrics — total_tasks=%d completed=%d progress=%.2f budget_ratio=%.3f schedule_dev=%.3f",
        m["total_tasks"], m["completed_tasks"], m["progress"], m["budget_ratio"], m["schedule_deviation"],
    )

    risk_level, confidence_score, source, ml_result, features = await _resolve_risk(db, project, m)
    factors = _build_factors(project, m, ml_result, features)

    response = RiskPredictionResponse(
        project_id=project_id,
        risk_level=risk_level,
        delay_estimate_days=m["delay_estimate_days"],
        budget_overrun_estimate=round(m["budget_overrun_estimate"], 2),
        confidence_score=round(confidence_score, 2),
        source=source,
        factors=factors,
    )
    logger.info(
        "prediction: RESPONSE source=%s risk_level=%s delay_days=%d overrun=%.2f confidence=%.2f",
        source, risk_level, m["delay_estimate_days"], m["budget_overrun_estimate"], confidence_score,
    )
    return response
