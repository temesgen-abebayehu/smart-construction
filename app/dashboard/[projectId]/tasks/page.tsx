'use client'

import { use, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Textarea } from '@/components/ui/textarea'
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  BriefcaseBusiness,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Circle,
  Eye,
  Pencil,
  Search,
  SlidersHorizontal,
  TriangleAlert,
  Loader2,
} from 'lucide-react'
import { useProjectRole } from '@/lib/project-role-context'
import type { TaskListItem } from '@/lib/api-types'
import type { TaskStatus } from '@/lib/domain'
import { listProjectMembers, listProjectTasks } from '@/lib/api'

interface TasksPageProps {
  params: Promise<{ projectId: string }>
}

const statusConfig: Record<TaskStatus, { label: string; className: string }> = {
  not_started: { label: 'On Schedule', className: 'bg-slate-100 text-slate-700' },
  pending_dependency: { label: 'Delayed', className: 'bg-red-100 text-red-700' },
  in_progress: { label: 'In Progress', className: 'bg-blue-100 text-blue-700' },
  delayed: { label: 'Delayed', className: 'bg-red-100 text-red-700' },
  completed: { label: 'Completed', className: 'bg-emerald-100 text-emerald-700' },
  cancelled: { label: 'Cancelled', className: 'bg-slate-100 text-slate-500' },
}

const PAGE_SIZE = 4
const statusFilters = ['all', 'completed', 'in_progress', 'delayed'] as const

