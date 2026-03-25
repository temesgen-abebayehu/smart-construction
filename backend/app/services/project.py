from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException

from app.models.project import Project, ProjectMember
from app.models.commons import ProjectRole
from app.schemas.project import ProjectCreate, ProjectUpdate, ProjectMemberCreate, ProjectMemberUpdate, ProjectDashboard
from app.repositories.project import ProjectRepository, ProjectMemberRepository

project_repo = ProjectRepository()
member_repo = ProjectMemberRepository()

class ProjectService:
    @staticmethod
    async def create_project(db: AsyncSession, project_in: ProjectCreate, creator_id: UUID) -> Project:
        db_obj = Project(
            name=project_in.name,
            description=project_in.description,
            status=project_in.status.value if project_in.status else "planning",
            total_budget=project_in.total_budget,
            client_id=project_in.client_id,
        )
        db.add(db_obj)
        await db.commit()
        await db.refresh(db_obj)
        
        # Creator automatically becomes project_manager
        member = ProjectMember(
            project_id=db_obj.id,
            user_id=creator_id,
            role=ProjectRole.PROJECT_MANAGER.value,
        )
        db.add(member)
        await db.commit()
        await db.refresh(db_obj)
        return db_obj

    @staticmethod
    async def update_project(db: AsyncSession, project_id: UUID, project_in: ProjectUpdate) -> Project:
        project = await project_repo.get_by_id(db, project_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        return await project_repo.update(db, project, project_in)

    @staticmethod
    async def delete_project(db: AsyncSession, project_id: UUID) -> bool:
        return await project_repo.delete(db, project_id)

    @staticmethod
    async def get_dashboard(db: AsyncSession, project_id: UUID) -> ProjectDashboard:
        from sqlalchemy import select, func
        from app.models.task import Task
        from app.models.commons import TaskStatus

        project = await project_repo.get_by_id(db, project_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")

        # Task summary
        result = await db.execute(select(Task).where(Task.project_id == project_id))
        tasks = list(result.scalars().all())
        total_tasks = len(tasks)
        completed = sum(1 for t in tasks if t.status == TaskStatus.COMPLETED.value)
        in_progress = sum(1 for t in tasks if t.status == TaskStatus.IN_PROGRESS.value)
        pending = sum(1 for t in tasks if t.status == TaskStatus.PENDING.value)

        # Delay risk
        budget_ratio = project.budget_spent / project.total_budget if project.total_budget > 0 else 0
        delay_risk = "high" if budget_ratio > 0.9 and project.progress_percentage < 80 else \
                     "medium" if budget_ratio > 0.7 and project.progress_percentage < 60 else "low"

        return ProjectDashboard(
            id=project.id,
            name=project.name,
            progress_percentage=project.progress_percentage,
            total_budget=project.total_budget,
            budget_spent=project.budget_spent,
            task_summary={
                "total": total_tasks,
                "completed": completed,
                "in_progress": in_progress,
                "pending": pending,
            },
            delay_risk_status=delay_risk,
        )


class ProjectMemberService:
    @staticmethod
    async def add_member(db: AsyncSession, project_id: UUID, member_in: ProjectMemberCreate) -> ProjectMember:
        existing = await member_repo.get_by_project_and_user(db, project_id, member_in.user_id)
        if existing:
            raise HTTPException(status_code=400, detail="User is already a member of this project")
        db_obj = ProjectMember(
            project_id=project_id,
            user_id=member_in.user_id,
            role=member_in.role.value,
        )
        db.add(db_obj)
        await db.commit()
        await db.refresh(db_obj)
        return db_obj

    @staticmethod
    async def update_member_role(db: AsyncSession, project_id: UUID, user_id: UUID, update_in: ProjectMemberUpdate) -> ProjectMember:
        member = await member_repo.get_by_project_and_user(db, project_id, user_id)
        if not member:
            raise HTTPException(status_code=404, detail="Member not found")
        member.role = update_in.role.value
        db.add(member)
        await db.commit()
        await db.refresh(member)
        return member

    @staticmethod
    async def remove_member(db: AsyncSession, project_id: UUID, user_id: UUID) -> bool:
        member = await member_repo.get_by_project_and_user(db, project_id, user_id)
        if not member:
            raise HTTPException(status_code=404, detail="Member not found")
        await db.delete(member)
        await db.commit()
        return True
