import type { LogStatus, ProjectRole, ProjectStatus, TaskStatus } from './domain'

export type { ProjectRole, ProjectStatus, TaskStatus, LogStatus }

/* ── Auth ── */

export interface LoginResponse {
  access_token: string
  refresh_token: string
  token_type: string
}

export interface RefreshResponse {
  access_token: string
  token_type: string
}

export interface RegisterResponse {
  id: string
  full_name: string
  email: string
  is_admin: boolean
  created_at: string
}

/** Backend UserResponse from GET /users/me */
export interface UserMe {
  id: string
  full_name: string
  email: string
  phone_number?: string | null
  is_admin: boolean
  is_active: boolean
  created_at?: string | null
  updated_at?: string | null
}

/* ── Generic ── */

export interface Paginated<T> {
  total: number
  page?: number
  limit?: number
  data: T[]
}

/* ── Projects ── */

export interface ProjectListItem {
  id: string
  name: string
  status: ProjectStatus
  overall_progress_pct: number
  planned_end_date?: string | null
  planned_start_date?: string | null
  location?: string | null
  my_role: ProjectRole
  client_name?: string | null
  owner_id?: string | null
}

export interface ProjectClientRef {
  id: string
  name: string
  contact_email?: string | null
}

export interface ProjectDetail {
  id: string
  name: string
  description?: string | null
  location: string
  status: ProjectStatus
  planned_start_date?: string | null
  planned_end_date?: string | null
  overall_progress_pct: number
  total_budget: number
  budget_spent: number
  client?: ProjectClientRef | null
  owner_id?: string | null
  tasks_summary?: TasksSummary | null
  latest_prediction?: PredictionResponse | null
}

export interface CreateProjectResponse {
  id: string
  name: string
  status: ProjectStatus
  progress_percentage: number
  total_budget: number
  budget_spent: number
  owner_id?: string | null
  created_at?: string
}

export interface TasksSummary {
  total: number
  completed: number
  in_progress: number
  pending: number
}

/** API: ClientResponse from GET /clients */
export interface ClientListItem {
  id: string
  project_id: string
  name: string
  tin_number?: string | null
  address?: string | null
  contact_email?: string | null
  contact_phone?: string | null
}

/* ── Tasks ── */

export interface TaskListItem {
  id: string
  title: string
  status: TaskStatus
  progress_percentage: number
  start_date?: string | null
  end_date?: string | null
  duration_days?: number | null
  allocated_budget?: number | null
  spent_budget?: number | null
  weight?: number
  project_id: string
  assigned_to?: string | null
  assignee?: {
    id: string
    full_name: string
    email: string
  } | null
}

/* ── Task Activities ── */

export interface TaskActivityItem {
  id: string
  task_id: string
  name: string
  percentage: number
  is_completed: boolean
}

export interface TaskBudgetSummary {
  task_id: string
  task_name: string
  allocated_budget: number
  spent_labor: number
  spent_materials: number
  spent_equipment: number
  total_spent: number
  remaining_budget: number
  budget_utilization_pct: number
  status: 'under_budget' | 'on_budget' | 'over_budget'
  log_count: number
}

/* ── Task Dependencies ── */

export interface TaskDependencyItem {
  id: string
  task_id: string
  depends_on_task_id: string
}

/* ── Logs ── */

export interface LogListItem {
  id: string
  project_id: string
  task_id?: string | null
  created_by_id: string
  date: string
  status: LogStatus
  notes?: string | null
  weather?: string | null
  rejection_reason?: string | null
  // Enriched fields for display
  activities_count?: number
  manpower_count?: number
  manpower_cost?: number
  materials_count?: number
  materials_cost?: number
  equipment_count?: number
  equipment_cost?: number
  created_by?: {
    id: string
    full_name: string
    email: string
    phone_number?: string | null
  } | null
}

export interface LogDetailResponse {
  id: string
  project_id: string
  task_id?: string | null
  created_by_id: string
  date: string
  status: LogStatus
  notes?: string | null
  weather?: string | null
  rejection_reason?: string | null
}

/* ── Log Sub-Entities ── */

export interface ManpowerItem {
  id: string
  log_id: string
  worker_type: string
  hours_worked: number
  cost: number
}

export interface MaterialItem {
  id: string
  log_id: string
  name: string
  quantity: number
  unit: string
  cost: number
}

export interface EquipmentItem {
  id: string
  log_id: string
  name: string
  hours_used: number
  cost: number
}

export interface EquipmentIdleItem {
  id: string
  equipment_id: string
  reason: string
  hours_idle: number
}

