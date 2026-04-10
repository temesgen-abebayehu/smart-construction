from typing import Any
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from pydantic import BaseModel

from app.api.dependencies import DbSession, get_current_active_user
from app.models.user import User
from app.models.project import Project
from app.models.task import Task
from app.models.log import DailyLog, Labor, Material, Equipment
from app.models.commons import TaskStatus, LogStatus
from app.repositories.project import ProjectRepository
from datetime import datetime, timezone

router = APIRouter()
project_repo = ProjectRepository()


# ── Response Schema ──

class RiskPredictionResponse(BaseModel):
    project_id: UUID
    risk_level: str           # "low" | "medium" | "high"
    delay_estimate_days: int
    budget_overrun_estimate: float
    confidence_score: float   # 0.0 – 1.0
    factors: dict


# ── Helpers ──

def _days_between(d1: datetime, d2: datetime) -> int:
    """Return positive int of days between two datetimes."""
    if not d1 or not d2:
        return 0
    if d1.tzinfo is None:
        d1 = d1.replace(tzinfo=timezone.utc)
    if d2.tzinfo is None:
        d2 = d2.replace(tzinfo=timezone.utc)
    return max(0, (d2 - d1).days)


# ── Endpoint ──

@router.get("/{project_id}/prediction", response_model=RiskPredictionResponse)
async def get_risk_prediction(
    project_id: UUID, db: DbSession,
    _: User = Depends(get_current_active_user),
) -> Any:
    """
    Returns a rule-based ML risk prediction for the project.
    Evaluates schedule progress, budget burn rate, and task completion
    to estimate risk level, potential delay, and budget overrun.
    """
    project = await project_repo.get_by_id(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # ── Gather raw data ──

    tasks_result = await db.execute(select(Task).where(Task.project_id == project_id))
    tasks = list(tasks_result.scalars().all())
    total_tasks = len(tasks)
    completed_tasks = sum(1 for t in tasks if t.status == TaskStatus.COMPLETED.value)
    in_progress_tasks = sum(1 for t in tasks if t.status == TaskStatus.IN_PROGRESS.value)
    task_completion_rate = (completed_tasks / total_tasks) if total_tasks > 0 else 0.0

    # Budget burn rate
    budget_ratio = (project.budget_spent / project.total_budget) if project.total_budget > 0 else 0.0
    progress = project.progress_percentage / 100.0  # normalize to 0-1

    # Schedule adherence — compare planned vs actual progress
    schedule_deviation = 0.0
    planned_total_days = _days_between(project.planned_start_date, project.planned_end_date)
    if planned_total_days > 0 and project.planned_start_date:
        now = datetime.now(timezone.utc)
        elapsed_days = _days_between(project.planned_start_date, now)
        expected_progress = min(elapsed_days / planned_total_days, 1.0)
        schedule_deviation = expected_progress - progress  # positive = behind schedule

    # ── Scoring ──

    # Budget overrun indicator (1.0 = budget & progress perfectly matched, >1 = burning faster)
    budget_efficiency = budget_ratio / progress if progress > 0 else budget_ratio

    # Risk scoring (0–1 scale, higher = riskier)
    risk_score = 0.0
    risk_score += min(budget_efficiency - 1.0, 1.0) * 0.4   # budget overrun factor (40% weight)
    risk_score += max(schedule_deviation, 0.0) * 0.4          # schedule slip factor  (40% weight)
    risk_score += (1.0 - task_completion_rate) * 0.2          # task completion factor(20% weight)
    risk_score = max(0.0, min(risk_score, 1.0))               # clamp 0-1

    # ── Classify risk level ──
    if risk_score >= 0.6:
        risk_level = "high"
    elif risk_score >= 0.3:
        risk_level = "medium"
    else:
        risk_level = "low"

    # ── Estimate delay in days ──
    if planned_total_days > 0 and schedule_deviation > 0:
        delay_estimate_days = int(schedule_deviation * planned_total_days)
    else:
        delay_estimate_days = 0

    # ── Estimate budget overrun ──
    if budget_efficiency > 1.0:
        projected_total_spend = project.budget_spent / progress if progress > 0 else project.budget_spent
        budget_overrun_estimate = max(0.0, projected_total_spend - project.total_budget)
    else:
        budget_overrun_estimate = 0.0

    # Confidence: increases with more data (tasks and progress)
    confidence_score = min(0.4 + (total_tasks / 20.0) + (progress * 0.3), 1.0)

    return RiskPredictionResponse(
        project_id=project_id,
        risk_level=risk_level,
        delay_estimate_days=delay_estimate_days,
        budget_overrun_estimate=round(budget_overrun_estimate, 2),
        confidence_score=round(confidence_score, 2),
        factors={
            "budget_ratio": round(budget_ratio, 3),
            "budget_efficiency": round(budget_efficiency, 3),
            "schedule_deviation": round(schedule_deviation, 3),
            "progress_percentage": project.progress_percentage,
            "task_completion_rate": round(task_completion_rate, 3),
            "total_tasks": total_tasks,
            "completed_tasks": completed_tasks,
            "in_progress_tasks": in_progress_tasks,
            "planned_total_days": planned_total_days,
            "delay_estimate_days": delay_estimate_days,
        }
    )
