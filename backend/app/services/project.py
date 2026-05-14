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
from datetime import datetime, timezone
from app.core.email import send_invitation_email
import asyncio
import logging

logger = logging.getLogger(__name__)

project_repo = ProjectRepository()
member_repo = ProjectMemberRepository()
client_repo = ClientRepository()

class ProjectService:
    @staticmethod
    async def _find_or_create_client(
        db: AsyncSession, 
        project_id: UUID,
        name: str, 
        email: str,
        tin_number: str | None = None,
        address: str | None = None,
        phone: str | None = None
    ) -> Client:
        normalized_email = email.strip().lower()
        normalized_name = name.strip()

        # 1. Try email first within this project
        client = await client_repo.get_by_email(db, email=normalized_email, project_id=project_id)
        if client:
            return client

        # 2. Fallback to name within this project
        client = await client_repo.get_by_name(db, name=normalized_name, project_id=project_id)
        if client:
            return client

        # 3. Neither matched — create new with all fields
        client = Client(
            project_id=project_id,
            name=normalized_name, 
            contact_email=normalized_email,
            tin_number=tin_number.strip() if tin_number else None,
            address=address.strip() if address else None,
            contact_phone=phone.strip() if phone else None
        )
        db.add(client)
        try:
            await db.commit()
            await db.refresh(client)
            return client
        except IntegrityError:
            # Race: another request created a client with the same email or name
            # between our SELECTs and INSERT. Roll back and re-fetch.
            await db.rollback()
            existing = await client_repo.get_by_email(db, email=normalized_email, project_id=project_id)
            if existing:
                return existing
            existing = await client_repo.get_by_name(db, name=normalized_name, project_id=project_id)
            if existing:
                return existing
            raise

    @staticmethod
    async def create_project(db: AsyncSession, project_in: ProjectCreate, creator_id: UUID) -> Project:
        # First create the project
        db_obj = Project(
            name=project_in.name,
            description=project_in.description,
            location=project_in.location,
            status=project_in.status.value if project_in.status else "planning",
            total_budget=project_in.total_budget,
            planned_start_date=project_in.planned_start_date,
            planned_end_date=project_in.planned_end_date,
            owner_id=creator_id,
        )
        db.add(db_obj)
        await db.commit()
        await db.refresh(db_obj)

        # Now create the client for this project
        client = await ProjectService._find_or_create_client(
            db, 
            project_id=db_obj.id,
            name=project_in.client_name, 
            email=project_in.client_email,
            tin_number=project_in.client_tin_number,
            address=project_in.client_address,
            phone=project_in.client_phone
        )

        # Creator automatically becomes PROJECT_MANAGER
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
        """Delete a project and all its related data (cascade delete)."""
        from app.models.log import DailyLog
        from app.models.system import BudgetItem, AuditLog
        from app.models.project import Contractor, Supplier
        from sqlalchemy import text
        
        project = await project_repo.get_by_id(db, project_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        # Manually delete related records to avoid foreign key violations
        # The order matters: delete children before parents
        
        # 1. Delete daily logs (which will cascade to manpower, materials, equipment, photos)
        logs_result = await db.execute(select(DailyLog).where(DailyLog.project_id == project_id))
        logs = logs_result.scalars().all()
        for log in logs:
            await db.delete(log)
        
        # 2. Delete tasks (which will cascade to task_activities and task_dependencies)
        tasks_result = await db.execute(select(Task).where(Task.project_id == project_id))
        tasks = tasks_result.scalars().all()
        for task in tasks:
            await db.delete(task)
        
        # 3. Delete budget items
        try:
            items_result = await db.execute(select(BudgetItem).where(BudgetItem.project_id == project_id))
            items = items_result.scalars().all()
            for item in items:
                await db.delete(item)
        except Exception:
            # BudgetItem might not have any records
            pass
        
        # 4. Delete clients
        try:
            clients_result = await db.execute(select(Client).where(Client.project_id == project_id))
            clients = clients_result.scalars().all()
            for client in clients:
                await db.delete(client)
        except Exception:
            pass
        
        # 5. Delete suppliers
        try:
            suppliers_result = await db.execute(select(Supplier).where(Supplier.project_id == project_id))
            suppliers = suppliers_result.scalars().all()
            for supplier in suppliers:
                await db.delete(supplier)
        except Exception:
            pass
        
        # 6. Delete audit logs
        try:
            audit_result = await db.execute(select(AuditLog).where(AuditLog.project_id == project_id))
            audits = audit_result.scalars().all()
            for audit in audits:
                await db.delete(audit)
        except Exception:
            pass
        
        # 7. Delete risk_predictions (if table exists)
        try:
            await db.execute(text("DELETE FROM risk_predictions WHERE project_id = :project_id"), {"project_id": project_id})
        except Exception:
            # Table might not exist or no records
            pass
        
        # 8. Project members and invitations are already set to cascade in the model
        # 9. Progress snapshots are already set to cascade in the model
        
        # 10. Finally delete the project itself
        await db.delete(project)
        await db.commit()
        return True

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

        # ATOMIC: try to send email FIRST. Only persist DB rows if it succeeded.
        # send_invitation_email is synchronous (smtplib); run in a thread so we
        # don't block the event loop.
        email_sent = await asyncio.to_thread(
            send_invitation_email, invite_in.email, project.name, token, user_exists
        )
        if not email_sent:
            logger.warning(f"Invitation aborted — email send failed for {invite_in.email}")
            raise HTTPException(
                status_code=502,
                detail="Could not send invitation email. The invitation was not created. Please try again later or contact an administrator.",
            )

        sent_at = datetime.now(timezone.utc)

        if existing_user:
            # User already registered → add them directly as a member.
            db.add(ProjectMember(
                project_id=project_id,
                user_id=existing_user.id,
                role=invite_in.role.value,
            ))
            db_obj = ProjectInvitation(
                project_id=project_id,
                email=invite_in.email,
                role=invite_in.role.value,
                token=token,
                status="accepted",
                email_sent_at=sent_at,
            )
        else:
            db_obj = ProjectInvitation(
                project_id=project_id,
                email=invite_in.email,
                role=invite_in.role.value,
                token=token,
                email_sent_at=sent_at,
            )

        db.add(db_obj)
        await db.commit()
        await db.refresh(db_obj)
        return db_obj

    @staticmethod
    async def resend_invitation(db: AsyncSession, project_id: UUID, invitation_id: UUID) -> ProjectInvitation:
        result = await db.execute(select(ProjectInvitation).where(
            ProjectInvitation.id == invitation_id,
            ProjectInvitation.project_id == project_id,
        ))
        invitation = result.scalars().first()
        if not invitation:
            raise HTTPException(status_code=404, detail="Invitation not found")

        project = await project_repo.get_by_id(db, project_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")

        # Re-send same email template that was originally used. We only need
        # to know whether the user existed at the time we sent — for resend,
        # the safest re-derivation is "is there a user with this email now?"
        from app.repositories.user import UserRepository
        existing_user = await UserRepository.get_by_email(db, email=invitation.email)
        user_exists = existing_user is not None

        email_sent = await asyncio.to_thread(
            send_invitation_email, invitation.email, project.name, invitation.token, user_exists
        )
        if not email_sent:
            logger.warning(f"Resend failed for invitation {invitation_id} ({invitation.email})")
            raise HTTPException(
                status_code=502,
                detail="Could not send invitation email. Please try again later.",
            )

        invitation.email_sent_at = datetime.now(timezone.utc)
        db.add(invitation)
        await db.commit()
        await db.refresh(invitation)
        return invitation

    @staticmethod
    async def get_invitations(db: AsyncSession, project_id: UUID, status: str | None = None):
        stmt = select(ProjectInvitation).where(ProjectInvitation.project_id == project_id)
        if status:
            stmt = stmt.where(ProjectInvitation.status == status)
        result = await db.execute(stmt)
        return list(result.scalars().all())

    @staticmethod
    async def delete_invitation(db: AsyncSession, project_id: UUID, invitation_id: UUID) -> None:
        result = await db.execute(select(ProjectInvitation).where(
            ProjectInvitation.id == invitation_id,
            ProjectInvitation.project_id == project_id,
        ))
        invitation = result.scalars().first()
        if not invitation:
            raise HTTPException(status_code=404, detail="Invitation not found")
        await db.delete(invitation)
        await db.commit()

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
