from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from fastapi import HTTPException

from app.models.log import DailyLog, Manpower, Material, Equipment
from app.models.task import Task, TaskActivity
from app.models.project import Project
from app.models.commons import LogStatus, ProjectRole
from app.repositories.log import DailyLogRepository

log_repo = DailyLogRepository()

# Workflow transitions: who can trigger what
# 3-step chain: Site Engineer submits → Consultant approves → PM final approval
WORKFLOW_TRANSITIONS = {
    "submit": {
        "from_status": [LogStatus.DRAFT, LogStatus.REJECTED],
        "to_status": LogStatus.SUBMITTED,
        "allowed_roles": [ProjectRole.SITE_ENGINEER],
    },
    "consultant-approve": {
        "from_status": [LogStatus.SUBMITTED],
        "to_status": LogStatus.CONSULTANT_APPROVED,
        "allowed_roles": [ProjectRole.CONSULTANT],
    },
    "pm-approve": {
        "from_status": [LogStatus.CONSULTANT_APPROVED],
        "to_status": LogStatus.PM_APPROVED,
        "allowed_roles": [ProjectRole.PROJECT_MANAGER],
    },
}


class DailyLogService:
    @staticmethod
    async def create_log(
        db: AsyncSession,
        project_id: UUID,
        user_id: UUID,
        notes: str = None,
        weather: str = None,
        task_id: UUID = None,
    ) -> DailyLog:
        log = DailyLog(
            project_id=project_id,
            task_id=task_id,  # optional
            created_by_id=user_id,
            notes=notes,
            weather=weather,
        )
        db.add(log)
        await db.commit()
        await db.refresh(log)
        return log

    @staticmethod
    async def transition_log(db: AsyncSession, log_id: UUID, action: str, user_role: str) -> DailyLog:
        """Execute a workflow transition on a daily log."""
        if action not in WORKFLOW_TRANSITIONS:
            raise HTTPException(status_code=400, detail=f"Invalid action: {action}")

        transition = WORKFLOW_TRANSITIONS[action]
        log = await log_repo.get_by_id(db, log_id)
        if not log:
            raise HTTPException(status_code=404, detail="Daily log not found")

        # Verify current status
        allowed_from = [s.value for s in transition["from_status"]]
        if log.status not in allowed_from:
            raise HTTPException(
                status_code=400,
                detail=f"Log must be in {allowed_from} status for action '{action}'. Current: '{log.status}'"
            )

        # Verify role permission
        allowed = [r.value for r in transition["allowed_roles"]]
        if user_role not in allowed:
            raise HTTPException(
                status_code=403,
                detail=f"Role '{user_role}' cannot perform '{action}'. Allowed: {allowed}"
            )

        log.status = transition["to_status"].value
        db.add(log)
        await db.commit()
        await db.refresh(log)

        # On final PM approval, update budget and recalculate task progress from activities
        if action == "pm-approve":
            await DailyLogService._on_final_approval(db, log)

        return log

    @staticmethod
    async def reject_log(db: AsyncSession, log_id: UUID, rejection_reason: str) -> DailyLog:
        log = await log_repo.get_by_id(db, log_id)
        if not log:
            raise HTTPException(status_code=404, detail="Daily log not found")
        if log.status not in [LogStatus.SUBMITTED.value, LogStatus.CONSULTANT_APPROVED.value]:
            raise HTTPException(status_code=400, detail=f"Cannot reject log in '{log.status}' status")
        log.status = LogStatus.REJECTED.value
        log.rejection_reason = rejection_reason
        db.add(log)
        await db.commit()
        await db.refresh(log)
        return log

    @staticmethod
    async def _on_final_approval(db: AsyncSession, log: DailyLog):
        """Update project budget after PM approval.
        Task progress is driven by TaskActivity completion, not by log counts."""
        # Calculate total cost from this log's sub-entities
        manpower_cost = await db.execute(
            select(func.coalesce(func.sum(Manpower.cost), 0)).where(Manpower.log_id == log.id)
        )
        mat_cost = await db.execute(
            select(func.coalesce(func.sum(Material.cost), 0)).where(Material.log_id == log.id)
        )
        equip_cost = await db.execute(
            select(func.coalesce(func.sum(Equipment.cost), 0)).where(Equipment.log_id == log.id)
        )
        total_cost = manpower_cost.scalar() + mat_cost.scalar() + equip_cost.scalar()

        # Update project budget_spent
        project = await db.get(Project, log.project_id)
        if project:
            project.budget_spent = (project.budget_spent or 0) + total_cost
            db.add(project)

        # Recalculate task progress from activities (not from log counts)
        task = await db.get(Task, log.task_id)
        if task:
            activities = (await db.execute(
                select(TaskActivity).where(TaskActivity.task_id == task.id)
            )).scalars().all()

            if activities:
                task.progress_percentage = sum(
                    a.percentage for a in activities if a.is_completed
                )
            # else: no activities defined, keep current progress

            if task.progress_percentage >= 100:
                task.status = "completed"
            elif task.progress_percentage > 0:
                task.status = "in_progress"
            db.add(task)

            # Recalculate project progress from all tasks
            if project:
                all_tasks = await db.execute(select(Task).where(Task.project_id == project.id))
                tasks = list(all_tasks.scalars().all())
                if tasks:
                    project.progress_percentage = sum(t.progress_percentage for t in tasks) / len(tasks)
                    db.add(project)

        await db.commit()
