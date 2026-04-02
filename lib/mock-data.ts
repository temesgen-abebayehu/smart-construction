// Mock data for Smart Construction Management Platform

export type ProjectRole = 'project_manager' | 'office_engineer' | 'consultant' | 'site_engineer'

export type ProjectStatus = 'draft' | 'active' | 'at_risk' | 'delayed' | 'completed' | 'cancelled'

export type TaskStatus = 'not_started' | 'pending_dependency' | 'in_progress' | 'delayed' | 'completed' | 'cancelled'

export type LogStatus = 'draft' | 'submitted' | 'under_review' | 'consultant_approved' | 'approved' | 'rejected'

export interface User {
  id: string
  full_name: string
  email: string
  phone?: string
  profile_photo_url?: string
  is_admin: boolean
  is_active: boolean
}

export interface Project {
  id: string
  name: string
  description?: string
  location: string
  status: ProjectStatus
  planned_start_date: string
  planned_end_date: string
  actual_start_date?: string
  actual_end_date?: string
  overall_progress_pct: number
  client_name: string
  project_manager_name: string
}

export interface ProjectMember {
  id: string
  project_id: string
  user_id: string
  role: ProjectRole
}

export interface Task {
  id: string
  project_id: string
  title: string
  activities: string[]
  assigned_to?: string
  status: TaskStatus
  planned_start_date: string
  planned_end_date: string
  allocated_budget: number
  spent_budget: number
  weight_pct: number
  progress_pct: number
}

export interface DailyLog {
  id: string
  project_id: string
  task_id: string
  submitted_by: string
  log_date: string
  status: LogStatus
  activities: string[]
  progress_pct_today: number
  remarks?: string
}

// Mock Users
export const mockUsers: User[] = [
  {
    id: 'user-1',
    full_name: 'Abebe Kebede',
    email: 'abebe@construction.com',
    phone: '+251911234567',
    profile_photo_url: '/avatars/user-1.jpg',
    is_admin: true,
    is_active: true,
  },
  {
    id: 'user-2',
    full_name: 'Sara Tadesse',
    email: 'sara@construction.com',
    phone: '+251922345678',
    profile_photo_url: '/avatars/user-2.jpg',
    is_admin: false,
    is_active: true,
  },
  {
    id: 'user-3',
    full_name: 'Dawit Haile',
    email: 'dawit@construction.com',
    phone: '+251933456789',
    is_admin: false,
    is_active: true,
  },
  {
    id: 'user-4',
    full_name: 'Meron Alemu',
    email: 'meron@construction.com',
    phone: '+251944567890',
    is_admin: false,
    is_active: true,
  },
]

// Mock Projects
export const mockProjects: Project[] = [
  {
    id: 'proj-1',
    name: 'Addis Ababa Commercial Complex',
    description: 'A 20-story mixed-use commercial building in Bole sub-city',
    location: 'Bole, Addis Ababa',
    status: 'active',
    planned_start_date: '2024-01-15',
    planned_end_date: '2025-06-30',
    actual_start_date: '2024-01-20',
    overall_progress_pct: 35.5,
    client_name: 'Ethiopian Development Corporation',
    project_manager_name: 'Abebe Kebede',
  },
  {
    id: 'proj-2',
    name: 'Highway Rehabilitation Project',
    description: 'Rehabilitation of 50km highway section from Addis to Adama',
    location: 'Addis Ababa - Adama Highway',
    status: 'at_risk',
    planned_start_date: '2024-03-01',
    planned_end_date: '2025-03-01',
    actual_start_date: '2024-03-15',
    overall_progress_pct: 22.0,
    client_name: 'Ethiopian Roads Authority',
    project_manager_name: 'Sara Tadesse',
  },
  {
    id: 'proj-3',
    name: 'Residential Housing Development',
    description: '500 unit affordable housing development',
    location: 'Yeka, Addis Ababa',
    status: 'draft',
    planned_start_date: '2024-06-01',
    planned_end_date: '2026-12-31',
    overall_progress_pct: 0,
    client_name: 'Ministry of Urban Development',
    project_manager_name: 'Abebe Kebede',
  },
  {
    id: 'proj-4',
    name: 'Industrial Park Construction',
    description: 'Construction of manufacturing facilities and infrastructure',
    location: 'Hawassa Industrial Park',
    status: 'active',
    planned_start_date: '2023-09-01',
    planned_end_date: '2025-09-01',
    actual_start_date: '2023-09-10',
    overall_progress_pct: 68.2,
    client_name: 'Industrial Parks Development Corporation',
    project_manager_name: 'Dawit Haile',
  },
]

