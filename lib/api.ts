import { apiRequest } from './api-client'
import type {
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
  TaskListItem,
  UserMe,
} from './api-types'

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

export async function listProjects(params?: { status?: string; page?: number; limit?: number }) {
  return apiRequest<Paginated<ProjectListItem>>(`/projects${q(params || {})}`)
}

export async function getProject(projectId: string) {
  return apiRequest<ProjectDetail>(`/projects/${projectId}`)
}

export async function createProject(body: {
  name: string
  description?: string
  location: string
  latitude?: number
  longitude?: number
  planned_start_date: string
  planned_end_date: string
  client_id: string
  contract_number?: string
}) {
  return apiRequest<CreateProjectResponse>('/projects', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function listCompanies(params?: { search?: string; page?: number; limit?: number }) {
  return apiRequest<Paginated<CompanyListItem>>(`/companies${q(params || {})}`)
}

export async function listProjectTasks(
  projectId: string,
  params?: { status?: string; assigned_to?: string; page?: number; limit?: number },
) {
  return apiRequest<Paginated<TaskListItem>>(`/projects/${projectId}/tasks${q(params || {})}`)
}

export async function listProjectLogs(
  projectId: string,
  params?: {
    task_id?: string
    status?: string
    date_from?: string
    date_to?: string
    page?: number
    limit?: number
  },
) {
  return apiRequest<Paginated<LogListItem>>(`/projects/${projectId}/logs${q(params || {})}`)
}

export async function getLog(logId: string) {
  return apiRequest<LogDetailResponse>(`/logs/${logId}`)
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
