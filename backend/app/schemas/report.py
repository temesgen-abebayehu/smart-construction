from datetime import date, datetime
from enum import Enum
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class ReportPeriod(str, Enum):
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    ANNUAL = "annual"
    CUSTOM = "custom"


class ReportSection(str, Enum):
    SUMMARY = "summary"
    PROGRESS = "progress"
    PERFORMANCE = "performance"
    BUDGET = "budget"
    TASKS = "tasks"
    LOOK_AHEAD = "look_ahead"
    LABOR = "labor"
    EQUIPMENT = "equipment"
    MATERIALS = "materials"
    WEATHER = "weather"
    DAILY_LOGS = "daily_logs"
    RISK = "risk"


class PeriodCumulative(BaseModel):
    period: float = 0.0
    cumulative: float = 0.0


class ReportPeriodInfo(BaseModel):
    period: ReportPeriod
    start: datetime
    end: datetime
    label: str
    cut_off: datetime
    project_timezone: str


class ProjectHeader(BaseModel):
    name: str
    client_name: Optional[str] = None
    location: Optional[str] = None
    owner_name: Optional[str] = None
    status: str
    planned_start: Optional[datetime] = None
    planned_end: Optional[datetime] = None
    contract_value: float


class BudgetSnapshot(BaseModel):
    total_budget: float
    budget_spent: float
    total_received: float
    remaining: float


class ExecutiveSummary(BaseModel):
    progress: PeriodCumulative
    planned_progress: Optional[float] = None
    days_elapsed: int
    days_remaining: int
    schedule_variance_days: int
    spi: float
    cpi: float
    budget: BudgetSnapshot
    task_counts: dict[str, int]
    risk_level: Optional[str] = None
    risk_confidence: Optional[float] = None
    weather_days_lost: int = 0


class EarnedValueMetrics(BaseModel):
    spi: float
    cpi: float
    spi_status: str
    cpi_status: str
    planned_value: float
    earned_value: float
    actual_cost: float


class SCurvePoint(BaseModel):
    date: date
    planned_progress: Optional[float] = None
    actual_progress: float
    cumulative_cost: float


class ProgressSection(BaseModel):
    s_curve: list[SCurvePoint]
    progress_this_period: PeriodCumulative
    days_elapsed: int
    days_remaining: int
    schedule_variance_days: int


class ManpowerEntry(BaseModel):
    date: date
    by_trade: dict[str, float]
    total: float


class LaborSection(BaseModel):
    histogram: list[ManpowerEntry]
    total_hours: PeriodCumulative
    total_cost: PeriodCumulative
    by_trade: dict[str, PeriodCumulative]


class EquipmentUsage(BaseModel):
    name: str
    hours_used: float
    hours_idle: float
    utilization_pct: float
    top_idle_reasons: list[dict]


class EquipmentSection(BaseModel):
    by_equipment: list[EquipmentUsage]
    total_hours_used: PeriodCumulative
    total_hours_idle: PeriodCumulative
    total_cost: PeriodCumulative
    overall_utilization_pct: float


class MaterialsSection(BaseModel):
    top_by_cost: list[dict]
    top_by_quantity: list[dict]
    total_cost: PeriodCumulative


class WeatherSection(BaseModel):
    weather_days_lost: int
    weather_breakdown: dict[str, int]
    days_in_period: int


class FinancialSection(BaseModel):
    budget: BudgetSnapshot
    labor_cost: PeriodCumulative
    material_cost: PeriodCumulative
    equipment_cost: PeriodCumulative
    incoming_budget: PeriodCumulative
    burn_rate_per_day: float


class TaskBrief(BaseModel):
    id: UUID
    name: str
    status: str
    progress_percentage: float
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class TasksReport(BaseModel):
    completed_in_period: list[TaskBrief]
    started_in_period: list[TaskBrief]
    overdue: list[TaskBrief]


class LookAheadTask(BaseModel):
    id: UUID
    name: str
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    status: str

    model_config = ConfigDict(from_attributes=True)


class LookAheadSection(BaseModel):
    horizon_days: int
    upcoming_tasks: list[LookAheadTask]


class DailyLogsSummary(BaseModel):
    log_count: int
    by_status: dict[str, int]
    total_labor_hours: float
    total_equipment_hours: float
    equipment_idle_hours: float


class ApprovalInfo(BaseModel):
    status: str = "draft"
    pm_name: Optional[str] = None
    consultant_name: Optional[str] = None
    signed_at: Optional[datetime] = None


class ReportData(BaseModel):
    period: ReportPeriodInfo
    project: ProjectHeader
    summary: ExecutiveSummary
    progress: Optional[ProgressSection] = None
    performance: Optional[EarnedValueMetrics] = None
    financial: Optional[FinancialSection] = None
    tasks: Optional[TasksReport] = None
    look_ahead: Optional[LookAheadSection] = None
    labor: Optional[LaborSection] = None
    equipment: Optional[EquipmentSection] = None
    materials: Optional[MaterialsSection] = None
    weather: Optional[WeatherSection] = None
    daily_logs: Optional[DailyLogsSummary] = None
    risk: Optional[dict] = None
    approval: ApprovalInfo
    generated_at: datetime
    generated_by: str
