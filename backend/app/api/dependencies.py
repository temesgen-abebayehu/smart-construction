from typing import AsyncGenerator, Annotated
from uuid import UUID
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
import jwt
from jwt.exceptions import ExpiredSignatureError, InvalidTokenError
from pydantic import ValidationError

from app.database.session import SessionLocal
from app.core.config import settings
from app.core.security import ALGORITHM
from app.models.user import User
from app.models.project import ProjectMember
from app.models.commons import ProjectRole
from app.schemas.token import TokenPayload
from app.repositories.user import UserRepository

security = HTTPBearer()

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with SessionLocal() as session:
        yield session

DbSession = Annotated[AsyncSession, Depends(get_db)]
def get_token(credentials: HTTPAuthorizationCredentials = Depends(security)) -> str:
    return credentials.credentials

TokenDep = Annotated[str, Depends(get_token)]

async def get_current_user(db: DbSession, token: TokenDep) -> User:
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[ALGORITHM]
        )
        token_data = TokenPayload(**payload)
    except ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except (InvalidTokenError, ValidationError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user = await UserRepository.get_by_id(db, id=token_data.sub)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User no longer exists",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user

CurrentUser = Annotated[User, Depends(get_current_user)]

def get_current_active_user(current_user: CurrentUser) -> User:
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user",
        )
    return current_user

def get_current_admin_user(current_user: CurrentUser) -> User:
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="The user doesn't have enough privileges",
        )
    return current_user

async def get_project_member(
    project_id: UUID,
    db: DbSession,
    current_user: CurrentUser
) -> ProjectMember:
    from app.repositories.project import ProjectMemberRepository
    repo = ProjectMemberRepository()
    member = await repo.get_by_project_and_user(db, project_id, current_user.id)
    if not member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User is not a member of this project"
        )
    return member

def require_project_role(allowed_roles: list[ProjectRole]):
    async def role_checker(member: ProjectMember = Depends(get_project_member)) -> ProjectMember:
        if member.role not in [role.value for role in allowed_roles]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Required role(s): {[role.value for role in allowed_roles]}"
            )
        return member
    return role_checker
