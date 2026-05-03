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
  delay_estimate_days: number
  budget_overrun_estimate: number
  confidence_score: number
  factors: Record<string, unknown>
}

export interface TasksSummary {
  total: number
  completed: number
  in_progress: number
  pending: number
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
  /** Populated from /dashboard endpoint */
  tasks_summary?: TasksSummary | null
  /** Populated from /prediction endpoint */
  latest_prediction?: LatestPrediction | null
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

export interface CompanyListItem {
  id: string
  company_name: string
}

/** API: ClientResponse from GET /clients */
export interface ClientListItem {
  id: string
  name: string
  contact_email?: string | null
}

/* ── Tasks ── */

/** Backend TaskResponse */
export interface TaskListItem {
  id: string
  /** Backend field is `name` — normalized to `title` in api.ts */
  title: string
  status: TaskStatus
  progress_percentage: number
  start_date?: string | null
  end_date?: string | null
  project_id: string
  assigned_to?: string | null
  assignee?: {
    id: string
    full_name: string
    email: string
  } | null
}

/* ── Logs ── */

/** Backend DailyLogResponse */
export interface LogListItem {
  id: string
  project_id: string
  task_id?: string | null
  created_by_id: string
  date: string
  status: LogStatus
  notes?: string | null
  weather?: string | null
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
}

/* ── Members ── */

/** Backend ProjectMemberResponse — flat, no nested user */
export interface ProjectMemberRow {
  id: string
  user_id: string
  project_id: string
  role: ProjectRole
}

/** Backend ProjectMemberWithUserResponse — includes nested user */
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

/** Frontend-enriched member with user details */
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

export interface MembersResponse {
  total: number
  data: ProjectMemberRow[]
}

/* ── Messages ── */

/** Backend MessageResponse */
export interface MessageRow {
  id: string
  user_id: string
  content: string
  is_read: boolean
  created_at: string
}

export interface MessagesResponse {
  total: number
  data: MessageRow[]
  unread_count?: number
}

/* ── Prediction ── */

export interface PredictionResponse {
  project_id: string
  risk_level: string
  delay_estimate_days: number
  budget_overrun_estimate: number
  confidence_score: number
  factors: Record<string, unknown>
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

/* ── Invitations ── */

export interface InvitationResponse {
  id: string
  project_id: string
  email: string
  role: ProjectRole
  token: string
  status: string
}
