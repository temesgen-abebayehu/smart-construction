import { apiRequest } from './api-client'
import type {
  ClientListItem,
  CompanyListItem,
  CreateProjectResponse,
  LogDetailResponse,
  LogListItem,
  MembersResponse,
  MessagesResponse,
  Paginated,
  PredictionResponse,
  ProjectDetail,
  ProjectListItem,
  ProjectMemberRow,
  TaskListItem,
  UserMe,
} from './api-types'
import type { AuthUser, ProjectRole, ProjectStatus } from './domain'

const PROJECT_ROLES: ProjectRole[] = [
  'project_manager',
  'office_engineer',
  'consultant',
  'site_engineer',
]

const PROJECT_STATUSES: ProjectStatus[] = [
  'draft',
  'active',
  'at_risk',
  'delayed',
  'completed',
  'cancelled',
]

function parseProjectListRole(v: unknown): ProjectRole {
  return typeof v === 'string' && PROJECT_ROLES.includes(v as ProjectRole)
    ? (v as ProjectRole)
    : 'site_engineer'
}

function parseProjectListStatus(v: unknown): ProjectStatus {
  if (typeof v !== 'string') return 'active'
  if (PROJECT_STATUSES.includes(v as ProjectStatus)) return v as ProjectStatus
  if (v === 'planning') return 'draft'
  return 'active'
}

function parseOverallProgressPct(raw: unknown): number {
  const v = raw
  if (typeof v === 'number' && !Number.isNaN(v)) return v
  if (typeof v === 'string') {
    const n = parseFloat(v)
    if (!Number.isNaN(n)) return n
  }
  return 0
}

function parseFiniteNumber(raw: unknown, fallback = 0): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw
  if (typeof raw === 'string' && raw.trim() !== '') {
    const n = Number.parseFloat(raw)
    if (Number.isFinite(n)) return n
  }
  return fallback
}

/** List endpoint may return OpenAPI `ProjectResponse` (e.g. `progress_percentage`) without `my_role`. */
function normalizeProjectListItem(raw: unknown): ProjectListItem {
  const r = raw as Record<string, unknown>
  const progress = parseOverallProgressPct(
    r.overall_progress_pct ?? r.progress_percentage ?? r.progress_pct,
  )
  const ownerRaw = r.owner_id
  const owner_id =
    typeof ownerRaw === 'string' ? ownerRaw : ownerRaw != null ? String(ownerRaw) : null

  return {
    id: String(r.id ?? ''),
    name: String(r.name ?? ''),
    status: parseProjectListStatus(r.status),
    overall_progress_pct: progress,
    planned_end_date: (r.planned_end_date as string | null | undefined) ?? null,
    planned_start_date: (r.planned_start_date as string | null | undefined) ?? null,
    location: (r.location as string | null | undefined) ?? null,
    my_role: parseProjectListRole(r.my_role),
    client_name: (r.client_name as string | null | undefined) ?? null,
    owner_id,
  }
}

/**
 * Deployed GET /projects returns all rows. Until the API scopes by membership, non-admins only see
 * projects they own. Admins keep full list. Non-owner collaborators need backend support (e.g. my_role on list or /me/projects).
 */
export function projectsVisibleToUser(items: ProjectListItem[], user: AuthUser | null): ProjectListItem[] {
  if (!user) return []
  if (user.is_admin) return items
  return items.filter((p) => p.owner_id != null && p.owner_id === user.id)
}

const q = (params: Record<string, string | number | boolean | undefined>) => {
  const u = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') u.set(k, String(v))
  }
  const s = u.toString()
  return s ? `?${s}` : ''
}

export function parseActivitiesField(activities: string[] | string | undefined | null): string[] {
  if (activities == null) return []
  if (Array.isArray(activities)) return activities
  try {
    const parsed = JSON.parse(activities) as unknown
    return Array.isArray(parsed) ? (parsed as string[]) : [activities]
  } catch {
    return [activities]
  }
}

