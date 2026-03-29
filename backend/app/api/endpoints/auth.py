from typing import Any
from fastapi import APIRouter, Depends
from fastapi.security import OAuth2PasswordRequestForm

from app.api.dependencies import DbSession
from app.schemas.user import UserCreate, UserResponse
from app.schemas.token import Token, RefreshTokenRequest
from app.services.user import UserService
from app.core.config import settings
from app.core.security import ALGORITHM, create_access_token, create_refresh_token
import jwt
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
    db: DbSession,
    form_data: OAuth2PasswordRequestForm = Depends()
) -> Any:
    return await UserService.authenticate_user(
        db=db, email=form_data.username, password=form_data.password
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
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid token type")
        
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
            
        user = await UserRepository.get_by_id(db, id=user_id)
        if not user or not user.is_active:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Inactive user")
            
        access_token = create_access_token(subject=user.id)
        new_refresh = create_refresh_token(subject=user.id)
        
        return Token(
            access_token=access_token,
            refresh_token=new_refresh,
            token_type="bearer"
        )
    except (jwt.InvalidTokenError, ValidationError):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Could not validate credentials",
        )
