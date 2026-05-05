"""
Self-contained OAuth endpoints. Currently exposes Google Sign-In.

POST /auth/google handles BOTH login and register transparently:
- If a user with the verified Google account already exists → login.
- If not → create the user, then login.

Returns the same Token shape as /auth/login.
"""
from typing import Any
from fastapi import APIRouter

from app.api.dependencies import DbSession
from app.schemas.token import Token, GoogleSignInRequest
from app.services.google_oauth import GoogleOAuthService

router = APIRouter()


@router.post("/google", response_model=Token)
async def sign_in_with_google(*, db: DbSession, body: GoogleSignInRequest) -> Any:
    return await GoogleOAuthService.sign_in_with_google(db, id_token_str=body.id_token)
