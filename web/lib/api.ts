import { apiRequest } from './api-client'
import type {
  BudgetItemResponse,
  BudgetSummary,
  ClientListItem,
  CompanyListItem,
  CreateProjectResponse,
  EnrichedMemberRow,
  InvitationResponse,
  LogDetailResponse,
  LogListItem,
  MessageRow,
  Paginated,
  PredictionResponse,
  ProjectDetail,
  ProjectListItem,
  ProjectMemberRow,
  ProjectMemberWithUserRow,
  TaskListItem,
  UserMe,
  WeatherResponse,
} from './api-types'
import type { AuthUser, ProjectRole, ProjectStatus } from './domain'

/* ── Constants ── */

const PROJECT_ROLES: ProjectRole[] = [
  'project_manager',
  'consultant',
  'site_engineer',
]

const PROJECT_STATUSES: ProjectStatus[] = [
  'planning',
  'in_progress',
  'completed',
  'on_hold',
]

/* ── Helpers ── */

function parseProjectListRole(v: unknown): ProjectRole {
  if (typeof v === 'string' && PROJECT_ROLES.includes(v as ProjectRole)) return v as ProjectRole
  return 'site_engineer'
}

function parseProjectListStatus(v: unknown): ProjectStatus {
  if (typeof v !== 'string') return 'planning'
  if (PROJECT_STATUSES.includes(v as ProjectStatus)) return v as ProjectStatus
  return 'planning'
}

function parseFiniteNumber(raw: unknown, fallback = 0): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw
  if (typeof raw === 'string' && raw.trim() !== '') {
    const n = Number.parseFloat(raw)
    if (Number.isFinite(n)) return n
  }
  return fallback
}

const q = (params: Record<string, string | number | boolean | undefined>) => {
  const u = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') u.set(k, String(v))
  }
  const s = u.toString()
  return s ? `?${s}` : ''
}

/* ── Normalizers ── */

/** Backend ProjectResponse → frontend ProjectListItem */
function normalizeProjectListItem(raw: unknown): ProjectListItem {
  const r = raw as Record<string, unknown>
  const progress = parseFiniteNumber(r.progress_percentage ?? r.overall_progress_pct)
  const ownerRaw = r.owner_id
  const owner_id = typeof ownerRaw === 'string' ? ownerRaw : ownerRaw != null ? String(ownerRaw) : null

  const clientObj = r.client as Record<string, unknown> | null | undefined

  return {
    id: String(r.id ?? ''),
    name: String(r.name ?? ''),
    status: parseProjectListStatus(r.status),
    overall_progress_pct: progress,
    planned_end_date: (r.planned_end_date as string | null | undefined) ?? null,
    planned_start_date: (r.planned_start_date as string | null | undefined) ?? null,
    location: (r.location as string | null | undefined) ?? null,
    my_role: parseProjectListRole(r.my_role),
    client_name: clientObj ? String(clientObj.name ?? '') : null,
    owner_id,
  }
}

/** Backend ProjectResponse → frontend ProjectDetail */
function normalizeProjectDetail(raw: unknown): ProjectDetail {
  const r = raw as Record<string, unknown>
  const overall_progress_pct = parseFiniteNumber(r.progress_percentage ?? r.overall_progress_pct)

  return {
    id: String(r.id ?? ''),
    name: String(r.name ?? ''),
    description: (r.description as string | null | undefined) ?? null,
    location: String(r.location ?? ''),
    status: parseProjectListStatus(r.status),
    planned_start_date: (r.planned_start_date as string | null | undefined) ?? null,
    planned_end_date: (r.planned_end_date as string | null | undefined) ?? null,
    overall_progress_pct,
    total_budget: parseFiniteNumber(r.total_budget),
    budget_spent: parseFiniteNumber(r.budget_spent),
    client: (r.client as ProjectDetail['client']) ?? null,
    owner_id: r.owner_id ? String(r.owner_id) : null,
  }
}

