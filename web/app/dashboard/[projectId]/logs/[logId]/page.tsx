'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
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
  listLogLabor,
  listLogMaterials,
  listLogEquipment,
  addLogLabor,
  addLogMaterial,
  addLogEquipment,
} from '@/lib/api'
import type { LogDetailResponse, ProjectDetail } from '@/lib/api-types'
import type { LogStatus } from '@/lib/domain'
import { useProjectRole } from '@/lib/project-role-context'
import { ArrowLeft, CheckCircle2, Clock3, FileText, Loader2, MapPin, Plus, Users, XCircle } from 'lucide-react'
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

type LaborEntry = { worker_type: string; hours_worked: number; cost: number }
type MaterialEntry = { name: string; quantity: number; unit: string; cost: number }
type EquipmentEntry = { name: string; hours_used: number; cost: number }

export default function LogDetailPage({ params }: LogDetailPageProps) {
  const { projectId, logId } = use(params)
  const userRole = useProjectRole()

  const [project, setProject] = useState<ProjectDetail | null>(null)
  const [log, setLog] = useState<LogDetailResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')
  const [labor, setLabor] = useState<LaborEntry[]>([])
  const [materials, setMaterials] = useState<MaterialEntry[]>([])
  const [equipment, setEquipment] = useState<EquipmentEntry[]>([])

  // Add entry forms
  const [addType, setAddType] = useState<'labor' | 'material' | 'equipment' | null>(null)
  const [formData, setFormData] = useState<Record<string, string>>({})
  const [addingEntry, setAddingEntry] = useState(false)

  const loadData = async () => {
    setLoading(true)
    try {
      const [proj, logData, laborData, materialData, equipData] = await Promise.all([
        getProject(projectId),
        getLog(logId),
        listLogLabor(logId).catch(() => []),
        listLogMaterials(logId).catch(() => []),
        listLogEquipment(logId).catch(() => []),
      ])
      setProject(proj)
      setLog(logData)
      setLabor(laborData)
      setMaterials(materialData)
      setEquipment(equipData)
    } catch {
      setProject(null)
      setLog(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [projectId, logId])

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
        await addLogLabor(logId, {
          worker_type: formData.worker_type || 'general',
          hours_worked: Number(formData.hours_worked) || 0,
          cost: Number(formData.cost) || 0,
        })
      } else if (addType === 'material') {
        await addLogMaterial(logId, {
          name: formData.name || '',
          quantity: Number(formData.quantity) || 0,
          unit: formData.unit || 'pcs',
          cost: Number(formData.cost) || 0,
        })
      } else if (addType === 'equipment') {
        await addLogEquipment(logId, {
          name: formData.name || '',
          hours_used: Number(formData.hours_used) || 0,
          cost: Number(formData.cost) || 0,
        })
      }
      setAddType(null)
      setFormData({})
      await loadData()
      toast.success(`${addType} entry added`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to add entry')
    } finally {
      setAddingEntry(false)
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

  const canSubmit = (log.status === 'draft' || log.status === 'rejected') && userRole === 'site_engineer'
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
              <CardTitle className="text-base">Labor ({labor.length})</CardTitle>
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
                    <div key={i} className="flex items-center justify-between rounded border p-2 text-sm">
                      <span className="font-medium capitalize">{l.worker_type}</span>
                      <span>{l.hours_worked}h — ETB {l.cost.toLocaleString()}</span>
                    </div>
                  ))}
                  <p className="text-right text-sm font-medium">Total: ETB {totalLaborCost.toLocaleString()}</p>
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
                  {materials.map((m, i) => (
                    <div key={i} className="flex items-center justify-between rounded border p-2 text-sm">
                      <span className="font-medium">{m.name}</span>
                      <span>{m.quantity} {m.unit} — ETB {m.cost.toLocaleString()}</span>
                    </div>
                  ))}
                  <p className="text-right text-sm font-medium">Total: ETB {totalMaterialCost.toLocaleString()}</p>
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
                  {equipment.map((e, i) => (
                    <div key={i} className="flex items-center justify-between rounded border p-2 text-sm">
                      <span className="font-medium">{e.name}</span>
                      <span>{e.hours_used}h — ETB {e.cost.toLocaleString()}</span>
                    </div>
                  ))}
                  <p className="text-right text-sm font-medium">Total: ETB {totalEquipmentCost.toLocaleString()}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right sidebar */}
        <div className="space-y-6">
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
              {canSubmit && (
                <Button className="w-full" disabled={actionLoading} onClick={() => handleAction(() => submitLog(logId))}>
                  {log.status === 'rejected' ? 'Re-submit Log' : 'Submit for Review'}
                </Button>
              )}
              {canConsultantApprove && (
                <Button className="w-full" disabled={actionLoading} onClick={() => handleAction(() => consultantApproveLog(logId))}>
                  Approve (Consultant)
                </Button>
              )}
              {canPmApprove && (
                <Button className="w-full" disabled={actionLoading} onClick={() => handleAction(() => pmApproveLog(logId))}>
                  Final Approve (PM)
                </Button>
              )}
              {canReject && (
                <Button variant="destructive" className="w-full" disabled={actionLoading} onClick={() => setRejectOpen(true)}>
                  Reject
                </Button>
              )}
              {!canSubmit && !canConsultantApprove && !canPmApprove && !canReject && (
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
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Add Entry Dialog */}
      <Dialog open={!!addType} onOpenChange={(open) => { if (!open) setAddType(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="capitalize">Add {addType} Entry</DialogTitle>
            <DialogDescription>
              {addType === 'labor' && 'Record labor hours and cost for this log.'}
              {addType === 'material' && 'Record materials used for this log.'}
              {addType === 'equipment' && 'Record equipment usage for this log.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {addType === 'labor' && (
              <>
                <div className="space-y-1.5">
                  <Label>Worker Type *</Label>
                  <Input placeholder="e.g. Mason, Carpenter, Electrician" value={formData.worker_type ?? ''} onChange={(e) => setFormData(p => ({ ...p, worker_type: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Hours Worked *</Label>
                    <Input type="number" min={0} step={0.5} placeholder="8" value={formData.hours_worked ?? ''} onChange={(e) => setFormData(p => ({ ...p, hours_worked: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Cost (ETB) *</Label>
                    <Input type="number" min={0} placeholder="2400" value={formData.cost ?? ''} onChange={(e) => setFormData(p => ({ ...p, cost: e.target.value }))} />
                  </div>
                </div>
              </>
            )}
            {addType === 'material' && (
              <>
                <div className="space-y-1.5">
                  <Label>Material Name *</Label>
                  <Input placeholder="e.g. Cement, Rebar, Sand" value={formData.name ?? ''} onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))} />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label>Quantity *</Label>
                    <Input type="number" min={0} placeholder="120" value={formData.quantity ?? ''} onChange={(e) => setFormData(p => ({ ...p, quantity: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Unit *</Label>
                    <Input placeholder="bags, kg, m3" value={formData.unit ?? ''} onChange={(e) => setFormData(p => ({ ...p, unit: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Cost (ETB) *</Label>
                    <Input type="number" min={0} placeholder="54000" value={formData.cost ?? ''} onChange={(e) => setFormData(p => ({ ...p, cost: e.target.value }))} />
                  </div>
                </div>
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddType(null)}>Cancel</Button>
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
