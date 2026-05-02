export type ProjectRole = 'owner' | 'project_manager' | 'office_engineer' | 'consultant' | 'site_engineer'

export type ProjectStatus = 'planning' | 'in_progress' | 'completed' | 'on_hold'

export type TaskStatus = 'pending' | 'in_progress' | 'completed'

export type LogStatus =
  | 'draft'
  | 'submitted'
  | 'reviewed'
  | 'consultant_approved'
  | 'pm_approved'

/** Current user shape used across the app (from GET /users/me). */
export interface AuthUser {
  id: string
  full_name: string
  email: string
  phone_number?: string | null
  is_admin: boolean
  is_active: boolean
  created_at?: string | null
  updated_at?: string | null
}

export const roleLabels: Record<ProjectRole, string> = {
  owner: 'Owner',
  project_manager: 'Project Manager',
  office_engineer: 'Office Engineer',
  consultant: 'Consultant',
  site_engineer: 'Site Engineer',
}

export const statusColors: Record<ProjectStatus, string> = {
  planning: 'bg-gray-100 text-gray-700',
  in_progress: 'bg-green-100 text-green-700',
  completed: 'bg-blue-100 text-blue-700',
  on_hold: 'bg-amber-100 text-amber-700',
}
