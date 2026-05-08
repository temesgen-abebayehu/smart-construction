'use client'

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Progress } from '@/components/ui/progress'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  ArrowLeft,
  Calendar,
  GitBranch,
  Loader2,
  PencilLine,
  Plus,
  Save,
  Trash2,
  UserCircle2,
  X,
} from 'lucide-react'
import { getTask, updateTask, listProjectMembersEnriched, listProjectTasks, listTaskDependencies, addTaskDependency, removeTaskDependency } from '@/lib/api'
import type { TaskListItem, EnrichedMemberRow } from '@/lib/api-types'
import type { TaskStatus } from '@/lib/domain'
import { useProjectRole } from '@/lib/project-role-context'
import { toast } from 'sonner'

interface TaskDetailPageProps {
  params: Promise<{ projectId: string; taskId: string }>
}

const statusConfig: Record<TaskStatus, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'bg-slate-100 text-slate-700' },
  in_progress: { label: 'In Progress', className: 'bg-blue-100 text-blue-700' },
  completed: { label: 'Completed', className: 'bg-emerald-100 text-emerald-700' },
}

export default function TaskDetailPage({ params }: TaskDetailPageProps) {
  const { projectId, taskId } = use(params)
  const router = useRouter()
  const userRole = useProjectRole()

  const [task, setTask] = useState<TaskListItem | null>(null)
  const [members, setMembers] = useState<EnrichedMemberRow[]>([])
  const [allTasks, setAllTasks] = useState<TaskListItem[]>([])
  const [deps, setDeps] = useState<{ id: string; task_id: string; depends_on_task_id: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(false)
  const [depAdding, setDepAdding] = useState(false)
  const [depPending, setDepPending] = useState<Set<string>>(new Set())

  // Editable fields
  const [editName, setEditName] = useState('')
  const [editStatus, setEditStatus] = useState<TaskStatus>('pending')
  const [editProgress, setEditProgress] = useState('')
  const [editStartDate, setEditStartDate] = useState('')
  const [editEndDate, setEditEndDate] = useState('')
  const [editAssignee, setEditAssignee] = useState<string | null>(null)
  const [assigneePopoverOpen, setAssigneePopoverOpen] = useState(false)

  const canEdit = userRole === 'project_manager'
  const canEditProgress = userRole === 'project_manager' || userRole === 'site_engineer'

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const [t, m, tasksRes, d] = await Promise.all([
          getTask(taskId),
          listProjectMembersEnriched(projectId),
          listProjectTasks(projectId, { limit: 200 }),
          listTaskDependencies(taskId).catch(() => []),
        ])
        if (cancelled) return
        setTask(t)
        setMembers(m)
        setAllTasks(tasksRes.data.filter(tk => tk.id !== taskId))
        setDeps(d)
        setEditName(t.title)
        setEditStatus(t.status)
        setEditProgress(String(t.progress_percentage))
        setEditStartDate(t.start_date ? t.start_date.split('T')[0] : '')
        setEditEndDate(t.end_date ? t.end_date.split('T')[0] : '')
        setEditAssignee(t.assigned_to ?? null)
      } catch {
        if (!cancelled) setError('Failed to load task')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [taskId, projectId])

  const handleSave = async () => {
    setSaving(true)
    try {
      // Site engineer can only update progress; PM can update everything
      const body = canEdit
        ? {
            name: editName.trim() || undefined,
            status: editStatus,
            progress_percentage: Number.parseFloat(editProgress) || 0,
            start_date: editStartDate ? `${editStartDate}T00:00:00` : undefined,
            end_date: editEndDate ? `${editEndDate}T00:00:00` : undefined,
            assigned_to: editAssignee || undefined,
          }
        : {
            progress_percentage: Number.parseFloat(editProgress) || 0,
          }
      await updateTask(taskId, body)
      // Reload
      const t = await getTask(taskId)
      setTask(t)
      setEditing(false)
      toast.success('Task updated successfully')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update task')
    } finally {
      setSaving(false)
    }
  }

  const selectedMember = members.find(m => m.user.id === editAssignee)

  if (loading) {
    return (
      <div className="flex justify-center py-24 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (error || !task) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
        <p>{error || 'Task not found'}</p>
        <Button variant="outline" className="mt-4" onClick={() => router.back()}>
          Go Back
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push(`/dashboard/${projectId}/tasks`)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{task.title}</h1>
          <p className="text-sm text-muted-foreground">Task details and management</p>
        </div>
        <Badge className={statusConfig[task.status]?.className}>
          {statusConfig[task.status]?.label}
        </Badge>
        {(canEdit || canEditProgress) && (
          editing ? (
            <Button variant="outline" size="sm" className="gap-2" onClick={() => {
              setEditing(false)
              setEditName(task.title)
              setEditStatus(task.status)
              setEditProgress(String(task.progress_percentage))
              setEditStartDate(task.start_date ? task.start_date.split('T')[0] : '')
              setEditEndDate(task.end_date ? task.end_date.split('T')[0] : '')
              setEditAssignee(task.assigned_to ?? null)
            }}>
              <X className="h-4 w-4" />
              Cancel
            </Button>
          ) : (
            <Button variant="outline" size="sm" className="gap-2" onClick={() => setEditing(true)}>
              <PencilLine className="h-4 w-4" />
              {canEdit ? 'Edit' : 'Update Progress'}
            </Button>
          )
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <Card>
          <CardHeader>
            <CardTitle>Task Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label>Task Name</Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                disabled={!editing}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={editStatus} onValueChange={(v) => setEditStatus(v as TaskStatus)} disabled={!editing}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Progress (%)</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={editProgress}
                  onChange={(e) => setEditProgress(e.target.value)}
                  disabled={!editing}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={editStartDate}
                  onChange={(e) => setEditStartDate(e.target.value)}
                  disabled={!editing}
                />
              </div>
              <div className="space-y-2">
                <Label>End Date</Label>
                <Input
                  type="date"
                  value={editEndDate}
                  onChange={(e) => setEditEndDate(e.target.value)}
                  disabled={!editing}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Assign to</Label>
              <Popover open={assigneePopoverOpen} onOpenChange={setAssigneePopoverOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" type="button" className="w-full justify-start gap-2 font-normal" disabled={!editing}>
                    {selectedMember ? (
                      <>
                        <Avatar className="h-5 w-5">
                          <AvatarFallback className="text-[10px]">
                            {selectedMember.user.full_name.split(' ').filter(p => p).map(p => p[0]).join('').toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        {selectedMember.user.full_name}
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
                    onClick={() => { setEditAssignee(null); setAssigneePopoverOpen(false) }}
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
                          className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-muted ${editAssignee === m.user.id ? 'bg-muted' : ''}`}
                          onClick={() => { setEditAssignee(m.user.id); setAssigneePopoverOpen(false) }}
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

            {editing && (
              <div className="flex justify-end pt-2">
                <Button onClick={() => void handleSave()} disabled={saving} className="gap-2">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save Changes
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Completion</span>
                  <span className="font-medium">{task.progress_percentage}%</span>
                </div>
                <Progress
                  value={task.progress_percentage}
                  className={`h-2 ${task.status === 'completed' ? '[&>div]:bg-emerald-500' : ''}`}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Timeline</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Start:</span>
                <span>{task.start_date ? new Date(task.start_date).toLocaleDateString() : 'Not set'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">End:</span>
                <span>{task.end_date ? new Date(task.end_date).toLocaleDateString() : 'Not set'}</span>
              </div>
            </CardContent>
          </Card>

          {task.assignee && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Assigned To</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs">
                      {task.assignee.full_name.split(' ').filter(p => p).map(p => p[0]).join('').toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium">{task.assignee.full_name}</p>
                    <p className="text-xs text-muted-foreground">{task.assignee.email}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Dependencies */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <GitBranch className="h-4 w-4" />
                  Dependencies
                </CardTitle>
                {canEdit && !depAdding && (
                  <Button variant="ghost" size="sm" className="h-7 gap-1" onClick={() => setDepAdding(true)}>
                    <Plus className="h-3.5 w-3.5" />
                    Add
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {depAdding && (
                <div className="space-y-2 rounded-lg border p-3">
                  <p className="text-xs font-medium text-muted-foreground">Must complete before this task:</p>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {allTasks
                      .filter(t => !deps.some(d => d.depends_on_task_id === t.id))
                      .map(t => (
                        <button
                          key={t.id}
                          type="button"
                          disabled={depPending.has(t.id)}
                          className="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm hover:bg-muted disabled:opacity-50"
                          onClick={async () => {
                            setDepPending(prev => new Set(prev).add(t.id))
                            try {
                              await addTaskDependency(taskId, t.id)
                              const d = await listTaskDependencies(taskId).catch(() => [])
                              setDeps(d)
                              toast.success(`Dependency added: ${t.title}`)
                            } catch (e) {
                              toast.error(e instanceof Error ? e.message : 'Failed to add dependency')
                            } finally {
                              setDepPending(prev => { const s = new Set(prev); s.delete(t.id); return s })
                            }
                          }}
                        >
                          <span>{t.title}</span>
                          <Badge variant="outline" className="text-[10px]">{t.status}</Badge>
                        </button>
                      ))}
                    {allTasks.filter(t => !deps.some(d => d.depends_on_task_id === t.id)).length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-2">No available tasks to add.</p>
                    )}
                  </div>
                  <Button variant="outline" size="sm" className="w-full" onClick={() => setDepAdding(false)}>
                    Done
                  </Button>
                </div>
              )}

              {deps.length === 0 && !depAdding && (
                <p className="text-xs text-muted-foreground text-center py-2">No dependencies.</p>
              )}

              {deps.map((dep) => {
                const blockerTask = allTasks.find(t => t.id === dep.depends_on_task_id)
                return (
                  <div key={dep.id} className="flex items-center justify-between rounded-lg border p-2.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <GitBranch className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="text-sm truncate">{blockerTask?.title ?? dep.depends_on_task_id.slice(0, 8)}</span>
                      <Badge
                        variant="outline"
                        className={`text-[10px] shrink-0 ${
                          blockerTask?.status === 'completed'
                            ? 'border-emerald-300 text-emerald-700'
                            : 'border-amber-300 text-amber-700'
                        }`}
                      >
                        {blockerTask?.status === 'completed' ? 'Done' : 'Blocking'}
                      </Badge>
                    </div>
                    {canEdit && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={async () => {
                          await removeTaskDependency(taskId, dep.id)
                          setDeps(prev => prev.filter(d => d.id !== dep.id))
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                )
              })}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
