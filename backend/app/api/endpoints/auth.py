from typing import Any
from datetime import timedelta
from fastapi import APIRouter
import asyncio

from app.api.dependencies import DbSession
from app.schemas.user import UserCreate, UserResponse
from app.schemas.token import Token, LoginRequest, RefreshTokenRequest
from app.services.user import UserService
from app.core.config import settings
from app.core.security import ALGORITHM, create_access_token, create_refresh_token, get_password_hash
from app.core.email import send_password_reset_email
from pydantic import BaseModel, EmailStr
import jwt
from jwt.exceptions import ExpiredSignatureError, InvalidTokenError
from pydantic import ValidationError
from fastapi import HTTPException, status
from app.repositories.user import UserRepository

router = APIRouter()

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

@router.post("/register", response_model=UserResponse, status_code=201, summary="Register a new user")
async def register_user(
    *,
    db: DbSession,
    user_in: UserCreate,
) -> Any:
    return await UserService.create_user(db=db, user_in=user_in)

@router.post("/login", response_model=Token, summary="Login and get access token")
async def login_access_token(
    *,
    db: DbSession,
    login_in: LoginRequest,
) -> Any:
    return await UserService.authenticate_user(
        db=db, email=login_in.email, password=login_in.password
    )

@router.post("/refresh", response_model=Token, summary="Refresh access token")
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


@router.post("/forgot-password", summary="Request password reset email")
async def forgot_password(*, db: DbSession, body: ForgotPasswordRequest) -> Any:
    """Send a password reset link to the user's email."""
    user = await UserRepository.get_by_email(db, email=body.email)
    # Always return success to prevent email enumeration
    if user:
        # Create a short-lived token (15 minutes)
        reset_token = jwt.encode(
            {
                "sub": str(user.id),
                "type": "password_reset",
                "exp": __import__("datetime").datetime.now(__import__("datetime").timezone.utc)
                + timedelta(minutes=15),
            },
            settings.SECRET_KEY,
            algorithm=ALGORITHM,
        )
        loop = asyncio.get_event_loop()
        loop.run_in_executor(None, send_password_reset_email, body.email, reset_token)
    return {"message": "If an account with that email exists, a reset link has been sent."}


@router.post("/reset-password", summary="Reset password with token")
async def reset_password(*, db: DbSession, body: ResetPasswordRequest) -> Any:
    """Reset password using a token from the email link."""
    try:
        payload = jwt.decode(body.token, settings.SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") != "password_reset":
            raise HTTPException(status_code=400, detail="Invalid reset token")
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=400, detail="Invalid reset token")
    except ExpiredSignatureError:
        raise HTTPException(status_code=400, detail="Reset link has expired. Please request a new one.")
    except (InvalidTokenError, ValidationError):
        raise HTTPException(status_code=400, detail="Invalid reset token")

    user = await UserRepository.get_by_id(db, id=user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.hashed_password = get_password_hash(body.new_password)
    db.add(user)
    await db.commit()
    return {"message": "Password has been reset successfully."}
