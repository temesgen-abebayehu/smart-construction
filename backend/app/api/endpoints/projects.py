from typing import Any, List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException

from app.api.dependencies import DbSession, get_current_active_user, require_project_role
from app.models.user import User
from app.models.commons import ProjectRole
from app.schemas.project import (
    ProjectCreate, ProjectUpdate, ProjectResponse, ProjectDashboard,
    ProjectMemberCreate, ProjectMemberUpdate, ProjectMemberResponse,
    ProjectMemberWithUserResponse,
    ProjectInvitationCreate, ProjectInvitationResponse, ProjectInvitationAccept
)
from app.services.project import ProjectService, ProjectMemberService, ProjectInvitationService
from app.repositories.project import ProjectRepository, ProjectMemberRepository
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.models.project import ProjectMember

router = APIRouter()
project_repo = ProjectRepository()
member_repo = ProjectMemberRepository()

# ── Project CRUD ──

@router.post("", response_model=ProjectResponse, status_code=201)
async def create_project(
    *, db: DbSession, project_in: ProjectCreate,
    current_user: User = Depends(get_current_active_user),
) -> Any:
    return await ProjectService.create_project(db, project_in, current_user.id)

@router.get("", response_model=List[ProjectResponse])
async def list_projects(
    db: DbSession, skip: int = 0, limit: int = 100,
    _: User = Depends(get_current_active_user),
) -> Any:
    return await project_repo.get_all(db, skip=skip, limit=limit)

@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: UUID, db: DbSession,
    _: User = Depends(get_current_active_user),
) -> Any:
    project = await project_repo.get_by_id(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project

@router.put("/{project_id}", response_model=ProjectResponse,
            dependencies=[Depends(require_project_role([ProjectRole.OWNER, ProjectRole.PROJECT_MANAGER]))])
async def update_project(
    *, db: DbSession, project_id: UUID, project_in: ProjectUpdate,
) -> Any:
    return await ProjectService.update_project(db, project_id, project_in)

@router.delete("/{project_id}", status_code=204,
               dependencies=[Depends(require_project_role([ProjectRole.OWNER, ProjectRole.PROJECT_MANAGER]))])
async def delete_project(project_id: UUID, db: DbSession) -> None:
    await ProjectService.delete_project(db, project_id)

# ── Project Dashboard ──

@router.get("/{project_id}/dashboard", response_model=ProjectDashboard)
async def get_project_dashboard(
    project_id: UUID, db: DbSession,
    _: User = Depends(get_current_active_user),
) -> Any:
    return await ProjectService.get_dashboard(db, project_id)

# ── Project Members ──

@router.post("/{project_id}/members", response_model=ProjectMemberResponse, status_code=201,
             dependencies=[Depends(require_project_role([ProjectRole.OWNER, ProjectRole.PROJECT_MANAGER]))])
async def add_member(
    *, db: DbSession, project_id: UUID, member_in: ProjectMemberCreate,
) -> Any:
    return await ProjectMemberService.add_member(db, project_id, member_in)

@router.get("/{project_id}/members", response_model=List[ProjectMemberWithUserResponse])
async def list_members(
    project_id: UUID, db: DbSession,
    _: User = Depends(get_current_active_user),
) -> Any:
    result = await db.execute(
        select(ProjectMember)
        .options(selectinload(ProjectMember.user))
        .where(ProjectMember.project_id == project_id)
    )
    return list(result.scalars().all())

@router.patch("/{project_id}/members/{user_id}", response_model=ProjectMemberResponse,
              dependencies=[Depends(require_project_role([ProjectRole.OWNER, ProjectRole.PROJECT_MANAGER]))])
async def update_member_role(
    *, db: DbSession, project_id: UUID, user_id: UUID, update_in: ProjectMemberUpdate,
) -> Any:
    return await ProjectMemberService.update_member_role(db, project_id, user_id, update_in)

@router.delete("/{project_id}/members/{user_id}", status_code=204,
               dependencies=[Depends(require_project_role([ProjectRole.OWNER, ProjectRole.PROJECT_MANAGER]))])
async def remove_member(project_id: UUID, user_id: UUID, db: DbSession) -> None:
    await ProjectMemberService.remove_member(db, project_id, user_id)

# ── Project Invitations ──

@router.post("/{project_id}/invitations", response_model=ProjectInvitationResponse, status_code=201,
             dependencies=[Depends(require_project_role([ProjectRole.OWNER, ProjectRole.PROJECT_MANAGER]))])
async def create_invitation(
    *, db: DbSession, project_id: UUID, invite_in: ProjectInvitationCreate,
) -> Any:
    result = await ProjectInvitationService.create_invitation(db, project_id, invite_in)
    # Build response with email_sent flag
    resp = ProjectInvitationResponse.model_validate(result)
    resp.email_sent = getattr(result, '_email_sent', True)
    return resp

@router.get("/{project_id}/invitations", response_model=List[ProjectInvitationResponse],
            dependencies=[Depends(require_project_role([ProjectRole.OWNER, ProjectRole.PROJECT_MANAGER]))])
async def list_invitations(
    project_id: UUID, db: DbSession,
) -> Any:
    return await ProjectInvitationService.get_invitations(db, project_id)

@router.post("/invitations/accept", response_model=ProjectMemberResponse)
async def accept_invitation(
    *, db: DbSession, accept_in: ProjectInvitationAccept,
    current_user: User = Depends(get_current_active_user),
) -> Any:
    return await ProjectInvitationService.accept_invitation(db, accept_in.token, current_user.id)
