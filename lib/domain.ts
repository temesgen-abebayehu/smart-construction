export type ProjectRole = 'project_manager' | 'office_engineer' | 'consultant' | 'site_engineer'

export type ProjectStatus = 'draft' | 'active' | 'at_risk' | 'delayed' | 'completed' | 'cancelled'

export type TaskStatus =
  | 'not_started'
  | 'pending_dependency'
  | 'in_progress'
  | 'delayed'
  | 'completed'
  | 'cancelled'

export type LogStatus =
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'consultant_approved'
  | 'approved'
  | 'rejected'

/** Current user shape used across the app (from GET /users/me). */
export interface AuthUser {
  id: string
  full_name: string
  email: string
  phone?: string | null
  profile_photo_url?: string | null
  is_admin: boolean
  is_active: boolean
  last_login_at?: string | null
}

export const roleLabels: Record<ProjectRole, string> = {
  project_manager: 'Project Manager',
  office_engineer: 'Office Engineer',
  consultant: 'Consultant',
  site_engineer: 'Site Engineer',
}

export const statusColors: Record<ProjectStatus, string> = {
  draft: 'bg-gray-100 text-gray-700',
  active: 'bg-green-100 text-green-700',
  at_risk: 'bg-amber-100 text-amber-700',
  delayed: 'bg-red-100 text-red-700',
  completed: 'bg-blue-100 text-blue-700',
  cancelled: 'bg-gray-100 text-gray-500',
}