function timelineLabel(start: string, end: string) {
  const startDate = new Date(start)
  const endDate = new Date(end)
  return `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
}

function estimateHours(start: string, end: string) {
  const diffMs = Math.max(new Date(end).getTime() - new Date(start).getTime(), 0)
  return Math.round((diffMs / (1000 * 60 * 60 * 24)) * 8)
}

export default function TasksPage({ params }: TasksPageProps) {
  const { projectId } = use(params)
  const userRole = useProjectRole()

  const [projectTasks, setProjectTasks] = useState<TaskListItem[]>([])
  const [assignees, setAssignees] = useState<{ id: string; full_name: string }[]>([])
  const [loading, setLoading] = useState(true)

  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(1)
  const [newTaskOpen, setNewTaskOpen] = useState(false)
  const [newTaskPriority, setNewTaskPriority] = useState<'high' | 'medium' | 'low'>('medium')
  const canCreateTask = userRole === 'project_manager'

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const [taskRes, memberRes] = await Promise.all([
          listProjectTasks(projectId, { limit: 100 }),
          listProjectMembers(projectId),
        ])
        if (cancelled) return
        setProjectTasks(taskRes.data)
        const siteEngineers = memberRes.data
          .filter((m) => m.role === 'site_engineer')
          .map((m) => ({ id: m.user.id, full_name: m.user.full_name }))
        setAssignees(siteEngineers.length ? siteEngineers : memberRes.data.map((m) => ({
          id: m.user.id,
          full_name: m.user.full_name,
        })))
      } catch {
        if (!cancelled) {
          setProjectTasks([])
          setAssignees([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [projectId])

  const filteredTasks = useMemo(() => {
    return projectTasks.filter((task) => {
      if (statusFilter !== 'all' && task.status !== statusFilter) return false
      if (searchQuery && !task.title.toLowerCase().includes(searchQuery.toLowerCase())) return false
      return true
    })
  }, [projectTasks, searchQuery, statusFilter])

  const totalPages = Math.max(1, Math.ceil(filteredTasks.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pageStart = (safePage - 1) * PAGE_SIZE
  const pageTasks = filteredTasks.slice(pageStart, pageStart + PAGE_SIZE)

  const assignedCount = projectTasks.filter((task) => Boolean(task.assigned_to)).length
  const inProgressCount = projectTasks.filter((task) => task.status === 'in_progress').length
  const overdueCount = projectTasks.filter(
    (task) => task.status === 'delayed' || task.status === 'pending_dependency',
  ).length
  const completedCount = projectTasks.filter((task) => task.status === 'completed').length

  const statusChipLabel: Record<(typeof statusFilters)[number], string> = {
    all: 'All',
    completed: 'Completed',
    in_progress: 'In Progress',
    delayed: 'Delayed',
  }

  const statusChipClass: Record<(typeof statusFilters)[number], string> = {
    all: 'bg-slate-100 text-slate-700 hover:bg-slate-200',
    completed: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200',
    in_progress: 'bg-blue-100 text-blue-700 hover:bg-blue-200',
    delayed: 'bg-red-100 text-red-700 hover:bg-red-200',
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
          <Button variant="secondary" size="sm" className="gap-2">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Project Alpha
          </Button>
          <Button variant="ghost" size="sm" onClick={() => { setStatusFilter('all'); setSearchQuery('') }}>
            Clear Filters
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="space-y-2 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Assigned Tasks</p>
            <p className="text-4xl font-semibold leading-none">{assignedCount.toString().padStart(2, '0')}</p>
            <p className="text-xs text-blue-700">+2 from yesterday</p>
          </CardContent>
        </Card>

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
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Overdue</p>
            <p className="text-4xl font-semibold leading-none text-red-600">{overdueCount.toString().padStart(2, '0')}</p>
            <p className="flex items-center gap-1 text-xs text-red-600">
              <TriangleAlert className="h-3.5 w-3.5" />
              Action required
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-2 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Completed</p>
            <p className="text-4xl font-semibold leading-none">{completedCount.toString().padStart(2, '0')}</p>
            <p className="text-xs text-emerald-700">82% weekly goal met</p>
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
                  <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Create New Task</DialogTitle>
                      <DialogDescription>
                        Add a task package for the project and assign it to a team member. API wiring can be completed when you are ready.
                      </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 py-2">
                      <div className="grid gap-2">
                        <label className="text-sm font-medium" htmlFor="task-name">Task name</label>
                        <Input id="task-name" placeholder="Enter task name" />
                      </div>

                      <div className="grid gap-2">
                        <label className="text-sm font-medium" htmlFor="task-description">Description</label>
                        <Textarea id="task-description" placeholder="Describe the scope, goals, or site details" />
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="grid gap-2">
                          <label className="text-sm font-medium" htmlFor="task-assignee">Assignee</label>
                          <select id="task-assignee" className="h-10 rounded-md border border-input bg-background px-3 text-sm">
                            <option value="">Select assignee</option>
                            {assignees.map((u) => (
                              <option key={u.id} value={u.id}>{u.full_name}</option>
                            ))}
                          </select>
                        </div>

                        <div className="grid gap-2">
                          <label className="text-sm font-medium" htmlFor="task-priority">Priority</label>
                          <select
                            id="task-priority"
                            value={newTaskPriority}
                            onChange={(event) => setNewTaskPriority(event.target.value as 'high' | 'medium' | 'low')}
                            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                          >
                            <option value="high">High</option>
                            <option value="medium">Medium</option>
                            <option value="low">Low</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="grid gap-2">
                          <label className="text-sm font-medium" htmlFor="task-start">Start date</label>
                          <Input id="task-start" type="date" />
                        </div>
                        <div className="grid gap-2">
                          <label className="text-sm font-medium" htmlFor="task-end">End date</label>
                          <Input id="task-end" type="date" />
                        </div>
                      </div>
                    </div>

                    <DialogFooter>
                      <Button variant="outline" onClick={() => setNewTaskOpen(false)}>Cancel</Button>
                      <Button onClick={() => setNewTaskOpen(false)}>Create Task</Button>
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
                <TableHead>Status</TableHead>
                <TableHead>Timeline</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageTasks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                    No tasks found for current filter.
                  </TableCell>
                </TableRow>
              ) : (
                pageTasks.map((task) => {
                  const isDelayed = task.status === 'delayed' || task.status === 'pending_dependency'
                  const progress = task.cumulative_progress_pct

                  return (
                    <TableRow key={task.id}>
                      <TableCell>
                        <p className="font-medium">{task.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {task.assigned_to?.full_name
                            ? `Assigned: ${task.assigned_to.full_name}`
                            : 'Execution package'}
                        </p>
                      </TableCell>

                      <TableCell>
                        <Badge className={statusConfig[task.status].className}>{statusConfig[task.status].label}</Badge>
                      </TableCell>

                      <TableCell>
                        <p className={`text-sm ${isDelayed ? 'font-medium text-red-700' : ''}`}>{timelineLabel(task.planned_start_date, task.planned_end_date)}</p>
                        <p className={`text-xs ${isDelayed ? 'font-semibold text-red-600' : 'text-muted-foreground'}`}>
                          {isDelayed ? '48H Delay' : `EST: ${estimateHours(task.planned_start_date, task.planned_end_date)} Hours`}
                        </p>
                      </TableCell>

                      <TableCell>
                        <div className="w-28 space-y-1">
                          <p className="text-xs font-medium">{progress.toFixed(1)}%</p>
                          <Progress
                            value={progress}
                            className={`h-1.5 ${isDelayed ? '[&>div]:bg-red-500' : task.status === 'completed' ? '[&>div]:bg-emerald-500' : ''}`}
                          />
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                            <Link href={`/dashboard/${projectId}/tasks`} aria-label="View task">
                              <Eye className="h-4 w-4" />
                            </Link>
                          </Button>
                          {canCreateTask && (
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
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
