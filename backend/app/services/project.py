from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy import select, func
from app.models.task import Task
from app.models.commons import TaskStatus
from app.models.project import Project, ProjectMember, ProjectInvitation, Client
from app.models.commons import ProjectRole
from app.schemas.project import ProjectCreate, ProjectUpdate, ProjectMemberCreate, ProjectMemberUpdate, ProjectDashboard, ProjectInvitationCreate
from app.repositories.project import ProjectRepository, ProjectMemberRepository, ClientRepository
import secrets
from app.core.email import send_invitation_email
import asyncio
import logging

logger = logging.getLogger(__name__)

project_repo = ProjectRepository()
member_repo = ProjectMemberRepository()
client_repo = ClientRepository()

class ProjectService:
    @staticmethod
    async def _find_or_create_client(db: AsyncSession, name: str, email: str) -> Client:
        normalized_email = email.strip().lower()
        normalized_name = name.strip()

        # 1. Try email first — most precise match
        client = await client_repo.get_by_email(db, email=normalized_email)
        if client:
            return client

        # 2. Fallback to name — prevents a second row for the same real-world client
        client = await client_repo.get_by_name(db, name=normalized_name)
        if client:
            return client

        # 3. Neither matched — create new
        client = Client(name=normalized_name, contact_email=normalized_email)
        db.add(client)
        try:
            await db.commit()
            await db.refresh(client)
            return client
        except IntegrityError:
            # Race: another request created a client with the same email or name
            # between our SELECTs and INSERT. Roll back and re-fetch.
            await db.rollback()
            existing = await client_repo.get_by_email(db, email=normalized_email)
            if existing:
                return existing
            existing = await client_repo.get_by_name(db, name=normalized_name)
            if existing:
                return existing
            raise

    @staticmethod
    async def create_project(db: AsyncSession, project_in: ProjectCreate, creator_id: UUID) -> Project:
        client = await ProjectService._find_or_create_client(
            db, name=project_in.client_name, email=project_in.client_email
        )

        db_obj = Project(
            name=project_in.name,
            description=project_in.description,
            location=project_in.location,
            status=project_in.status.value if project_in.status else "planning",
            total_budget=project_in.total_budget,
            planned_start_date=project_in.planned_start_date,
            planned_end_date=project_in.planned_end_date,
            client_id=client.id,
            owner_id=creator_id,
        )
        db.add(db_obj)
        await db.commit()
        await db.refresh(db_obj)

        # Creator automatically becomes PROJECT_MANAGER
        member = ProjectMember(
            project_id=db_obj.id,
            user_id=creator_id,
            role=ProjectRole.PROJECT_MANAGER.value,
        )
        db.add(member)
        await db.commit()
        await db.refresh(db_obj, attribute_names=["client"])
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
            raise HTTPException(status_code=409, detail="User is already a member of this project")
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
        # Prevent removing the last PM
        if member.role == ProjectRole.PROJECT_MANAGER.value:
            result = await db.execute(
                select(ProjectMember).where(
                    ProjectMember.project_id == project_id,
                    ProjectMember.role == ProjectRole.PROJECT_MANAGER.value,
                )
            )
            pm_count = len(list(result.scalars().all()))
            if pm_count <= 1:
                raise HTTPException(status_code=400, detail="Cannot remove the only Project Manager. Assign another PM first.")
        await db.delete(member)
        await db.commit()
        return True

class ProjectInvitationService:
    @staticmethod
    async def create_invitation(db: AsyncSession, project_id: UUID, invite_in: ProjectInvitationCreate) -> ProjectInvitation:
        from app.repositories.user import UserRepository

        project = await project_repo.get_by_id(db, project_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")

        # Check if already a member
        existing_user = await UserRepository.get_by_email(db, email=invite_in.email)
        if existing_user:
            existing_member = await member_repo.get_by_project_and_user(db, project_id, existing_user.id)
            if existing_member:
                raise HTTPException(status_code=409, detail="User is already a member of this project")

        # Check if already invited and pending
        existing_result = await db.execute(select(ProjectInvitation).where(
            ProjectInvitation.project_id == project_id,
            ProjectInvitation.email == invite_in.email,
            ProjectInvitation.status == "pending"
        ))
        if existing_result.scalars().first():
            raise HTTPException(status_code=409, detail="User already has a pending invitation")

        token = secrets.token_urlsafe(32)
        user_exists = existing_user is not None

        # If user already registered, add them directly as a member
        if existing_user:
            member = ProjectMember(
                project_id=project_id,
                user_id=existing_user.id,
                role=invite_in.role.value,
            )
            db.add(member)

            # Create invitation record as "accepted" for audit
            db_obj = ProjectInvitation(
                project_id=project_id,
                email=invite_in.email,
                role=invite_in.role.value,
                token=token,
                status="accepted",
            )
        else:
            # User not registered — create pending invitation
            db_obj = ProjectInvitation(
                project_id=project_id,
                email=invite_in.email,
                role=invite_in.role.value,
                token=token,
            )

        db.add(db_obj)
        await db.commit()
        await db.refresh(db_obj)

        # Send email synchronously to get honest success/failure
        email_sent = send_invitation_email(invite_in.email, project.name, token, user_exists)
        if not email_sent:
            logger.warning(f"Invitation created but email failed for {invite_in.email}")

        return db_obj

    @staticmethod
    async def get_invitations(db: AsyncSession, project_id: UUID):
        result = await db.execute(select(ProjectInvitation).where(
            ProjectInvitation.project_id == project_id,
            ProjectInvitation.status == "pending"
        ))
        return list(result.scalars().all())

    @staticmethod
    async def accept_invitation(db: AsyncSession, token: str, user_id: UUID) -> ProjectMember:
        result = await db.execute(select(ProjectInvitation).where(ProjectInvitation.token == token))
        invitation = result.scalars().first()
        
        if not invitation:
            raise HTTPException(status_code=404, detail="Invalid invitation token")
        if invitation.status != "pending":
            raise HTTPException(status_code=400, detail="Invitation already processed or expired")
            
        # Add the user as a project member
        new_member = ProjectMember(
            project_id=invitation.project_id,
            user_id=user_id,
            role=invitation.role,
        )
        db.add(new_member)
        
        invitation.status = "accepted"
        db.add(invitation)
        
        await db.commit()
        await db.refresh(new_member)
        return new_member