/** Backend TaskResponse → frontend TaskListItem (name → title) */
function normalizeTaskItem(raw: unknown): TaskListItem {
  const r = raw as Record<string, unknown>
  const assigneeRaw = r.assignee as Record<string, unknown> | null | undefined
  return {
    id: String(r.id ?? ''),
    title: String(r.name ?? r.title ?? ''),
    status: (r.status as TaskListItem['status']) ?? 'pending',
    progress_percentage: parseFiniteNumber(r.progress_percentage),
    start_date: (r.start_date as string | null | undefined) ?? null,
    end_date: (r.end_date as string | null | undefined) ?? null,
    project_id: String(r.project_id ?? ''),
    assigned_to: (r.assigned_to as string | null | undefined) ?? null,
    assignee: assigneeRaw ? {
      id: String(assigneeRaw.id ?? ''),
      full_name: String(assigneeRaw.full_name ?? ''),
      email: String(assigneeRaw.email ?? ''),
    } : null,
  }
}

/** Backend DailyLogResponse → frontend LogListItem */
function normalizeLogItem(raw: unknown): LogListItem {
  const r = raw as Record<string, unknown>
  return {
    id: String(r.id ?? ''),
    project_id: String(r.project_id ?? ''),
    task_id: r.task_id ? String(r.task_id) : null,
    created_by_id: String(r.created_by_id ?? ''),
    date: String(r.date ?? ''),
    status: (r.status as LogListItem['status']) ?? 'draft',
    notes: (r.notes as string | null | undefined) ?? null,
    weather: (r.weather as string | null | undefined) ?? null,
  }
}

/* ── Project visibility ── */

export function projectsVisibleToUser(items: ProjectListItem[], user: AuthUser | null): ProjectListItem[] {
  if (!user) return []
  if (user.is_admin) return items
  return items.filter((p) => p.owner_id != null && p.owner_id === user.id)
}

/* ── Projects ── */