export async function listProjects(params?: {
  status?: string
  /** Offset; API uses `skip` (not `page`). */
  skip?: number
  page?: number
  limit?: number
}) {
  const limit = params?.limit
  const skip =
    params?.skip ??
    (params?.page != null && limit != null ? Math.max(0, (params.page - 1) * limit) : undefined)
  const query = q({
    status: params?.status,
    limit,
    skip,
  })
  const res = await apiRequest<Paginated<ProjectListItem> | ProjectListItem[]>(`/projects${query}`)
  if (Array.isArray(res)) {
    return {
      total: res.length,
      data: res.map(normalizeProjectListItem),
      page: params?.page,
      limit: params?.limit ?? res.length,
    }
  }
  const data = (Array.isArray(res.data) ? res.data : []).map(normalizeProjectListItem)
  return {
    total: res.total ?? data.length,
    page: res.page,
    limit: res.limit,
    data,
  }
}

/**
 * GET /projects/{id} returns OpenAPI `ProjectResponse` (`progress_percentage`, `total_budget`, `budget_spent`),
 * while the app expects `ProjectDetail` (`overall_progress_pct`, `budget`, …).
 */
function normalizeProjectDetail(raw: unknown): ProjectDetail {
  const r = raw as Record<string, unknown>
  const overall_progress_pct = parseOverallProgressPct(
    r.overall_progress_pct ?? r.progress_percentage ?? r.progress_pct,
  )

  const nestedBudget = r.budget
  let budget: ProjectDetail['budget'] | null = null
  if (
    nestedBudget &&
    typeof nestedBudget === 'object' &&
    nestedBudget !== null &&
    'contract_value' in (nestedBudget as object)
  ) {
    const b = nestedBudget as { contract_value?: unknown; total_spent?: unknown; total_received?: unknown }
    budget = {
      contract_value: parseFiniteNumber(b.contract_value),
      total_spent: parseFiniteNumber(b.total_spent),
      total_received: parseFiniteNumber(b.total_received),
    }
  } else if (r.total_budget != null || r.budget_spent != null) {
    budget = {
      contract_value: parseFiniteNumber(r.total_budget),
      total_spent: parseFiniteNumber(r.budget_spent),
      total_received: parseFiniteNumber((r as { total_received?: unknown }).total_received),
    }
  }

  return {
    id: String(r.id ?? ''),
    name: String(r.name ?? ''),
    description: (r.description as string | null | undefined) ?? null,
    location: String(r.location ?? ''),
    status: parseProjectListStatus(r.status),
    planned_start_date: (r.planned_start_date as string | null | undefined) ?? null,
    planned_end_date: (r.planned_end_date as string | null | undefined) ?? null,
    actual_start_date: (r.actual_start_date as string | null | undefined) ?? null,
    actual_end_date: (r.actual_end_date as string | null | undefined) ?? null,
    overall_progress_pct,
    contract_number: (r.contract_number as string | null | undefined) ?? null,
    client: (r.client as ProjectDetail['client']) ?? null,
    project_manager: (r.project_manager as ProjectDetail['project_manager']) ?? null,
    budget,
    latest_prediction: (r.latest_prediction as ProjectDetail['latest_prediction']) ?? null,
    tasks_summary: (r.tasks_summary as ProjectDetail['tasks_summary']) ?? null,
    pending_log_approvals:
      typeof r.pending_log_approvals === 'number' ? r.pending_log_approvals : null,
  }
}

export async function getProject(projectId: string) {
  const raw = await apiRequest<unknown>(`/projects/${projectId}`)
  return normalizeProjectDetail(raw)
}

