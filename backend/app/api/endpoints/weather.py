from datetime import datetime, timezone
from typing import Any
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.api.dependencies import DbSession, get_current_active_user
from app.models.user import User
from app.repositories.project import ProjectRepository
from app.services.weather import get_weather

router = APIRouter()
project_repo = ProjectRepository()


class WeatherResponse(BaseModel):
    project_id: UUID
    location: str | None
    resolved_location: str | None
    temperature: float | None
    humidity: float | None
    latitude: float | None
    longitude: float | None
    fetched_at: datetime | None


@router.get("/{project_id}/weather", response_model=WeatherResponse)
async def get_project_weather(
    project_id: UUID, db: DbSession,
    _: User = Depends(get_current_active_user),
) -> Any:
    project = await project_repo.get_by_id(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    data = await get_weather(project.location)
    if not data:
        raise HTTPException(
            status_code=502,
            detail="Weather data unavailable (location could not be resolved or upstream API failed)",
        )

    return WeatherResponse(
        project_id=project_id,
        location=project.location,
        resolved_location=data["resolved_location"],
        temperature=data["temperature"],
        humidity=data["humidity"],
        latitude=data["latitude"],
        longitude=data["longitude"],
        fetched_at=datetime.fromtimestamp(data["fetched_at"], tz=timezone.utc),
    )
