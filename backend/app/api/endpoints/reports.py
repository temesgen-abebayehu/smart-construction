import logging
import re
from datetime import date, timezone
from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse

from app.api.dependencies import DbSession, get_current_active_user, require_project_role
from app.models.commons import ProjectRole
from app.models.user import User
from app.repositories.project import ProjectRepository
from app.schemas.report import ReportData, ReportPeriod, ReportSection
from app.services.report_data import build_report_data, maybe_capture_snapshot
from app.services.report_renderer import render_report_pdf

logger = logging.getLogger(__name__)
router = APIRouter()
project_repo = ProjectRepository()

REPORT_ROLES = [
    ProjectRole.OWNER,
    ProjectRole.PROJECT_MANAGER,
    ProjectRole.OFFICE_ENGINEER,
    ProjectRole.CONSULTANT,
]


def _safe_filename(name: str) -> str:
    return re.sub(r"[^A-Za-z0-9._-]+", "_", name).strip("_") or "report"


def _resolve_sections(sections: list[ReportSection] | None) -> set[ReportSection]:
    return set(sections) if sections else set(ReportSection)


def _to_utc(dt):
    return dt.astimezone(timezone.utc)


@router.get(
    "/{project_id}/reports/preview",
    response_model=ReportData,
    summary="Preview report data as JSON before downloading the PDF",
    dependencies=[Depends(require_project_role(REPORT_ROLES))],
)
async def preview_report(
    project_id: UUID,
    db: DbSession,
    period: Annotated[ReportPeriod, Query(description="daily | weekly | monthly | annual | custom")] = ReportPeriod.MONTHLY,
    start: Annotated[date | None, Query(description="Anchor date — server snaps to period boundary")] = None,
    end: Annotated[date | None, Query(description="Required only when period=custom")] = None,
    sections: Annotated[list[ReportSection] | None, Query(description="Omit to include all sections")] = None,
    current_user: User = Depends(get_current_active_user),
) -> Any:
    project = await project_repo.get_by_id(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    try:
        return await build_report_data(
            db, project, period, start, end, _resolve_sections(sections), current_user,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get(
    "/{project_id}/reports/download",
    summary="Download the report as a PDF",
    responses={200: {"content": {"application/pdf": {}}}},
    dependencies=[Depends(require_project_role(REPORT_ROLES))],
)
async def download_report(
    project_id: UUID,
    db: DbSession,
    period: Annotated[ReportPeriod, Query(description="daily | weekly | monthly | annual | custom")] = ReportPeriod.MONTHLY,
    start: Annotated[date | None, Query(description="Anchor date — server snaps to period boundary")] = None,
    end: Annotated[date | None, Query(description="Required only when period=custom")] = None,
    sections: Annotated[list[ReportSection] | None, Query(description="Omit to include all sections")] = None,
    current_user: User = Depends(get_current_active_user),
) -> StreamingResponse:
    project = await project_repo.get_by_id(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    try:
        data = await build_report_data(
            db, project, period, start, end, _resolve_sections(sections), current_user,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    try:
        await maybe_capture_snapshot(db, project, _to_utc(data.period.cut_off))
    except Exception as e:  # snapshot is best-effort, never block the download
        logger.warning("snapshot capture failed for project %s: %s", project_id, e)

    pdf_bytes = render_report_pdf(data)
    filename = _safe_filename(f"{project.name}_{data.period.period.value}_{data.period.end.date()}") + ".pdf"
    headers = {"Content-Disposition": f'attachment; filename="{filename}"'}
    return StreamingResponse(iter([pdf_bytes]), media_type="application/pdf", headers=headers)
