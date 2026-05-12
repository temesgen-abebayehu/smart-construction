'use client'

import { use, useEffect, useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Circle,
  Pencil,
  Search,
  TriangleAlert,
  Loader2,
  UserCircle2,
} from 'lucide-react'
import { useProjectRole } from '@/lib/project-role-context'
import { useAuth } from '@/lib/auth-context'
import type { TaskListItem, EnrichedMemberRow } from '@/lib/api-types'
import type { TaskStatus } from '@/lib/domain'
import { createTask, updateTask, listProjectTasks, listProjectMembersEnriched } from '@/lib/api'
import { toast } from 'sonner'

interface TasksPageProps {
  params: Promise<{ projectId: string }>
}

const statusConfig: Record<TaskStatus, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'bg-slate-100 text-slate-700' },
  in_progress: { label: 'In Progress', className: 'bg-blue-100 text-blue-700' },
  completed: { label: 'Completed', className: 'bg-emerald-100 text-emerald-700' },
}

const PAGE_SIZE = 4
const statusFilters = ['all', 'completed', 'in_progress', 'pending'] as const

function timelineLabel(start?: string | null, end?: string | null) {
  if (!start || !end) return 'No dates set'
  const startDate = new Date(start)
  const endDate = new Date(end)
  return `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
}

function estimateHours(start?: string | null, end?: string | null) {
  if (!start || !end) return 0
  const diffMs = Math.max(new Date(end).getTime() - new Date(start).getTime(), 0)
  return Math.round((diffMs / (1000 * 60 * 60 * 24)) * 8)
}

export default function TasksPage({ params }: TasksPageProps) {
  const { projectId } = use(params)
  const userRole = useProjectRole()
  const { user } = useAuth()

  const [projectTasks, setProjectTasks] = useState<TaskListItem[]>([])
  const [loading, setLoading] = useState(true)

  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(1)
  const [newTaskOpen, setNewTaskOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newTaskName, setNewTaskName] = useState('')
  const today = new Date().toISOString().split('T')[0]
  const [newTaskStart, setNewTaskStart] = useState(today)
  const [newTaskDuration, setNewTaskDuration] = useState('7')
  const [newTaskBudget, setNewTaskBudget] = useState('')
  const [newTaskAssignee, setNewTaskAssignee] = useState<string | null>(null)
  const [newTaskDependsOn, setNewTaskDependsOn] = useState<string | null>(null)
  const [assigneePopoverOpen, setAssigneePopoverOpen] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [members, setMembers] = useState<EnrichedMemberRow[]>([])
  const canCreateTask = userRole === 'project_manager'

  const loadTasks = async () => {
    setLoading(true)
    try {
      const taskRes = await listProjectTasks(projectId, {
        limit: 100,
        assigned_to: userRole === 'site_engineer' ? user?.id : undefined,
      })
      setProjectTasks(taskRes.data)
    } catch {
      setProjectTasks([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTasks()
    listProjectMembersEnriched(projectId).then(setMembers).catch(() => setMembers([]))
  }, [projectId])

  const handleCreateTask = async () => {
    if (!newTaskName.trim()) {
      toast.error('Task name is required')
      return
    }
    if (!newTaskBudget || Number(newTaskBudget) <= 0) {
      toast.error('Budget is required and must be greater than 0')
      return
    }
    setCreating(true)
    setCreateError(null)
    try {
      await createTask(projectId, {
        name: newTaskName.trim(),
        start_date: newTaskStart ? `${newTaskStart}T00:00:00` : undefined,
        duration_days: Number(newTaskDuration) || 7,
        allocated_budget: Number(newTaskBudget),
        assigned_to: newTaskAssignee || undefined,
        depends_on_task_id: newTaskDependsOn || undefined,
      })
      setNewTaskOpen(false)
      setNewTaskName('')
      setNewTaskStart(today)
      setNewTaskDuration('7')
      setNewTaskBudget('')
      setNewTaskAssignee(null)
      setNewTaskDependsOn(null)
      await loadTasks()
      toast.success('Task created')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create task'
      setCreateError(msg)
      toast.error(msg)
    } finally {
      setCreating(false)
    }
  }

  const filteredTasks = useMemo(() => {
    return [...projectTasks]
      .reverse() // newest first (backend returns in insertion order)
      .filter((task) => {
        if (statusFilter !== 'all' && task.status !== statusFilter) return false
        if (searchQuery && !task.title.toLowerCase().includes(searchQuery.toLowerCase())) return false
        return true
      })
  }, [projectTasks, searchQuery, statusFilter])

  const totalPages = Math.max(1, Math.ceil(filteredTasks.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pageStart = (safePage - 1) * PAGE_SIZE
  const pageTasks = filteredTasks.slice(pageStart, pageStart + PAGE_SIZE)

  const inProgressCount = projectTasks.filter((task) => task.status === 'in_progress').length
  const pendingCount = projectTasks.filter((task) => task.status === 'pending').length
  const completedCount = projectTasks.filter((task) => task.status === 'completed').length

  const statusChipLabel: Record<(typeof statusFilters)[number], string> = {
    all: 'All',
    completed: 'Completed',
    in_progress: 'In Progress',
    pending: 'Pending',
  }

  const statusChipClass: Record<(typeof statusFilters)[number], string> = {
    all: 'bg-slate-100 text-slate-700 hover:bg-slate-200',
    completed: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200',
    in_progress: 'bg-blue-100 text-blue-700 hover:bg-blue-200',
    pending: 'bg-amber-100 text-amber-700 hover:bg-amber-200',
  }

  if (loading) {
    return (
      <div className="flex justify-center py-24 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Task Management</h1>
          <p className="text-sm text-muted-foreground">Real-time oversight of site engineering operations</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => { setStatusFilter('all'); setSearchQuery('') }}>
            Clear Filters
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <Card>
          <CardContent className="space-y-2 p-4">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">In Progress</p>
              <Circle className="h-2 w-2 fill-blue-600 text-blue-600" />
            </div>
            <p className="text-4xl font-semibold leading-none">{inProgressCount.toString().padStart(2, '0')}</p>
            <p className="text-xs text-blue-700">Active engineering cycle</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-2 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Pending</p>
            <p className="text-4xl font-semibold leading-none text-amber-600">{pendingCount.toString().padStart(2, '0')}</p>
            <p className="flex items-center gap-1 text-xs text-amber-600">
              <TriangleAlert className="h-3.5 w-3.5" />
              Awaiting start
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-2 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Completed</p>
            <p className="text-4xl font-semibold leading-none">{completedCount.toString().padStart(2, '0')}</p>
            <p className="text-xs text-emerald-700">Done</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="flex flex-col gap-3 border-b border-border px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              {statusFilters.map((filter) => (
                <Button
                  key={filter}
                  variant={statusFilter === filter ? 'default' : 'secondary'}
                  size="sm"
                  className={statusFilter === filter ? 'gap-2' : `gap-2 ${statusChipClass[filter]}`}
                  onClick={() => {
                    setStatusFilter(filter)
                    setPage(1)
                  }}
                >
                  {statusChipLabel[filter]}
                </Button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-full sm:w-80">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(event) => {
                    setSearchQuery(event.target.value)
                    setPage(1)
                  }}
                  placeholder="Search task details"
                  className="h-9 pl-9"
                />
              </div>

              {canCreateTask && (
                <Dialog open={newTaskOpen} onOpenChange={setNewTaskOpen}>
                  <DialogTrigger asChild>
                    <Button className="gap-2">
                      <Pencil className="h-4 w-4" />
                      New Task
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                      <DialogTitle>Create New Task</DialogTitle>
                      <DialogDescription>
                        Add a task for this project.
                      </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 py-2">
                      <div className="grid gap-2">
                        <label className="text-sm font-medium" htmlFor="task-name">Task name *</label>
                        <Input
                          id="task-name"
                          placeholder="Enter task name"
                          value={newTaskName}
                          onChange={(e) => setNewTaskName(e.target.value)}
                        />
                      </div>

                      <div className="grid gap-2">
                        <label className="text-sm font-medium">Depends on (optional)</label>
                        <select
                          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                          value={newTaskDependsOn ?? ''}
                          onChange={(e) => {
                            const depId = e.target.value || null
                            setNewTaskDependsOn(depId)
                            if (depId) {
                              const depTask = projectTasks.find(t => t.id === depId)
                              if (depTask?.end_date) {
                                const endDate = new Date(depTask.end_date)
                                endDate.setDate(endDate.getDate() + 1)
                                // Skip weekends
                                while (endDate.getDay() === 0 || endDate.getDay() === 6) {
                                  endDate.setDate(endDate.getDate() + 1)
                                }
                                setNewTaskStart(endDate.toISOString().split('T')[0])
                              }
                            }
                          }}
                        >
                          <option value="">No dependency</option>
                          {projectTasks
                            .filter(t => t.status !== 'completed')
                            .map(t => (
                              <option key={t.id} value={t.id}>
                                {t.title} ({t.status.replace('_', ' ')})
                              </option>
                            ))}
                        </select>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="grid gap-2">
                          <label className="text-sm font-medium" htmlFor="task-start">Start date</label>
                          <Input
                            id="task-start"
                            type="date"
                            value={newTaskStart}
                            onChange={(e) => setNewTaskStart(e.target.value)}
                          />
                        </div>
                        <div className="grid gap-2">
                          <label className="text-sm font-medium" htmlFor="task-duration">Duration (days) *</label>
                          <Input
                            id="task-duration"
                            type="number"
                            min={1}
                            max={365}
                            placeholder="7"
                            value={newTaskDuration}
                            onChange={(e) => setNewTaskDuration(e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="grid gap-2">
                        <label className="text-sm font-medium" htmlFor="task-budget">Budget (ETB) *</label>
                        <Input
                          id="task-budget"
                          type="number"
                          min={0}
                          step={0.01}
                          placeholder="e.g. 50000"
                          value={newTaskBudget}
                          onChange={(e) => setNewTaskBudget(e.target.value)}
                        />
                      </div>

                      <div className="grid gap-2">
                        <label className="text-sm font-medium">Assign to</label>
                        <Popover open={assigneePopoverOpen} onOpenChange={setAssigneePopoverOpen}>
                          <PopoverTrigger asChild>
                            <Button variant="outline" type="button" className="justify-start gap-2 font-normal">
                              {newTaskAssignee ? (
                                <>
                                  <Avatar className="h-5 w-5">
                                    <AvatarFallback className="text-[10px]">
                                      {members.find(m => m.user.id === newTaskAssignee)?.user.full_name
                                        .split(' ').filter(p => p).map(p => p[0]).join('').toUpperCase() || 'U'}
                                    </AvatarFallback>
                                  </Avatar>
                                  {members.find(m => m.user.id === newTaskAssignee)?.user.full_name || 'Unknown'}
                                </>
                              ) : (
                                <>
                                  <UserCircle2 className="h-4 w-4 text-muted-foreground" />
                                  <span className="text-muted-foreground">Unassigned</span>
                                </>
                              )}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-64 p-1" align="start">
                            <button
                              type="button"
                              className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-muted"
                              onClick={() => { setNewTaskAssignee(null); setAssigneePopoverOpen(false) }}
                            >
                              <UserCircle2 className="h-6 w-6 text-muted-foreground" />
                              <span>Unassigned</span>
                            </button>
                            <div className="max-h-48 overflow-y-auto">
                              {members.map((m) => {
                                const initials = m.user.full_name.split(' ').filter(p => p).map(p => p[0]).join('').toUpperCase() || 'U'
                                return (
                                  <button
                                    key={m.user.id}
                                    type="button"
                                    className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-muted ${newTaskAssignee === m.user.id ? 'bg-muted' : ''}`}
                                    onClick={() => { setNewTaskAssignee(m.user.id); setAssigneePopoverOpen(false) }}
                                  >
                                    <Avatar className="h-6 w-6">
                                      <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
                                    </Avatar>
                                    <div className="text-left">
                                      <p className="font-medium">{m.user.full_name}</p>
                                      {m.user.email && <p className="text-xs text-muted-foreground">{m.user.email}</p>}
                                    </div>
                                  </button>
                                )
                              })}
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>

                      {createError && (
                        <p className="text-sm text-destructive">{createError}</p>
                      )}
                    </div>

                    <DialogFooter>
                      <Button variant="outline" onClick={() => setNewTaskOpen(false)}>Cancel</Button>
                      <Button onClick={handleCreateTask} disabled={creating || !newTaskName.trim() || !newTaskBudget}>
                        {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Create Task
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Task Details</TableHead>
                <TableHead>Assignee</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Budget</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageTasks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                    No tasks found for current filter.
                  </TableCell>
                </TableRow>
              ) : (
                pageTasks.map((task) => {
                  const progress = task.progress_percentage
                  const durationDays = task.start_date && task.end_date
                    ? Math.ceil((new Date(task.end_date).getTime() - new Date(task.start_date).getTime()) / (1000 * 60 * 60 * 24))
                    : 0

                  return (
                    <TableRow key={task.id}>
                      <TableCell>
                        <p className="font-medium">{task.title}</p>
                      </TableCell>

                      <TableCell>
                        <Popover>
                          <PopoverTrigger asChild>
                            <button type="button" className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-muted transition-colors cursor-pointer">
                              {task.assignee ? (
                                <>
                                  <Avatar className="h-6 w-6">
                                    <AvatarFallback className="text-[10px]">
                                      {task.assignee.full_name.split(' ').filter(p => p).map(p => p[0]).join('').toUpperCase() || 'U'}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span className="text-sm">{task.assignee.full_name}</span>
                                </>
                              ) : (
                                <>
                                  <UserCircle2 className="h-5 w-5 text-muted-foreground" />
                                  <span className="text-sm text-muted-foreground">Unassigned</span>
                                </>
                              )}
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-64 p-1" align="start">
                            <button
                              type="button"
                              className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-muted"
                              onClick={async () => {
                                try {
                                  const updated = await updateTask(task.id, {})
                                  // Update in-place to avoid reorder
                                  setProjectTasks(prev => prev.map(t => t.id === task.id ? { ...t, assigned_to: null, assignee: null } : t))
                                  toast.success('Task unassigned')
                                } catch (e) {
                                  toast.error(e instanceof Error ? e.message : 'Failed to unassign')
                                }
                              }}
                            >
                              <UserCircle2 className="h-6 w-6 text-muted-foreground" />
                              <span>Unassigned</span>
                            </button>
                            <div className="max-h-48 overflow-y-auto">
                              {members.map((m) => {
                                const ini = m.user.full_name.split(' ').filter(p => p).map(p => p[0]).join('').toUpperCase() || 'U'
                                return (
                                  <button
                                    key={m.user.id}
                                    type="button"
                                    className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-muted ${task.assigned_to === m.user.id ? 'bg-muted' : ''}`}
                                    onClick={async () => {
                                      try {
                                        await updateTask(task.id, { assigned_to: m.user.id })
                                        // Update in-place to avoid reorder
                                        setProjectTasks(prev => prev.map(t => t.id === task.id ? { ...t, assigned_to: m.user.id, assignee: { id: m.user.id, full_name: m.user.full_name, email: m.user.email || '' } } : t))
                                        toast.success(`Assigned to ${m.user.full_name}`)
                                      } catch (e) {
                                        toast.error(e instanceof Error ? e.message : 'Failed to assign')
                                      }
                                    }}
                                  >
                                    <Avatar className="h-6 w-6">
                                      <AvatarFallback className="text-[10px]">{ini}</AvatarFallback>
                                    </Avatar>
                                    <div className="text-left">
                                      <p className="font-medium">{m.user.full_name}</p>
                                      {m.user.email && <p className="text-xs text-muted-foreground">{m.user.email}</p>}
                                    </div>
                                  </button>
                                )
                              })}
                            </div>
                          </PopoverContent>
                        </Popover>
                      </TableCell>

                      <TableCell>
                        <Badge className={statusConfig[task.status]?.className ?? 'bg-slate-100 text-slate-700'}>
                          {statusConfig[task.status]?.label ?? task.status}
                        </Badge>
                      </TableCell>

                      <TableCell>
                        <p className="text-sm font-medium">
                          {task.allocated_budget ? `ETB ${task.allocated_budget.toLocaleString()}` : '—'}
                        </p>
                        {task.spent_budget !== null && task.spent_budget !== undefined && task.allocated_budget && (
                          <p className="text-xs text-muted-foreground">
                            {((task.spent_budget / task.allocated_budget) * 100).toFixed(0)}% spent
                          </p>
                        )}
                      </TableCell>

                      <TableCell>
                        <p className="text-sm">{durationDays > 0 ? `${durationDays} days` : '—'}</p>
                        {task.start_date && task.end_date && (
                          <p className="text-xs text-muted-foreground">
                            {new Date(task.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {new Date(task.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </p>
                        )}
                      </TableCell>

                      <TableCell>
                        <div className="w-28 space-y-1">
                          <p className="text-xs font-medium">{progress.toFixed(1)}%</p>
                          <Progress
                            value={progress}
                            className={`h-1.5 ${task.status === 'completed' ? '[&>div]:bg-emerald-500' : ''}`}
                          />
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs" asChild>
                            <a href={`/dashboard/${projectId}/tasks/${task.id}`}>
                              View <ArrowUpRight className="h-3.5 w-3.5" />
                            </a>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>

          <div className="flex flex-col gap-3 border-t border-border px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
            <p className="text-muted-foreground">
              Showing {Math.min(filteredTasks.length, pageStart + 1)} to {Math.min(filteredTasks.length, pageStart + PAGE_SIZE)} of {filteredTasks.length} tasks
            </p>

            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                disabled={safePage <= 1}
                onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>

              {[...Array(totalPages)].map((_, index) => {
                const pageNumber = index + 1
                return (
                  <Button
                    key={pageNumber}
                    variant={pageNumber === safePage ? 'default' : 'outline'}
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setPage(pageNumber)}
                  >
                    {pageNumber}
                  </Button>
                )
              })}

              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                disabled={safePage >= totalPages}
                onClick={() => setPage((prev) => Math.min(prev + 1, totalPages))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
