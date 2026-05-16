'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  getLog,
  getProject,
  submitLog,
  consultantApproveLog,
  pmApproveLog,
  rejectLog,
  listLogManpower,
  listLogMaterials,
  listLogEquipment,
  addLogManpower,
  addLogMaterial,
  addLogEquipment,
  listLogPhotos,
  deleteLogPhoto,
  listLogCompletedActivities,
  addLogCompletedActivity,
  removeLogCompletedActivity,
  listTaskActivities,
  listEquipmentIdle,
  addEquipmentIdle,
  getTask,
  listProjectTasks,
  deleteDailyLog,
  listSuppliers,
} from '@/lib/api'
import type { LogDetailResponse, ProjectDetail, DailyLogPhoto, TaskListItem, TaskActivityItem, SupplierItem } from '@/lib/api-types'
import type { LogStatus } from '@/lib/domain'
import { useProjectRole } from '@/lib/project-role-context'
import { getApiBaseUrl } from '@/lib/api-client'
import { getAccessToken } from '@/lib/auth-storage'
import { ArrowLeft, CheckCircle2, Clock3, FileText, Loader2, MapPin, Pencil, Plus, Users, XCircle, Image as ImageIcon, Trash2, Upload, ListChecks, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'

interface LogDetailPageProps {
  params: Promise<{ projectId: string; logId: string }>
}

const statusConfig: Record<LogStatus, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-gray-100 text-gray-700' },
  submitted: { label: 'Submitted', className: 'bg-amber-100 text-amber-700' },
  consultant_approved: { label: 'Consultant Approved', className: 'bg-indigo-100 text-indigo-700' },
  pm_approved: { label: 'Approved', className: 'bg-green-100 text-green-700' },
  rejected: { label: 'Rejected', className: 'bg-red-100 text-red-700' },
}

function checkItem(label: string, complete: boolean) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <div className={`grid h-4 w-4 place-items-center rounded border ${complete ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300'}`}>
        {complete && <CheckCircle2 className="h-3 w-3" />}
      </div>
      <span className={complete ? 'text-foreground' : 'text-muted-foreground'}>{label}</span>
    </div>
  )
}

type LaborEntry = { id: string; worker_type: string; number_of_workers: number; hours_worked: number; overtime_hours: number; hourly_rate: number; overtime_rate: number; cost: number }
type MaterialEntry = { id: string; name: string; supplier_id?: string | null; supplier_name?: string | null; quantity: number; unit: string; unit_cost: number; cost: number; delivery_date?: string | null }
type EquipmentEntry = { id: string; name: string; quantity: number; start_date?: string | null; hours_used: number; unit_cost: number; cost: number; idle_hours: number; idle_reason?: string | null }
type EquipmentIdleEntry = { id: string; equipment_id: string; reason: string; hours_idle: number }

