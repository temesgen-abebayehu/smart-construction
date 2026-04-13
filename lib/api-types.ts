import type { LogStatus, ProjectRole, ProjectStatus, TaskStatus } from './domain'

export type { ProjectRole, ProjectStatus, TaskStatus, LogStatus }

export interface LoginResponse {
  access_token: string
  refresh_token: string
  token_type: string
  expires_in: number
}

export interface RefreshResponse {
  access_token: string
  token_type: string
  expires_in: number
}

export interface RegisterResponse {
  id: string
  full_name: string
  email: string
  is_admin: boolean
  created_at: string
}

export interface UserMe {
  id: string
  full_name: string
  email: string
  phone?: string | null
  profile_photo_url?: string | null
  is_admin: boolean
  is_active: boolean
  last_login_at?: string | null
}

export interface Paginated<T> {
  total: number
  page?: number
  limit?: number
  data: T[]
}

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
  /** Present on API `ProjectResponse`; used to scope list until backend filters GET /projects. */
  owner_id?: string | null
}

export interface ProjectClientRef {
  id: string
  name: string
}

export interface ProjectManagerRef {
  id: string
  full_name: string
}

export interface ProjectBudget {
  contract_value: number
  total_spent: number
  total_received: number
}

export interface LatestPrediction {
  risk_level: string
  reason: string
  estimated_delay_days?: number
  budget_overrun_pct?: number
  recommendation?: string
}

export interface TasksSummary {
  total: number
  completed: number
  delayed: number
  in_progress: number
}

export interface ProjectDetail {
  id: string
  name: string
  description?: string | null
  location: string
  status: ProjectStatus
  planned_start_date?: string | null
  planned_end_date?: string | null
  actual_start_date?: string | null
  actual_end_date?: string | null
  overall_progress_pct: number
  contract_number?: string | null
  client?: ProjectClientRef | null
  project_manager?: ProjectManagerRef | null
  budget?: ProjectBudget | null
  latest_prediction?: LatestPrediction | null
  tasks_summary?: TasksSummary | null
  pending_log_approvals?: number | null
}

export interface CreateProjectResponse {
  id: string
  name: string
  status: ProjectStatus
  overall_progress_pct: number
  created_at: string
}

export interface CompanyListItem {
  id: string
  company_name: string
  total_projects_completed?: number
  active_projects?: number
}

/** API: `ClientResponse` from GET /clients */
export interface ClientListItem {
  id: string
  name: string
  contact_email?: string | null
}

export interface TaskListItem {
  id: string
  title: string
  status: TaskStatus
  planned_start_date: string
  planned_end_date: string
  actual_start_date?: string | null
  allocated_budget: number
  spent_budget: number
  weight_pct: number
  cumulative_progress_pct: number
  assigned_to?: { id?: string; full_name: string } | null
}

export interface LogListItem {
  id: string
  task?: { title: string; id?: string } | null
  log_date: string
  status: LogStatus
  progress_pct_today: number
  remarks?: string | null
  submitted_by?: { full_name: string; id?: string } | null
}

export interface ProjectMemberRow {
  id?: string
  user: {
    id: string
    full_name: string
    profile_photo_url?: string | null
    email?: string
    phone?: string | null
  }
  role: ProjectRole
  joined_at?: string
}

export interface MembersResponse {
  total: number
  data: ProjectMemberRow[]
}

export interface MessageRow {
  id: string
  type: string
  title: string
  body: string
  project_id?: string | null
  entity_id?: string | null
  is_read: boolean
  created_at: string
}

export interface MessagesResponse extends Paginated<MessageRow> {
  unread_count?: number
}

export interface LogDetailResponse {
  id: string
  task?: { id: string; title: string } | null
  log_date: string
  status: LogStatus
  activities: string[] | string
  progress_pct_today: number
  remarks?: string | null
  photos?: string[] | null
  submitted_by?: { full_name: string; id?: string } | null
  approval_chain?: Record<string, unknown>
}

export interface PredictionResponse {
  risk_level: string
  reason: string
  estimated_delay_days?: number
  budget_overrun_pct?: number
  recommendation?: string
  computed_at?: string
}
