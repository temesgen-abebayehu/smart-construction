import logging

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from sqlalchemy.exc import IntegrityError

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)

from app.core.config import settings
from app.api.routes import api_router
from app.database.session import engine
from app.models.user import Base

# Import all model modules so their tables register into Base.metadata
import app.models.user
import app.models.project
import app.models.task
import app.models.log
import app.models.system

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Drop and recreate all tables to sync with new schema
    # Remove drop_all once you switch to Alembic migrations!
    async with engine.begin() as conn:
        # await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan
)

@app.exception_handler(IntegrityError)
async def integrity_exception_handler(request: Request, exc: IntegrityError):
    """
    Global handler for database integrity errors (Foreign Key, Unique constraints).
    """
    detail = str(exc.orig)
    
    # Custom parsing for common asyncpg / sqlalchemy error messages
    if "is not present in table" in detail:
        return JSONResponse(
            status_code=400,
            content={"detail": "Reference error: The related record (ID) does not exist."},
        )
    if "already exists" in detail:
        return JSONResponse(
            status_code=409,
            content={"detail": "Conflict error: One or more fields already exist (Unique constraint violated)."},
        )
        
    return JSONResponse(
        status_code=400,
        content={"detail": f"Database integrity error: {detail}"},
    )


# Set all CORS enabled origins
if settings.BACKEND_CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[str(origin) for origin in settings.BACKEND_CORS_ORIGINS],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

app.include_router(api_router, prefix=settings.API_V1_STR)

@app.get("/")
def root():
    return {"message": "Welcome to Smart Construction API"}