export default function LogDetailPage({ params }: LogDetailPageProps) {
  const { projectId, logId } = use(params)
  const router = useRouter()
  const userRole = useProjectRole()

  const [project, setProject] = useState<ProjectDetail | null>(null)
  const [log, setLog] = useState<LogDetailResponse | null>(null)
  const [task, setTask] = useState<TaskListItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')
  const [labor, setLabor] = useState<LaborEntry[]>([])
  const [materials, setMaterials] = useState<MaterialEntry[]>([])
  const [equipment, setEquipment] = useState<EquipmentEntry[]>([])
  const [photos, setPhotos] = useState<DailyLogPhoto[]>([])
  const [taskGroups, setTaskGroups] = useState<{ task: TaskListItem; activities: TaskActivityItem[] }[]>([])
  const [completedActivityIds, setCompletedActivityIds] = useState<Set<string>>(new Set())
  const [equipmentIdle, setEquipmentIdle] = useState<Map<string, EquipmentIdleEntry[]>>(new Map())

  // Add entry forms
  const [addType, setAddType] = useState<'labor' | 'material' | 'equipment' | 'equipment_idle' | null>(null)
  const [formData, setFormData] = useState<Record<string, string>>({})
  const [addingEntry, setAddingEntry] = useState(false)
  const [selectedEquipmentForIdle, setSelectedEquipmentForIdle] = useState<string | null>(null)
  const [suppliers, setSuppliers] = useState<SupplierItem[]>([])

  // Track edit-before-resubmit for rejected logs
  const [hasBeenEdited, setHasBeenEdited] = useState(false)

  // Photo upload
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [deletingPhotoId, setDeletingPhotoId] = useState<string | null>(null)

  const loadData = async () => {
    setLoading(true)
    try {
      listSuppliers(projectId, { limit: 100 }).then(setSuppliers).catch(() => { })
      const [proj, logData, laborData, materialData, equipData, photoData] = await Promise.all([
        getProject(projectId),
        getLog(logId),
        listLogManpower(logId).catch(() => []),
        listLogMaterials(logId).catch(() => []),
        listLogEquipment(logId).catch(() => []),
        listLogPhotos(logId).catch(() => []),
      ])
      setProject(proj)
      setLog(logData)
      setLabor(laborData)
      setMaterials(materialData)
      setEquipment(equipData)
      setPhotos(photoData)

      // Load completed activities, then find all tasks involved in this log
      try {
        const completedActivities = await listLogCompletedActivities(logId).catch(() => [])
        const completedIds = new Set(completedActivities.map((a: any) => a.task_activity_id as string))
        setCompletedActivityIds(completedIds)

        // Load primary task for the sidebar info link
        if (logData.task_id) {
          getTask(logData.task_id).then(setTask).catch(() => { })
        }

        // Load ALL project tasks and find those with completed activities in this log
        if (completedIds.size > 0) {
          const tasksRes = await listProjectTasks(projectId).catch(() => ({ data: [] }))
          const allTasks: TaskListItem[] = Array.isArray(tasksRes) ? tasksRes : (tasksRes as any).data ?? []
          const groups: { task: TaskListItem; activities: TaskActivityItem[] }[] = []
          await Promise.all(
            allTasks.map(async (t: TaskListItem) => {
              const acts = await listTaskActivities(t.id).catch(() => [])
              if (acts.some((a: TaskActivityItem) => completedIds.has(a.id))) {
                groups.push({ task: t, activities: acts })
              }
            })
          )
          // Sort groups: primary task first
          groups.sort((a, b) =>
            a.task.id === logData.task_id ? -1 : b.task.id === logData.task_id ? 1 : 0
          )
          setTaskGroups(groups)
        } else {
          setTaskGroups([])
        }
      } catch {
        setTask(null)
        setTaskGroups([])
        setCompletedActivityIds(new Set())
      }

      // Load equipment idle time for each equipment
      const idleMap = new Map<string, EquipmentIdleEntry[]>()
      for (const eq of equipData) {
        try {
          const idle = await listEquipmentIdle(eq.id)
          if (idle.length > 0) {
            idleMap.set(eq.id, idle)
          }
        } catch {
          // Ignore errors
        }
      }
      setEquipmentIdle(idleMap)
    } catch {
      setProject(null)
      setLog(null)
      setTask(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [projectId, logId])

  useEffect(() => {
    const key = `log_edited_${logId}`
    if (sessionStorage.getItem(key) === '1') {
      setHasBeenEdited(true)
    }
  }, [logId])

  const handleAction = async (action: () => Promise<unknown>) => {
    setActionLoading(true)
    try {
      await action()
      await loadData()
      toast.success('Action completed')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Action failed')
    } finally {
      setActionLoading(false)
    }
  }

  const handleAddEntry = async () => {
    if (!addType) return
    setAddingEntry(true)
    try {
      if (addType === 'labor') {
        const wc = Number(formData.worker_count) || 1
        const hw = Number(formData.hours_worked) || 0
        const hr = Number(formData.hourly_rate) || 0
        const oh = Number(formData.overtime_hours) || 0
        const or_ = Number(formData.overtime_rate) || (hr * 1.5)
        const totalCost = (wc * hw * hr) + (wc * oh * or_)
        await addLogManpower(logId, {
          worker_type: formData.worker_type || 'general',
          number_of_workers: wc,
          hours_worked: hw,
          overtime_hours: oh,
          hourly_rate: hr,
          overtime_rate: or_,
          cost: totalCost,
        })
      } else if (addType === 'material') {
        const unitCost = Number(formData.unit_cost) || Number(formData.cost) || 0
        const qty = Number(formData.quantity) || 0
        const supplierObj = formData.supplier_id
          ? suppliers.find(s => s.id === formData.supplier_id)
          : null
        await addLogMaterial(logId, {
          name: formData.name || '',
          supplier_id: formData.supplier_id || undefined,
          supplier_name: supplierObj?.name || undefined,
          quantity: qty,
          unit: formData.unit || 'pcs',
          unit_cost: unitCost,
          cost: formData.unit_cost ? qty * unitCost : unitCost,
          delivery_date: formData.delivery_date || undefined,
        })
      } else if (addType === 'equipment') {
        const unitCost = Number(formData.unit_cost) || 0
        const hoursUsed = Number(formData.hours_used) || 0
        await addLogEquipment(logId, {
          name: formData.name || '',
          quantity: Number(formData.quantity) || 1,
          start_date: formData.start_date || undefined,
          hours_used: hoursUsed,
          unit_cost: unitCost,
          cost: formData.unit_cost ? hoursUsed * unitCost : Number(formData.cost) || 0,
          idle_hours: Number(formData.idle_hours) || 0,
          idle_reason: formData.idle_reason || undefined,
        })
      } else if (addType === 'equipment_idle' && selectedEquipmentForIdle) {
        await addEquipmentIdle(selectedEquipmentForIdle, {
          reason: formData.reason || '',
          hours_idle: Number(formData.hours_idle) || 0,
        })
      }
      setAddType(null)
      setFormData({})
      setSelectedEquipmentForIdle(null)
      await loadData()
      toast.success(`${addType.replace('_', ' ')} entry added`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to add entry')
    } finally {
      setAddingEntry(false)
    }
  }

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file
    const MAX_SIZE = 10 * 1024 * 1024 // 10MB
    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error('Invalid file type. Allowed: JPEG, PNG, WebP, GIF')
      return
    }

    if (file.size > MAX_SIZE) {
      toast.error('File too large. Maximum 10MB')
      return
    }

    setUploadingPhoto(true)
    try {
      // Upload using backend endpoint
      const formData = new FormData()
      formData.append('file', file)

      await fetch(`${getApiBaseUrl()}/daily-logs/${logId}/photos`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getAccessToken() ?? ''}`,
        },
        body: formData,
      })

      await loadData()
      toast.success('Photo uploaded successfully')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to upload photo')
    } finally {
      setUploadingPhoto(false)
      // Reset input
      event.target.value = ''
    }
  }

  const handlePhotoDelete = async (photoId: string) => {
    if (!confirm('Are you sure you want to delete this photo?')) return

    setDeletingPhotoId(photoId)
    try {
      await deleteLogPhoto(logId, photoId)
      await loadData()
      toast.success('Photo deleted')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete photo')
    } finally {
      setDeletingPhotoId(null)
    }
  }

  const handleDeleteLog = async () => {
    if (!confirm('Are you sure you want to delete this draft log? This action cannot be undone.')) return

    setActionLoading(true)
    try {
      await deleteDailyLog(logId)
      toast.success('Draft log deleted')
      router.push(`/dashboard/${projectId}/logs`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete log')
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-24 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!project || !log) return null

  const canSubmit = log.status === 'draft' && userRole === 'site_engineer'
  const canResubmit = log.status === 'rejected' && userRole === 'site_engineer' && hasBeenEdited
  const canConsultantApprove = log.status === 'submitted' && userRole === 'consultant'
  const canPmApprove = log.status === 'consultant_approved' && userRole === 'project_manager'
  const canReject = (
    (log.status === 'submitted' && userRole === 'consultant') ||
    (log.status === 'consultant_approved' && userRole === 'project_manager')
  )
  const canAddEntries = (log.status === 'draft' || log.status === 'rejected') && userRole === 'site_engineer'

  const totalLaborCost = labor.reduce((s, l) => s + l.cost, 0)
  const totalMaterialCost = materials.reduce((s, m) => s + m.cost, 0)
  const totalEquipmentCost = equipment.reduce((s, e) => s + e.cost, 0)
  const totalCost = totalLaborCost + totalMaterialCost + totalEquipmentCost

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href={`/dashboard/${projectId}/logs`}>
            <Button variant="outline" size="icon" className="h-9 w-9">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-semibold">#{log.id.slice(0, 8).toUpperCase()}</h1>
            <p className="text-sm text-muted-foreground">
              {new Date(log.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
            </p>
          </div>
        </div>

        <Badge className={statusConfig[log.status]?.className ?? 'bg-gray-100 text-gray-700'}>
          {statusConfig[log.status]?.label ?? log.status}
        </Badge>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.6fr_0.9fr]">
        <div className="space-y-6">
          {/* Log Info */}
          <Card>
            <CardContent className="p-5">
              <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
                <div className="space-y-3">
                  <p className="text-sm font-medium text-muted-foreground">Log Details</p>
                  {log.weather && (
                    <p className="text-sm"><span className="font-medium">Weather:</span> {log.weather}</p>
                  )}
                  {log.notes && (
                    <div>
                      <p className="text-sm font-medium">Notes:</p>
                      <p className="text-sm text-muted-foreground">{log.notes}</p>
                    </div>
                  )}
                  {!log.weather && !log.notes && (
                    <p className="text-sm text-muted-foreground">No notes or weather recorded.</p>
                  )}
                </div>

                <div className="space-y-3 rounded-xl border border-border bg-muted/20 p-4">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Status</p>
                    <Badge className={`mt-2 ${statusConfig[log.status]?.className ?? ''}`}>
                      {statusConfig[log.status]?.label ?? log.status}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Project</p>
                    <p className="mt-1 text-sm font-medium">{project.name}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Total Cost</p>
                    <p className="mt-1 text-sm font-semibold">ETB {totalCost.toLocaleString()}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Labor */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Human Resources ({labor.length})</CardTitle>
              {canAddEntries && (
                <Button variant="outline" size="sm" className="gap-1" onClick={() => { setAddType('labor'); setFormData({}) }}>
                  <Plus className="h-3.5 w-3.5" /> Add
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {labor.length === 0 ? (
                <p className="text-sm text-muted-foreground">No labor records.</p>
              ) : (
                <div className="space-y-2">
                  {labor.map((l, i) => (
                    <div key={i} className="rounded border p-3 text-sm space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium capitalize">{l.worker_type}</span>
                        <span className="font-medium">ETB {l.cost.toLocaleString()}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 text-xs text-muted-foreground">
                        <div>No. of Workers: {l.number_of_workers}</div>
                        <div>Hourly Rate: ETB {l.hourly_rate.toLocaleString()}</div>
                        <div>Regular Hours: {l.hours_worked}h</div>
                        <div>Overtime Hours: {l.overtime_hours}h</div>
                        {l.overtime_hours > 0 && <div className="col-span-2">Overtime Rate: ETB {l.overtime_rate.toLocaleString()}/hr</div>}
                      </div>
                    </div>
                  ))}
                  <p className="text-right text-sm font-medium pt-2 border-t">Total: ETB {totalLaborCost.toLocaleString()}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Materials */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Materials ({materials.length})</CardTitle>
              {canAddEntries && (
                <Button variant="outline" size="sm" className="gap-1" onClick={() => { setAddType('material'); setFormData({}) }}>
                  <Plus className="h-3.5 w-3.5" /> Add
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {materials.length === 0 ? (
                <p className="text-sm text-muted-foreground">No materials recorded.</p>
              ) : (
                <div className="space-y-2">
                  {materials.map((m, i) => {
                    const supplier = m.supplier_id ? suppliers.find(s => s.id === m.supplier_id) : null
                    return (
                      <div key={i} className="rounded border p-3 text-sm space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{m.name}</span>
                          <span className="font-medium">ETB {m.cost.toLocaleString()}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 text-xs text-muted-foreground">
                          {supplier && (
                            <div className="col-span-2">
                              Supplier: {supplier.name} {supplier.role ? `(${supplier.role})` : ''}
                            </div>
                          )}
                          <div>Quantity: {m.quantity} {m.unit}</div>
                          <div>Unit Cost: ETB {m.unit_cost.toLocaleString()}</div>
                          {m.delivery_date && (
                            <div className="col-span-2">
                              Delivery: {new Date(m.delivery_date).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                  <p className="text-right text-sm font-medium pt-2 border-t">Total: ETB {totalMaterialCost.toLocaleString()}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Equipment */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Equipment ({equipment.length})</CardTitle>
              {canAddEntries && (
                <Button variant="outline" size="sm" className="gap-1" onClick={() => { setAddType('equipment'); setFormData({}) }}>
                  <Plus className="h-3.5 w-3.5" /> Add
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {equipment.length === 0 ? (
                <p className="text-sm text-muted-foreground">No equipment recorded.</p>
              ) : (
                <div className="space-y-2">
                  {equipment.map((e) => {
                    const idle = equipmentIdle.get(e.id) || []
                    const totalIdleHours = idle.reduce((sum, i) => sum + i.hours_idle, 0) + (e.idle_hours || 0)
                    return (
                      <div key={e.id} className="space-y-2">
                        <div className="rounded border p-3 text-sm space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{e.name}</span>
                            <span className="font-medium">ETB {e.cost.toLocaleString()}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-x-4 text-xs text-muted-foreground">
                            <div>Quantity: {e.quantity}</div>
                            {e.start_date && (
                              <div>Start: {new Date(e.start_date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</div>
                            )}
                            <div>Hours/Trip: {e.hours_used}h</div>
                            <div>Unit Cost: ETB {e.unit_cost.toLocaleString()}</div>
                            {totalIdleHours > 0 && <div className="col-span-2 text-amber-600">Idle Hours: {totalIdleHours}h</div>}
                          </div>
                        </div>
                        {e.idle_hours > 0 && e.idle_reason && (
                          <div className="ml-4">
                            <div className="flex items-start gap-2 rounded bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 p-2 text-xs">
                              <AlertCircle className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-amber-900 dark:text-amber-100">Idle: {e.idle_hours}h</p>
                                <p className="text-amber-700 dark:text-amber-300">Reason: {e.idle_reason}</p>
                              </div>
                            </div>
                          </div>
                        )}
                        {idle.length > 0 && (
                          <div className="ml-4 space-y-1">
                            {idle.map((i) => (
                              <div key={i.id} className="flex items-start gap-2 rounded bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 p-2 text-xs">
                                <AlertCircle className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-amber-900 dark:text-amber-100">Idle: {i.hours_idle}h</p>
                                  <p className="text-amber-700 dark:text-amber-300">Reason: {i.reason}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        {canAddEntries && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="ml-4 h-7 gap-1 text-xs"
                            onClick={() => {
                              setSelectedEquipmentForIdle(e.id)
                              setAddType('equipment_idle')
                              setFormData({})
                            }}
                          >
                            <Plus className="h-3 w-3" />
                            Record Idle Time
                          </Button>
                        )}
                      </div>
                    )
                  })}
                  <p className="text-right text-sm font-medium pt-2 border-t">Total: ETB {totalEquipmentCost.toLocaleString()}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Photos */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <ImageIcon className="h-4 w-4" />
                Photos ({photos.length})
              </CardTitle>
              {canAddEntries && (
                <div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    disabled={uploadingPhoto}
                    className="hidden"
                    id="photo-upload"
                  />
                  <label htmlFor="photo-upload">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1"
                      disabled={uploadingPhoto}
                      asChild
                    >
                      <span>
                        {uploadingPhoto ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Upload className="h-3.5 w-3.5" />
                        )}
                        {uploadingPhoto ? 'Uploading...' : 'Upload'}
                      </span>
                    </Button>
                  </label>
                </div>
              )}
            </CardHeader>
            <CardContent>
              {photos.length === 0 ? (
                <p className="text-sm text-muted-foreground">No photos attached.</p>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {photos.map((photo) => (
                    <div key={photo.id} className="relative group rounded-lg overflow-hidden border">
                      <img
                        src={photo.url_path}
                        alt={photo.original_filename || 'Daily log photo'}
                        className="w-full h-32 object-cover"
                      />
                      {canAddEntries && (
                        <Button
                          variant="destructive"
                          size="icon"
                          className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => handlePhotoDelete(photo.id)}
                          disabled={deletingPhotoId === photo.id}
                        >
                          {deletingPhotoId === photo.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      )}
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                        <p className="text-xs text-white truncate">
                          {photo.original_filename || 'Photo'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Activity Completion */}
          {(taskGroups.length > 0 || completedActivityIds.size > 0) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <ListChecks className="h-4 w-4" />
                  Activities Completed Today
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  {completedActivityIds.size} {completedActivityIds.size === 1 ? 'activity' : 'activities'} completed in this log
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                {taskGroups.map(({ task: grpTask, activities }) => (
                  <div key={grpTask.id} className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {grpTask.title}
                    </p>
                    {activities.filter((a: TaskActivityItem) => completedActivityIds.has(a.id)).map((activity) => {
                      const isCompleted = true
                      return (
                        <div key={activity.id} className="flex items-center justify-between rounded-lg border p-2.5">
                          <div className="flex items-center gap-3 min-w-0">
                            <button
                              type="button"
                              disabled={!canAddEntries}
                              className={`grid h-5 w-5 shrink-0 place-items-center rounded border transition-colors ${isCompleted
                                ? 'border-emerald-500 bg-emerald-500 text-white'
                                : 'border-slate-300 hover:border-emerald-400'
                                } ${!canAddEntries ? 'opacity-50 cursor-not-allowed' : ''}`}
                              onClick={async () => {
                                if (!canAddEntries) return
                                try {
                                  if (isCompleted) {
                                    await removeLogCompletedActivity(logId, activity.id)
                                    setCompletedActivityIds(prev => { const n = new Set(prev); n.delete(activity.id); return n })
                                    toast.success('Activity unmarked')
                                  } else {
                                    await addLogCompletedActivity(logId, activity.id)
                                    setCompletedActivityIds(prev => new Set(prev).add(activity.id))
                                    toast.success('Activity marked complete')
                                  }
                                } catch (e) {
                                  toast.error(e instanceof Error ? e.message : 'Failed to update')
                                }
                              }}
                            >
                              {isCompleted && <CheckCircle2 className="h-3 w-3" />}
                            </button>
                            <span className={`text-sm truncate ${isCompleted ? 'font-medium' : ''}`}>
                              {activity.name}
                            </span>
                          </div>
                          <Badge variant="outline" className="text-[10px] shrink-0">
                            {activity.percentage}%
                          </Badge>
                        </div>
                      )
                    })}
                  </div>
                ))}
                {canAddEntries && (
                  <p className="text-xs text-muted-foreground pt-2">
                    Mark activities completed today. Task progress will update when log is approved by PM.
                  </p>
                )}
                {!canAddEntries && completedActivityIds.size === 0 && (
                  <p className="text-sm text-muted-foreground">No activities were completed in this log.</p>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right sidebar */}
        <div className="space-y-6">
          {/* Task Context */}
          {task && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Task</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Link href={`/dashboard/${projectId}/tasks/${task.id}`} className="font-medium text-primary hover:underline">
                    {task.title}
                  </Link>
                  <div className="mt-2 flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">
                      {task.status.replace('_', ' ')}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{task.progress_percentage}% complete</span>
                  </div>
                </div>
                {task.assignee && (
                  <div className="text-sm">
                    <p className="text-muted-foreground">Assigned to</p>
                    <p className="font-medium">{task.assignee.full_name}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Approval Progress */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Approval Progress</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {checkItem('Log created (draft)', true)}
              {checkItem('Submitted by site engineer', !['draft', 'rejected'].includes(log.status))}
              {checkItem('Consultant approved', ['consultant_approved', 'pm_approved'].includes(log.status))}
              {checkItem('PM final approval', log.status === 'pm_approved')}
              {log.status === 'rejected' && (
                <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 p-3 text-sm">
                  <div className="flex items-center gap-2 text-red-700 dark:text-red-400 font-medium">
                    <XCircle className="h-4 w-4" />
                    Rejected
                  </div>
                  {log.rejection_reason && (
                    <p className="mt-1 text-red-600 dark:text-red-400">{log.rejection_reason}</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {canAddEntries && (
                <Link href={`/dashboard/${projectId}/logs/${logId}/edit`}>
                  <Button variant="outline" className="w-full gap-2">
                    <Pencil className="h-4 w-4" />
                    Edit Log
                  </Button>
                </Link>
              )}
              {canSubmit && (
                <Button className="w-full mt-2" disabled={actionLoading} onClick={() => handleAction(() => submitLog(logId))}>
                  Submit for Review
                </Button>
              )}
              {log.status === 'rejected' && userRole === 'site_engineer' && !hasBeenEdited && (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  Edit the log first, then you can re-submit.
                </p>
              )}
              {canResubmit && (
                <Button className="w-full mt-2" disabled={actionLoading} onClick={() => {
                  sessionStorage.removeItem(`log_edited_${logId}`)
                  setHasBeenEdited(false)
                  handleAction(() => submitLog(logId))
                }}>
                  Re-submit Log
                </Button>
              )}
              {canConsultantApprove && (
                <Button className="w-full gap-2" disabled={actionLoading} onClick={() => handleAction(() => consultantApproveLog(logId))}>
                  <CheckCircle2 className="h-4 w-4" />
                  Approve (Consultant)
                </Button>
              )}
              {canPmApprove && (
                <Button className="w-full gap-2" disabled={actionLoading} onClick={() => handleAction(() => pmApproveLog(logId))}>
                  <CheckCircle2 className="h-4 w-4" />
                  Final Approve (PM)
                </Button>
              )}
              {canReject && (
                <Button variant="destructive" className="w-full gap-2" disabled={actionLoading} onClick={() => setRejectOpen(true)}>
                  <XCircle className="h-4 w-4" />
                  Reject
                </Button>
              )}
              {!canSubmit && !canConsultantApprove && !canPmApprove && !canReject && !canAddEntries && (
                <p className="text-sm text-muted-foreground text-center py-2">No actions available.</p>
              )}
            </CardContent>
          </Card>

          {/* Workflow info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-start gap-3">
                <Clock3 className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="font-medium">Date</p>
                  <p className="text-muted-foreground">{new Date(log.date).toLocaleDateString()}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Users className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="font-medium">Approval chain</p>
                  <p className="text-muted-foreground">Site Engineer → Consultant → PM</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <FileText className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="font-medium">Cost summary</p>
                  <p className="text-muted-foreground">
                    Labor: ETB {totalLaborCost.toLocaleString()} | Materials: ETB {totalMaterialCost.toLocaleString()} | Equipment: ETB {totalEquipmentCost.toLocaleString()}
                  </p>
                  <p className="font-semibold text-foreground mt-1">
                    Total: ETB {(totalLaborCost + totalMaterialCost + totalEquipmentCost).toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Delete Draft - Separated at bottom for safety */}
          {canAddEntries && log.status === 'draft' && (
            <Card className="border-destructive/50">
              <CardHeader>
                <CardTitle className="text-base text-destructive">Danger Zone</CardTitle>
              </CardHeader>
              <CardContent>
                <Button
                  variant="destructive"
                  className="w-full gap-2"
                  disabled={actionLoading}
                  onClick={handleDeleteLog}
                >
                  <Trash2 className="h-4 w-4" />
                  Delete Draft Log
                </Button>
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  This action cannot be undone
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Add Entry Dialog */}
      <Dialog open={!!addType} onOpenChange={(open) => { if (!open) { setAddType(null); setSelectedEquipmentForIdle(null) } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="capitalize">Add {addType?.replace('_', ' ')} Entry</DialogTitle>
            <DialogDescription>
              {addType === 'labor' && 'Record labor hours and cost for this log.'}
              {addType === 'material' && 'Record materials used for this log.'}
              {addType === 'equipment' && 'Record equipment usage for this log.'}
              {addType === 'equipment_idle' && 'Record idle time and reason for equipment downtime.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {addType === 'labor' && (
              <>
                <div className="space-y-1.5">
                  <Label>Labor Type *</Label>
                  <Input placeholder="e.g. Mason, Carpenter, Electrician" value={formData.worker_type ?? ''} onChange={(e) => setFormData(p => ({ ...p, worker_type: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Worker Count</Label>
                    <Input type="number" min={1} placeholder="1" value={formData.worker_count ?? '1'} onChange={(e) => setFormData(p => ({ ...p, worker_count: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Hourly Rate (ETB) *</Label>
                    <Input type="number" min={0} step={0.01} placeholder="Rate/hr" value={formData.hourly_rate ?? ''} onChange={(e) => setFormData(p => ({ ...p, hourly_rate: e.target.value }))} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Regular Hours</Label>
                    <Input type="number" min={0} step={0.5} placeholder="8" value={formData.hours_worked ?? '8'} onChange={(e) => setFormData(p => ({ ...p, hours_worked: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Overtime Hours</Label>
                    <Input type="number" min={0} step={0.5} placeholder="0" value={formData.overtime_hours ?? '0'} onChange={(e) => setFormData(p => ({ ...p, overtime_hours: e.target.value }))} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Overtime Rate (ETB/hr, default 1.5×)</Label>
                  <Input type="number" min={0} step={0.01} placeholder="Optional" value={formData.overtime_rate ?? ''} onChange={(e) => setFormData(p => ({ ...p, overtime_rate: e.target.value }))} />
                </div>
                {formData.worker_type && formData.hourly_rate && (
                  <p className="text-right text-sm font-medium">
                    Total: ETB {(((Number(formData.worker_count) || 1) * (Number(formData.hours_worked) || 0) * (Number(formData.hourly_rate) || 0)) + ((Number(formData.worker_count) || 1) * (Number(formData.overtime_hours) || 0) * ((Number(formData.overtime_rate)) || (Number(formData.hourly_rate) * 1.5)))).toLocaleString()}
                  </p>
                )}
              </>
            )}
            {addType === 'material' && (
              <>
                {suppliers.length > 0 && (
                  <div className="space-y-1.5">
                    <Label>Supplier (Optional)</Label>
                    <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm" value={formData.supplier_id ?? ''} onChange={(e) => setFormData(p => ({ ...p, supplier_id: e.target.value }))}>
                      <option value="">No supplier</option>
                      {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label>Material Type *</Label>
                  <Input placeholder="e.g. Cement, Rebar, Sand" value={formData.name ?? ''} onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))} />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1.5">
                    <Label>Quantity *</Label>
                    <Input type="number" min={0} placeholder="120" value={formData.quantity ?? ''} onChange={(e) => setFormData(p => ({ ...p, quantity: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Unit</Label>
                    <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm" value={formData.unit ?? 'bags'} onChange={(e) => setFormData(p => ({ ...p, unit: e.target.value }))}>
                      {['bags', 'kg', 'ton', 'm3', 'm2', 'm', 'pcs', 'liters'].map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Unit Cost (ETB) *</Label>
                    <Input type="number" min={0} step={0.01} placeholder="450" value={formData.unit_cost ?? ''} onChange={(e) => setFormData(p => ({ ...p, unit_cost: e.target.value }))} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Delivery Date</Label>
                  <Input type="date" value={formData.delivery_date ?? new Date().toISOString().split('T')[0]} onChange={(e) => setFormData(p => ({ ...p, delivery_date: e.target.value }))} />
                </div>
                {formData.quantity && formData.unit_cost && (
                  <p className="text-right text-sm font-medium">Total: ETB {((Number(formData.quantity) || 0) * (Number(formData.unit_cost) || 0)).toLocaleString()}</p>
                )}
              </>
            )}
            {addType === 'equipment' && (
              <>
                <div className="space-y-1.5">
                  <Label>Equipment Name *</Label>
                  <Input placeholder="e.g. Excavator, Compactor, Crane" value={formData.name ?? ''} onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Hours Used *</Label>
                    <Input type="number" min={0} step={0.5} placeholder="5" value={formData.hours_used ?? ''} onChange={(e) => setFormData(p => ({ ...p, hours_used: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Cost (ETB) *</Label>
                    <Input type="number" min={0} placeholder="7500" value={formData.cost ?? ''} onChange={(e) => setFormData(p => ({ ...p, cost: e.target.value }))} />
                  </div>
                </div>
              </>
            )}
            {addType === 'equipment_idle' && (
              <>
                <div className="space-y-1.5">
                  <Label>Reason for Idle Time *</Label>
                  <Textarea
                    placeholder="e.g. Mechanical breakdown, Waiting for materials, Weather delay"
                    value={formData.reason ?? ''}
                    onChange={(e) => setFormData(p => ({ ...p, reason: e.target.value }))}
                    rows={3}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Idle Hours *</Label>
                  <Input
                    type="number"
                    min={0}
                    step={0.5}
                    placeholder="2.5"
                    value={formData.hours_idle ?? ''}
                    onChange={(e) => setFormData(p => ({ ...p, hours_idle: e.target.value }))}
                  />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAddType(null); setSelectedEquipmentForIdle(null) }}>Cancel</Button>
            <Button onClick={() => void handleAddEntry()} disabled={addingEntry}>
              {addingEntry ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Add Entry
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rejection Dialog */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject Daily Log</DialogTitle>
            <DialogDescription>
              Provide a reason. The site engineer will correct and re-submit.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Textarea
              placeholder="Explain what needs to be corrected..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={actionLoading || !rejectionReason.trim()}
              onClick={() => {
                setRejectOpen(false)
                handleAction(() => rejectLog(logId, rejectionReason.trim()))
                setRejectionReason('')
              }}
            >
              Reject Log
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