export async function listProjects(params?: {
  status?: string
  skip?: number
  page?: number
  limit?: number
}) {
  const limit = params?.limit
  const skip =
    params?.skip ??
    (params?.page != null && limit != null ? Math.max(0, (params.page - 1) * limit) : undefined)
  const query = q({ status: params?.status, limit, skip })
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

export async function getProject(projectId: string) {
  const raw = await apiRequest<unknown>(`/projects/${projectId}`)
  return normalizeProjectDetail(raw)
}

export async function getProjectDashboard(projectId: string) {
  return apiRequest<{
    id: string
    name: string
    progress_percentage: number
    total_budget: number
    budget_spent: number
    task_summary: { total: number; completed: number; in_progress: number; pending: number }
    delay_risk_status: string
  }>(`/projects/${projectId}/dashboard`)
}

export async function createProject(body: {
  name: string
  total_budget: number
  description?: string | null
  location?: string | null
  planned_start_date?: string | null
  planned_end_date?: string | null
  client_name: string
  client_email: string
}) {
  return apiRequest<CreateProjectResponse>('/projects', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function updateProject(
  projectId: string,
  body: {
    name?: string
    description?: string
    location?: string
    status?: ProjectStatus
    total_budget?: number
    progress_percentage?: number
    budget_spent?: number
    planned_start_date?: string
    planned_end_date?: string
  },
) {
  return apiRequest<unknown>(`/projects/${projectId}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

export async function deleteProject(projectId: string) {
  return apiRequest<void>(`/projects/${projectId}`, { method: 'DELETE' })
}

/* ── Clients ── */

function normalizeClientRow(raw: unknown): ClientListItem {
  const r = raw as Record<string, unknown>
  return {
    id: String(r.id ?? ''),
    name: String(r.name ?? ''),
    contact_email: (r.contact_email as string | null | undefined) ?? null,
  }
}

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

export async function createClient(body: { name: string; contact_email?: string }) {
  return apiRequest<ClientListItem>('/clients', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

/** @deprecated Prefer listClients */
export async function listCompanies(params?: { search?: string; page?: number; limit?: number }) {
  const { data, ...rest } = await listClients(params)
  const mapped: CompanyListItem[] = data.map((c) => ({
    id: c.id,
    company_name: c.name,
  }))
  return { ...rest, data: mapped }
}

/* ── Tasks ── */

export async function listProjectTasks(
  projectId: string,
  params?: { status?: string; assigned_to?: string; page?: number; limit?: number; skip?: number },
) {
  const limit = params?.limit
  const skip =
    params?.skip ??
    (params?.page != null && limit != null ? Math.max(0, (params.page - 1) * limit) : undefined)
  const res = await apiRequest<unknown[]>(
    `/projects/${projectId}/tasks${q({ status: params?.status, assigned_to: params?.assigned_to, limit, skip })}`,
  )
  const data = (Array.isArray(res) ? res : []).map(normalizeTaskItem)
  return {
    total: data.length,
    data,
    page: params?.page,
    limit: params?.limit ?? data.length,
  }
}

export async function createTask(
  projectId: string,
  body: { name: string; status?: string; start_date?: string; end_date?: string; assigned_to?: string },
) {
  return apiRequest<TaskListItem>(`/projects/${projectId}/tasks`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function getTask(taskId: string) {
  const raw = await apiRequest<unknown>(`/projects/tasks/${taskId}`)
  return normalizeTaskItem(raw)
}

export async function updateTask(
  taskId: string,
  body: { name?: string; status?: string; progress_percentage?: number; start_date?: string; end_date?: string; assigned_to?: string },
) {
  return apiRequest<TaskListItem>(`/projects/tasks/${taskId}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

export async function deleteTask(taskId: string) {
  return apiRequest<void>(`/projects/tasks/${taskId}`, { method: 'DELETE' })
}

/* ── Task Dependencies ── */

export async function listTaskDependencies(taskId: string) {
  return apiRequest<{ id: string; task_id: string; depends_on_task_id: string }[]>(
    `/projects/tasks/${taskId}/dependencies`,
  )
}

export async function addTaskDependency(taskId: string, dependsOnTaskId: string) {
  return apiRequest<{ id: string; task_id: string; depends_on_task_id: string }>(
    `/projects/tasks/${taskId}/dependencies`,
    { method: 'POST', body: JSON.stringify({ depends_on_task_id: dependsOnTaskId }) },
  )
}

export async function removeTaskDependency(taskId: string, depId: string) {
  return apiRequest<void>(`/projects/tasks/${taskId}/dependencies/${depId}`, { method: 'DELETE' })
}

/* ── Daily Logs ── */

export async function listProjectLogs(
  projectId: string,
  params?: {
    status?: string
    created_by?: string
    page?: number
    limit?: number
    skip?: number
    start_date?: string
    end_date?: string
  },
) {
  const limit = params?.limit
  const skip =
    params?.skip ??
    (params?.page != null && limit != null ? Math.max(0, (params.page - 1) * limit) : undefined)
  const res = await apiRequest<unknown[]>(
    `/projects/${projectId}/daily-logs${q({ status: params?.status, created_by: params?.created_by, limit, skip, start_date: params?.start_date, end_date: params?.end_date })}`,
  )
  const data = (Array.isArray(res) ? res : []).map(normalizeLogItem)
  return {
    total: data.length,
    data,
    page: params?.page,
    limit: params?.limit ?? data.length,
  }
}

export async function getLog(logId: string) {
  return apiRequest<LogDetailResponse>(`/daily-logs/${logId}`)
}

export async function createDailyLog(
  projectId: string,
  body: { date?: string; notes?: string; weather?: string },
  taskId?: string,
) {
  const path = taskId
    ? `/projects/${projectId}/tasks/${taskId}/daily-logs`
    : `/projects/${projectId}/daily-logs`
  return apiRequest<LogDetailResponse>(path, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

// Daily log workflow transitions
export async function submitLog(logId: string) {
  return apiRequest<LogDetailResponse>(`/daily-logs/${logId}/submit`, { method: 'PATCH' })
}

export async function reviewLog(logId: string) {
  return apiRequest<LogDetailResponse>(`/daily-logs/${logId}/review`, { method: 'PATCH' })
}

export async function consultantApproveLog(logId: string) {
  return apiRequest<LogDetailResponse>(`/daily-logs/${logId}/consultant-approve`, { method: 'PATCH' })
}

export async function pmApproveLog(logId: string) {
  return apiRequest<LogDetailResponse>(`/daily-logs/${logId}/pm-approve`, { method: 'PATCH' })
}

export async function rejectLog(logId: string, rejectionReason: string) {
  return apiRequest<LogDetailResponse>(`/daily-logs/${logId}/reject`, {
    method: 'PATCH',
    body: JSON.stringify({ rejection_reason: rejectionReason }),
  })
}

// Daily log sub-entities
export async function listLogShifts(logId: string) {
  return apiRequest<{ id: string; log_id: string; shift_type: string }[]>(`/daily-logs/${logId}/shifts`)
}

export async function addLogShift(logId: string, body: { shift_type: string }) {
  return apiRequest(`/daily-logs/${logId}/shifts`, { method: 'POST', body: JSON.stringify(body) })
}

export async function listLogLabor(logId: string) {
  return apiRequest<{ id: string; log_id: string; worker_type: string; hours_worked: number; cost: number }[]>(
    `/daily-logs/${logId}/labor`,
  )
}

export async function addLogLabor(logId: string, body: { worker_type: string; hours_worked: number; cost: number }) {
  return apiRequest(`/daily-logs/${logId}/labor`, { method: 'POST', body: JSON.stringify(body) })
}

export async function listLogMaterials(logId: string) {
  return apiRequest<{ id: string; log_id: string; name: string; quantity: number; unit: string; cost: number }[]>(
    `/daily-logs/${logId}/materials`,
  )
}

export async function addLogMaterial(
  logId: string,
  body: { name: string; quantity: number; unit: string; cost: number },
) {
  return apiRequest(`/daily-logs/${logId}/materials`, { method: 'POST', body: JSON.stringify(body) })
}

export async function listLogEquipment(logId: string) {
  return apiRequest<{ id: string; log_id: string; name: string; hours_used: number; cost: number }[]>(
    `/daily-logs/${logId}/equipment`,
  )
}

export async function addLogEquipment(logId: string, body: { name: string; hours_used: number; cost: number }) {
  return apiRequest(`/daily-logs/${logId}/equipment`, { method: 'POST', body: JSON.stringify(body) })
}

/* ── Members ── */

export async function listProjectMembers(projectId: string) {
  const res = await apiRequest<ProjectMemberRow[] | { data: ProjectMemberRow[] }>(
    `/projects/${projectId}/members`,
  )
  const members = Array.isArray(res) ? res : Array.isArray(res.data) ? res.data : []
  return { total: members.length, data: members }
}

/** List members with user details — single API call, no N+1 */
export async function listProjectMembersEnriched(projectId: string): Promise<EnrichedMemberRow[]> {
  const res = await apiRequest<ProjectMemberWithUserRow[]>(
    `/projects/${projectId}/members`,
  )
  const members = Array.isArray(res) ? res : []
  return members.map((m) => ({
    id: m.id,
    user: {
      id: m.user.id,
      full_name: m.user.full_name,
      email: m.user.email,
      phone_number: m.user.phone_number,
    },
    role: m.role,
    project_id: m.project_id,
  }))
}

/* ── Messages ── */

export async function listMessages(params?: {
  is_read?: boolean
  page?: number
  limit?: number
}) {
  const res = await apiRequest<MessageRow[]>(`/messages${q(params || {})}`)
  const data = Array.isArray(res) ? res : []
  const unread_count = data.filter((m) => !m.is_read).length
  return {
    total: data.length,
    data,
    unread_count,
  }
}

export async function markMessageRead(messageId: string) {
  return apiRequest(`/messages/${messageId}/read`, { method: 'PATCH' })
}

/* ── Prediction ── */

export async function getPrediction(projectId: string) {
  return apiRequest<PredictionResponse>(`/projects/${projectId}/prediction`)
}

/* ── Weather ── */

export async function getWeather(projectId: string) {
  return apiRequest<WeatherResponse>(`/projects/${projectId}/weather`)
}

/* ── Budget ── */

export async function getProjectBudget(projectId: string) {
  return apiRequest<BudgetSummary>(`/projects/${projectId}/budget`)
}

export async function listBudgetItems(projectId: string) {
  return apiRequest<BudgetItemResponse[]>(`/projects/${projectId}/budget-items`)
}

export async function createBudgetItem(projectId: string, body: { amount: number; description?: string }) {
  return apiRequest<BudgetItemResponse>(`/projects/${projectId}/budget-items`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

/* ── User profile ── */

export async function updateMe(body: {
  full_name?: string
  phone_number?: string
  email?: string
  password?: string
}) {
  return apiRequest<UserMe>('/users/me', {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

/* ── Project member management ── */

export async function inviteProjectMember(
  projectId: string,
  body: { email: string; role: ProjectRole },
) {
  return apiRequest<InvitationResponse>(
    `/projects/${projectId}/invitations`,
    { method: 'POST', body: JSON.stringify(body) },
  )
}

export async function listProjectInvitations(projectId: string) {
  return apiRequest<InvitationResponse[]>(`/projects/${projectId}/invitations`)
}

export async function addProjectMember(
  projectId: string,
  body: { user_id: string; role: ProjectRole },
) {
  return apiRequest<ProjectMemberRow>(
    `/projects/${projectId}/members`,
    { method: 'POST', body: JSON.stringify(body) },
  )
}

export async function updateMemberRole(
  projectId: string,
  userId: string,
  role: ProjectRole,
) {
  return apiRequest<ProjectMemberRow>(`/projects/${projectId}/members/${userId}`, {
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
  return apiRequest<ProjectMemberRow>('/projects/invitations/accept', {
    method: 'POST',
    body: JSON.stringify({ token }),
  })
}

/* ── Membership-aware project fetching ── */

function extractMemberUserId(m: unknown): string | null {
  if (!m || typeof m !== 'object') return null
  const row = m as Record<string, unknown>
  if (row.user && typeof row.user === 'object' && (row.user as Record<string, unknown>).id) {
    return String((row.user as Record<string, unknown>).id)
  }
  if (row.user_id) return String(row.user_id)
  return null
}

function extractMemberRole(m: unknown): ProjectRole {
  if (!m || typeof m !== 'object') return 'site_engineer'
  const row = m as Record<string, unknown>
  const role = typeof row.role === 'string' ? row.role : ''
  if (role === 'project_manager') return 'project_manager'
  if (PROJECT_ROLES.includes(role as ProjectRole)) return role as ProjectRole
  return 'site_engineer'
}

let _myProjectsCache: { userId: string; ts: number; data: ProjectListItem[] } | null = null
const CACHE_TTL = 5_000

export async function fetchMyProjects(userId: string): Promise<ProjectListItem[]> {
  if (_myProjectsCache && _myProjectsCache.userId === userId && Date.now() - _myProjectsCache.ts < CACHE_TTL) {
    return _myProjectsCache.data
  }

  const { data: allProjects } = await listProjects({ limit: 200 })

  const BATCH_SIZE = 6
  const membersByProject = new Map<string, unknown[]>()

  for (let i = 0; i < allProjects.length; i += BATCH_SIZE) {
    const batch = allProjects.slice(i, i + BATCH_SIZE)
    const results = await Promise.allSettled(
      batch.map(async (p) => {
        const res = await listProjectMembers(p.id)
        const members = Array.isArray(res) ? res : Array.isArray(res.data) ? res.data : []
        return { projectId: p.id, members }
      }),
    )
    for (const result of results) {
      if (result.status === 'fulfilled') {
        membersByProject.set(result.value.projectId, result.value.members)
      }
    }
  }

  const filtered = allProjects
    .filter((p) => {
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

  _myProjectsCache = { userId, ts: Date.now(), data: filtered }
  return filtered
}

export async function fetchProjectRole(
  projectId: string,
  userId: string,
): Promise<{ project: ProjectListItem; role: ProjectRole } | null> {
  try {
    const [rawProject, membersRes] = await Promise.all([
      apiRequest<unknown>(`/projects/${projectId}`),
      listProjectMembers(projectId),
    ])
    const r = rawProject as Record<string, unknown>
    const members = Array.isArray(membersRes)
      ? membersRes
      : Array.isArray(membersRes.data)
        ? membersRes.data
        : []

    const isOwner = r.owner_id === userId || String(r.owner_id) === userId
    const myMember = members.find((m: unknown) => extractMemberUserId(m) === userId)

    if (!isOwner && !myMember) return null

    const role = myMember
      ? extractMemberRole(myMember)
      : isOwner
        ? 'project_manager'
        : 'site_engineer'

    const clientObj = r.client as Record<string, unknown> | null | undefined
    const project: ProjectListItem = {
      id: String(r.id ?? ''),
      name: String(r.name ?? ''),
      status: parseProjectListStatus(r.status),
      location: (r.location as string) ?? '',
      client_name: clientObj ? String(clientObj.name ?? '') : '',
      planned_end_date: (r.planned_end_date as string) ?? '',
      overall_progress_pct: parseFiniteNumber(r.progress_percentage ?? r.overall_progress_pct),
      owner_id: String(r.owner_id ?? ''),
      my_role: role,
    }

    return { project, role }
  } catch {
    return null
  }
}
