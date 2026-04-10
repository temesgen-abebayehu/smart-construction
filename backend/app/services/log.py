from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from fastapi import HTTPException

from app.models.log import DailyLog, Labor, Material, Equipment
from app.models.task import Task
from app.models.project import Project
from app.models.commons import LogStatus, ProjectRole
from app.repositories.log import DailyLogRepository

log_repo = DailyLogRepository()

# Workflow transitions: who can trigger what
WORKFLOW_TRANSITIONS = {
    "submit": {
        "from_status": LogStatus.DRAFT,
        "to_status": LogStatus.SUBMITTED,
        "allowed_roles": [ProjectRole.SITE_ENGINEER],
    },
    "review": {
        "from_status": LogStatus.SUBMITTED,
        "to_status": LogStatus.REVIEWED,
        "allowed_roles": [ProjectRole.OFFICE_ENGINEER],
    },
    "consultant-approve": {
        "from_status": LogStatus.REVIEWED,
        "to_status": LogStatus.CONSULTANT_APPROVED,
        "allowed_roles": [ProjectRole.CONSULTANT],
    },
    "pm-approve": {
        "from_status": LogStatus.CONSULTANT_APPROVED,
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
        if log.status != transition["from_status"].value:
            raise HTTPException(
                status_code=400,
                detail=f"Log must be in '{transition['from_status'].value}' status for action '{action}'. Current: '{log.status}'"
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

        # On final PM approval, update task progress and budget
        if action == "pm-approve":
            await DailyLogService._on_final_approval(db, log)

        return log

    @staticmethod
    async def reject_log(db: AsyncSession, log_id: UUID) -> DailyLog:
        log = await log_repo.get_by_id(db, log_id)
        if not log:
            raise HTTPException(status_code=404, detail="Daily log not found")
        log.status = LogStatus.DRAFT.value
        db.add(log)
        await db.commit()
        await db.refresh(log)
        return log

    @staticmethod
    async def _on_final_approval(db: AsyncSession, log: DailyLog):
        """Update task progress and project budget after PM approval."""
        # Calculate total cost from this log's sub-entities
        labor_cost = await db.execute(
            select(func.coalesce(func.sum(Labor.cost), 0)).where(Labor.log_id == log.id)
        )
        mat_cost = await db.execute(
            select(func.coalesce(func.sum(Material.cost), 0)).where(Material.log_id == log.id)
        )
        equip_cost = await db.execute(
            select(func.coalesce(func.sum(Equipment.cost), 0)).where(Equipment.log_id == log.id)
        )
        total_cost = labor_cost.scalar() + mat_cost.scalar() + equip_cost.scalar()

        # Update project budget_spent
        project = await db.get(Project, log.project_id)
        if project:
            project.budget_spent = (project.budget_spent or 0) + total_cost
            db.add(project)

        # Count approved logs vs total logs to derive task progress
        task = await db.get(Task, log.task_id)
        if task:
            total_logs = await db.execute(
                select(func.count()).select_from(DailyLog).where(DailyLog.task_id == task.id)
            )
            approved_logs = await db.execute(
                select(func.count()).select_from(DailyLog).where(
                    DailyLog.task_id == task.id,
                    DailyLog.status == LogStatus.PM_APPROVED.value
                )
            )
            total = total_logs.scalar()
            approved = approved_logs.scalar()
            task.progress_percentage = (approved / total * 100) if total > 0 else 0
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