// Mock Project Members - determines which projects a user can see and their role
export const mockProjectMembers: ProjectMember[] = [
  // User 1 (Abebe) - Project Manager on proj-1 and proj-3
  { id: 'pm-1', project_id: 'proj-1', user_id: 'user-1', role: 'project_manager' },
  { id: 'pm-2', project_id: 'proj-3', user_id: 'user-1', role: 'project_manager' },
  
  // User 2 (Sara) - Project Manager on proj-2, Office Engineer on proj-1
  { id: 'pm-3', project_id: 'proj-2', user_id: 'user-2', role: 'project_manager' },
  { id: 'pm-4', project_id: 'proj-1', user_id: 'user-2', role: 'office_engineer' },
  
  // User 3 (Dawit) - Consultant on proj-1, proj-2, Project Manager on proj-4
  { id: 'pm-5', project_id: 'proj-1', user_id: 'user-3', role: 'consultant' },
  { id: 'pm-6', project_id: 'proj-2', user_id: 'user-3', role: 'consultant' },
  { id: 'pm-7', project_id: 'proj-4', user_id: 'user-3', role: 'project_manager' },
  
  // User 4 (Meron) - Site Engineer on proj-1, proj-2, proj-4
  { id: 'pm-8', project_id: 'proj-1', user_id: 'user-4', role: 'site_engineer' },
  { id: 'pm-9', project_id: 'proj-2', user_id: 'user-4', role: 'site_engineer' },
  { id: 'pm-10', project_id: 'proj-4', user_id: 'user-4', role: 'site_engineer' },
]

// Mock Tasks
export const mockTasks: Task[] = [
  {
    id: 'task-1',
    project_id: 'proj-1',
    title: 'Foundation Excavation',
    activities: ['Site clearing', 'Excavation to formation level', 'Soil compaction'],
    assigned_to: 'user-4',
    status: 'completed',
    planned_start_date: '2024-01-20',
    planned_end_date: '2024-02-28',
    allocated_budget: 2500000,
    spent_budget: 2350000,
    weight_pct: 15,
    progress_pct: 100,
  },
  {
    id: 'task-2',
    project_id: 'proj-1',
    title: 'Foundation Construction',
    activities: ['Formwork installation', 'Steel reinforcement', 'Concrete pouring', 'Curing'],
    assigned_to: 'user-4',
    status: 'in_progress',
    planned_start_date: '2024-03-01',
    planned_end_date: '2024-04-30',
    allocated_budget: 5000000,
    spent_budget: 3200000,
    weight_pct: 25,
    progress_pct: 65,
  },
  {
    id: 'task-3',
    project_id: 'proj-1',
    title: 'Structural Frame - Floors 1-5',
    activities: ['Column construction', 'Beam construction', 'Slab casting'],
    assigned_to: 'user-4',
    status: 'not_started',
    planned_start_date: '2024-05-01',
    planned_end_date: '2024-08-31',
    allocated_budget: 8000000,
    spent_budget: 0,
    weight_pct: 30,
    progress_pct: 0,
  },
  {
    id: 'task-4',
    project_id: 'proj-2',
    title: 'Road Base Preparation',
    activities: ['Remove existing pavement', 'Grade subbase', 'Compact base layer'],
    assigned_to: 'user-4',
    status: 'in_progress',
    planned_start_date: '2024-03-15',
    planned_end_date: '2024-06-30',
    allocated_budget: 15000000,
    spent_budget: 8500000,
    weight_pct: 40,
    progress_pct: 55,
  },
]

// Mock Daily Logs
export const mockDailyLogs: DailyLog[] = [
  {
    id: 'log-1',
    project_id: 'proj-1',
    task_id: 'task-2',
    submitted_by: 'user-4',
    log_date: '2024-04-01',
    status: 'approved',
    activities: ['Completed column C1-C4 formwork', 'Started steel fixing for beam B1'],
    progress_pct_today: 3.5,
    remarks: 'Weather was favorable. All workers present.',
  },
  {
    id: 'log-2',
    project_id: 'proj-1',
    task_id: 'task-2',
    submitted_by: 'user-4',
    log_date: '2024-04-02',
    status: 'under_review',
    activities: ['Completed beam B1 steel fixing', 'Concrete poured for columns C1-C4'],
    progress_pct_today: 4.0,
    remarks: 'Concrete test samples taken.',
  },
  {
    id: 'log-3',
    project_id: 'proj-2',
    task_id: 'task-4',
    submitted_by: 'user-4',
    log_date: '2024-04-01',
    status: 'submitted',
    activities: ['Grading completed for KM 15-17', 'Compaction started for KM 15'],
    progress_pct_today: 2.0,
    remarks: 'Light rain in the afternoon caused 2 hours delay.',
  },
]

// Helper functions
export function getUserProjects(userId: string): (Project & { role: ProjectRole })[] {
  const memberRecords = mockProjectMembers.filter(pm => pm.user_id === userId)
  return memberRecords.map(pm => {
    const project = mockProjects.find(p => p.id === pm.project_id)!
    return { ...project, role: pm.role }
  }).filter(project => project.id !== 'proj-2')
}

export function getProjectTasks(projectId: string): Task[] {
  return mockTasks.filter(t => t.project_id === projectId)
}

export function getProjectLogs(projectId: string): DailyLog[] {
  return mockDailyLogs.filter(l => l.project_id === projectId)
}

export function getUserRoleInProject(userId: string, projectId: string): ProjectRole | null {
  const member = mockProjectMembers.find(pm => pm.user_id === userId && pm.project_id === projectId)
  return member?.role || null
}

export function canCreateProject(userId: string): boolean {
  const user = mockUsers.find(u => u.id === userId)
  // Admin users or users who are project managers on any project can create new projects
  if (user?.is_admin) return true
  return mockProjectMembers.some(pm => pm.user_id === userId && pm.role === 'project_manager')
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
