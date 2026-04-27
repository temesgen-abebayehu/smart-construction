from typing import Any
from fastapi import APIRouter

from app.api.dependencies import DbSession
from app.schemas.user import UserCreate, UserResponse
from app.schemas.token import Token, LoginRequest, RefreshTokenRequest
from app.services.user import UserService
from app.core.config import settings
from app.core.security import ALGORITHM, create_access_token, create_refresh_token
import jwt
from jwt.exceptions import ExpiredSignatureError, InvalidTokenError
from pydantic import ValidationError
from fastapi import HTTPException, status
from app.repositories.user import UserRepository

router = APIRouter()

@router.post("/register", response_model=UserResponse, status_code=201)
async def register_user(
    *,
    db: DbSession,
    user_in: UserCreate,
) -> Any:
    return await UserService.create_user(db=db, user_in=user_in)

@router.post("/login", response_model=Token)
async def login_access_token(
    *,
    db: DbSession,
    login_in: LoginRequest,
) -> Any:
    return await UserService.authenticate_user(
        db=db, email=login_in.email, password=login_in.password
    )

@router.post("/refresh", response_model=Token)
async def refresh_token_endpoint(
    *,
    db: DbSession,
    request: RefreshTokenRequest,
) -> Any:
    """
    Acquire a new access and refresh token pair using a valid refresh token.
    """    
    try:
        payload = jwt.decode(
            request.refresh_token, settings.SECRET_KEY, algorithms=[ALGORITHM]
        )
        if payload.get("type") != "refresh":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token type",
                headers={"WWW-Authenticate": "Bearer"},
            )

        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid refresh token",
                headers={"WWW-Authenticate": "Bearer"},
            )

        user = await UserRepository.get_by_id(db, id=user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User no longer exists",
                headers={"WWW-Authenticate": "Bearer"},
            )
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Inactive user",
            )

        access_token = create_access_token(subject=user.id)
        new_refresh = create_refresh_token(subject=user.id)

        return Token(
            access_token=access_token,
            refresh_token=new_refresh,
            token_type="bearer"
        )
    except ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except (InvalidTokenError, ValidationError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