export interface DailyLogPhoto {
  id: string
  log_id: string
  file_path: string
  url_path: string
  original_filename?: string | null
  content_type?: string | null
  size_bytes?: number | null
  uploaded_by_id?: string | null
  created_at?: string | null
}

/* ── Members ── */

export interface ProjectMemberRow {
  id: string
  user_id: string
  project_id: string
  role: ProjectRole
}

export interface ProjectMemberWithUserRow {
  id: string
  user_id: string
  project_id: string
  role: ProjectRole
  user: {
    id: string
    full_name: string
    email: string
    phone_number?: string | null
  }
}

export interface EnrichedMemberRow {
  id: string
  user: {
    id: string
    full_name: string
    email?: string
    phone_number?: string | null
  }
  role: ProjectRole
  project_id: string
}

/* ── Messages ── */

export interface MessageRow {
  id: string
  user_id: string
  content: string
  is_read: boolean
  created_at: string
}

/* ── Prediction ── */

export interface PredictionResponse {
  project_id: string
  risk_level: string
  delay_estimate_days: number
  budget_overrun_estimate: number
  confidence_score: number
  source: string
  reason: string
  recommendation: string
  factors: Record<string, unknown>
}

export interface WeatherResponse {
  project_id: string
  location: string | null
  resolved_location: string | null
  temperature: number | null
  humidity: number | null
  latitude: number | null
  longitude: number | null
  fetched_at: string | null
  forecast: DailyForecast[]
}

export interface DailyForecast {
  date: string
  temperature_max: number | null
  temperature_min: number | null
  precipitation_sum: number | null
  wind_speed_max: number | null
  weather_code: number | null
}

/* ── Budget ── */

export interface BudgetSummary {
  total_budget: number
  budget_spent: number
  total_received: number
  remaining: number
}

export interface BudgetItemResponse {
  id: string
  project_id: string
  amount: number
  description?: string | null
  created_at: string
}

export interface BudgetPaymentItem {
  id: string
  project_id: string
  payment_amount: number
  payment_date: string
  reference?: string | null
  notes?: string | null
  recorded_by: string
  created_at: string
}

/* ── Invitations ── */

export interface InvitationResponse {
  id: string
  project_id: string
  email: string
  role: ProjectRole
  token: string
  status: string
}

/* ── Suppliers ── */

export interface SupplierItem {
  id: string
  project_id: string
  name: string
  role?: string | null
  tin_number?: string | null
  address?: string | null
  contact_email?: string | null
  contact_phone?: string | null
}

/* ── Reports ── */

export interface ReportManpowerGroup {
  worker_type: string
  total_workers: number
  total_hours: number
  total_cost: number
}

export interface ReportResponse {
  project_id: string
  project_name: string
  project_status: string
  project_location: string
  project_progress: number
  contractor_name: string | null
  start_date: string
  end_date: string
  total_days: number
  manpower: {
    staff: ReportManpowerGroup[]
    technical: ReportManpowerGroup[]
    labor: ReportManpowerGroup[]
  }
  materials: { name: string; quantity: number; unit: string; cost: number }[]
  equipment: { name: string; hours_used: number; hours_idle: number; cost: number }[]
  tasks: { id: string; name: string; status: string; progress_percentage: number; start_date: string | null; end_date: string | null }[]
  tasks_total: number
  tasks_completed: number
  tasks_in_progress: number
  tasks_pending: number
  total_budget: number
  used_budget: number
  remaining_budget: number
  budget_spent_in_period: number
}

/* ── Admin ── */

export interface UserListItem {
  id: string
  full_name: string
  email: string
  phone_number?: string | null
  is_admin: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface SystemSettingsStructured {
  working_hours_per_day: number
  working_days_per_week: number
  overtime_multiplier: number
  delay_risk_threshold_pct: number
  budget_alert_threshold_pct: number
  maintenance_mode: boolean
}

export interface AdminStatsResponse {
  total_users: number
  active_users: number
  total_projects: number
  projects_by_status: Record<string, number>
  total_contractors: number
  total_suppliers: number
  recent_activity_count: number
}

export interface AuditLogItem {
  id: string
  project_id?: string | null
  user_id?: string | null
  action: string
  entity_type?: string | null
  entity_id?: string | null
  details?: string | null
  created_at: string
}

export interface AnnouncementItem {
  id: string
  title: string
  content: string
  priority: string
  is_active: boolean
  created_by: string
  created_at: string
  expires_at?: string | null
}