export async function createProject(body: {
  name: string
  /** Required by API (`ProjectCreate`). */
  total_budget: number
  description?: string | null
  location?: string | null
  latitude?: number
  longitude?: number
  /** ISO 8601 date-time string (e.g. `2025-04-11T00:00:00`). */
  planned_start_date?: string | null
  planned_end_date?: string | null
  client_id?: string | null
}) {
  return apiRequest<CreateProjectResponse>('/projects', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

function normalizeClientRow(raw: unknown): ClientListItem {
  const r = raw as Record<string, unknown>
  return {
    id: String(r.id ?? ''),
    name: String(r.name ?? ''),
    contact_email: (r.contact_email as string | null | undefined) ?? null,
  }
}

/** GET /clients — returns an array per OpenAPI; supports optional local `search` filter. */
export async function listClients(params?: {
  search?: string
  skip?: number
  page?: number
  limit?: number
}) {
  const limit = params?.limit
  const skip =
    params?.skip ??
    (params?.page != null && limit != null ? Math.max(0, (params.page - 1) * limit) : undefined)
  const res = await apiRequest<ClientListItem[] | Paginated<ClientListItem>>(`/clients${q({ limit, skip })}`)
  let rows: ClientListItem[]
  if (Array.isArray(res)) {
    rows = res.map(normalizeClientRow)
  } else {
    rows = (Array.isArray(res.data) ? res.data : []).map(normalizeClientRow)
  }
  if (params?.search?.trim()) {
    const s = params.search.trim().toLowerCase()
    rows = rows.filter((r) => r.name.toLowerCase().includes(s))
  }
  return {
    total: rows.length,
    data: rows,
    page: params?.page,
    limit: params?.limit ?? rows.length,
  }
}

/** @deprecated Prefer `listClients` — backend route is `/api/v1/clients`. */
export async function listCompanies(params?: { search?: string; page?: number; limit?: number }) {
  const { data, ...rest } = await listClients(params)
  const mapped: CompanyListItem[] = data.map((c) => ({
    id: c.id,
    company_name: c.name,
  }))
  return { ...rest, data: mapped }
}

export async function listProjectTasks(
  projectId: string,
  params?: { status?: string; assigned_to?: string; page?: number; limit?: number; skip?: number },
) {
  const limit = params?.limit
  const skip =
    params?.skip ??
    (params?.page != null && limit != null ? Math.max(0, (params.page - 1) * limit) : undefined)
  const res = await apiRequest<TaskListItem[] | Paginated<TaskListItem>>(
    `/projects/${projectId}/tasks${q({ status: params?.status, limit, skip })}`,
  )
  if (Array.isArray(res)) {
    return {
      total: res.length,
      data: res,
      page: params?.page,
      limit: params?.limit ?? res.length,
    }
  }
  const data = Array.isArray(res.data) ? res.data : []
  return {
    total: res.total ?? data.length,
    page: res.page,
    limit: res.limit,
    data,
  }
}

/** OpenAPI: `GET /projects/{project_id}/daily-logs` returns an array of daily logs. */
export async function listProjectLogs(
  projectId: string,
  params?: {
    task_id?: string
    status?: string
    date_from?: string
    date_to?: string
    page?: number
    limit?: number
    skip?: number
  },
) {
  const limit = params?.limit
  const skip =
    params?.skip ??
    (params?.page != null && limit != null ? Math.max(0, (params.page - 1) * limit) : undefined)
  const res = await apiRequest<LogListItem[] | Paginated<LogListItem>>(
    `/projects/${projectId}/daily-logs${q({ status: params?.status, limit, skip })}`,
  )
  if (Array.isArray(res)) {
    return {
      total: res.length,
      data: res,
      page: params?.page,
      limit: params?.limit ?? res.length,
    }
  }
  const data = Array.isArray(res.data) ? res.data : []
  return {
    total: res.total ?? data.length,
    page: res.page,
    limit: res.limit,
    data,
  }
}

export async function getLog(logId: string) {
  return apiRequest<LogDetailResponse>(`/daily-logs/${logId}`)
}

export async function listProjectMembers(projectId: string) {
  return apiRequest<MembersResponse>(`/projects/${projectId}/members`)
}

export async function listMessages(params?: {
  is_read?: boolean
  type?: string
  project_id?: string
  page?: number
  limit?: number
}) {
  return apiRequest<MessagesResponse>(`/messages${q(params || {})}`)
}

export async function markMessageRead(messageId: string) {
  return apiRequest(`/messages/${messageId}/read`, { method: 'POST' })
}

export async function markAllMessagesRead() {
  return apiRequest<{ message?: string; count?: number }>('/messages/read-all', {
    method: 'POST',
  })
}

export async function getPrediction(projectId: string) {
  return apiRequest<PredictionResponse>(`/projects/${projectId}/prediction`)
}

export async function updateMe(body: {
  full_name?: string
  phone?: string
  profile_photo_url?: string
  password?: string
  current_password?: string
}) {
  return apiRequest<{ message?: string; user: UserMe }>('/users/me', {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

/* ------------------------------------------------------------------ */
/*  Project member management                                         */
/* ------------------------------------------------------------------ */

export async function inviteProjectMember(
  projectId: string,
  body: { email: string; role: ProjectRole },
) {
  return apiRequest<{ id: string; email: string; role: string; status: string }>(
    `/projects/${projectId}/invitations`,
    { method: 'POST', body: JSON.stringify(body) },
  )
}

export async function listProjectInvitations(projectId: string) {
  return apiRequest<{ id: string; email: string; role: string; status: string; token?: string }[]>(
    `/projects/${projectId}/invitations`,
  )
}

export async function addProjectMember(
  projectId: string,
  body: { user_id: string; role: ProjectRole },
) {
  return apiRequest<{ user_id: string; role: string; id: string; project_id: string }>(
    `/projects/${projectId}/members`,
    { method: 'POST', body: JSON.stringify(body) },
  )
}

export async function updateMemberRole(
  projectId: string,
  userId: string,
  role: ProjectRole,
) {
  return apiRequest<unknown>(`/projects/${projectId}/members/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  })
}

export async function removeMember(projectId: string, userId: string) {
  return apiRequest<void>(`/projects/${projectId}/members/${userId}`, {
    method: 'DELETE',
  })
}

export async function acceptInvitation(token: string) {
  return apiRequest<unknown>('/projects/invitations/accept', {
    method: 'POST',
    body: JSON.stringify({ token }),
  })
}

/* ------------------------------------------------------------------ */
/*  Membership-aware project fetching                                 */
/* ------------------------------------------------------------------ */

function extractMemberUserId(m: unknown): string | null {
  if (!m || typeof m !== 'object') return null
  const row = m as Record<string, unknown>
  // Nested user object (full response)
  if (row.user && typeof row.user === 'object' && (row.user as Record<string, unknown>).id) {
    return String((row.user as Record<string, unknown>).id)
  }
  // Flat user_id field
  if (row.user_id) return String(row.user_id)
  return null
}

function extractMemberRole(m: unknown): ProjectRole {
  if (!m || typeof m !== 'object') return 'site_engineer'
  const row = m as Record<string, unknown>
  const role = typeof row.role === 'string' ? row.role : ''
  if (role === 'owner' || role === 'project_manager') return 'project_manager'
  if (PROJECT_ROLES.includes(role as ProjectRole)) return role as ProjectRole
  return 'site_engineer'
}

/**
 * Fetch all projects the current user belongs to (as owner or member).
 * Works around the lack of a backend `GET /users/me/projects` endpoint
 * by fetching all projects then checking membership in parallel.
 */
export async function fetchMyProjects(userId: string): Promise<ProjectListItem[]> {
  const { data: allProjects } = await listProjects({ limit: 200 })

  const memberChecks = await Promise.allSettled(
    allProjects.map(async (p) => {
      const res = await listProjectMembers(p.id)
      const members = Array.isArray(res) ? res : Array.isArray(res.data) ? res.data : []
      return { projectId: p.id, members }
    }),
  )

  const membersByProject = new Map<string, unknown[]>()
  for (const result of memberChecks) {
    if (result.status === 'fulfilled') {
      membersByProject.set(result.value.projectId, result.value.members)
    }
  }

  return allProjects
    .filter((p) => {
      // Owner always sees their projects
      if (p.owner_id === userId) return true
      const members = membersByProject.get(p.id)
      if (!members) return false
      return members.some((m) => extractMemberUserId(m) === userId)
    })
    .map((p) => {
      const members = membersByProject.get(p.id)
      const myMember = members?.find((m) => extractMemberUserId(m) === userId)
      const myRole = myMember
        ? extractMemberRole(myMember)
        : p.owner_id === userId
          ? 'project_manager'
          : p.my_role
      return { ...p, my_role: myRole }
    })
}
