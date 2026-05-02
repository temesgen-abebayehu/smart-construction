'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  getLog,
  getProject,
  submitLog,
  reviewLog,
  consultantApproveLog,
  pmApproveLog,
  rejectLog,
  listLogLabor,
  listLogMaterials,
  listLogEquipment,
} from '@/lib/api'
import type { LogDetailResponse, ProjectDetail } from '@/lib/api-types'
import type { LogStatus } from '@/lib/domain'
import { useProjectRole } from '@/lib/project-role-context'
import { AlertTriangle, ArrowLeft, CheckCircle2, Clock3, FileText, MapPin, Users, Loader2 } from 'lucide-react'

interface LogDetailPageProps {
  params: Promise<{ projectId: string; logId: string }>
}

const statusConfig: Record<LogStatus, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-gray-100 text-gray-700' },
  submitted: { label: 'Submitted', className: 'bg-amber-100 text-amber-700' },
  reviewed: { label: 'Reviewed', className: 'bg-orange-100 text-orange-700' },
  consultant_approved: { label: 'Consultant Approved', className: 'bg-indigo-100 text-indigo-700' },
  pm_approved: { label: 'PM Approved', className: 'bg-green-100 text-green-700' },
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

export default function LogDetailPage({ params }: LogDetailPageProps) {
  const { projectId, logId } = use(params)
  const userRole = useProjectRole()

  const [project, setProject] = useState<ProjectDetail | null>(null)
  const [log, setLog] = useState<LogDetailResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [labor, setLabor] = useState<{ worker_type: string; hours_worked: number; cost: number }[]>([])
  const [materials, setMaterials] = useState<{ name: string; quantity: number; unit: string; cost: number }[]>([])
  const [equipment, setEquipment] = useState<{ name: string; hours_used: number; cost: number }[]>([])

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
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Action failed')
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

  // Determine which actions the current role can perform based on log status
  const canSubmit = log.status === 'draft' && (userRole === 'site_engineer' || userRole === 'owner' || userRole === 'project_manager')
  const canReview = log.status === 'submitted' && (userRole === 'office_engineer' || userRole === 'owner' || userRole === 'project_manager')
  const canConsultantApprove = log.status === 'reviewed' && (userRole === 'consultant' || userRole === 'owner' || userRole === 'project_manager')
  const canPmApprove = log.status === 'consultant_approved' && (userRole === 'project_manager' || userRole === 'owner')
  const canReject = ['submitted', 'reviewed', 'consultant_approved'].includes(log.status) && userRole !== 'site_engineer'

  const totalLaborCost = labor.reduce((s, l) => s + l.cost, 0)
  const totalMaterialCost = materials.reduce((s, m) => s + m.cost, 0)
  const totalEquipmentCost = equipment.reduce((s, e) => s + e.cost, 0)

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
          <Card>
            <CardContent className="p-5">
              <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Log Details</p>
                  <div className="mt-3 space-y-2">
                    {log.weather && (
                      <p className="text-sm"><span className="font-medium">Weather:</span> {log.weather}</p>
                    )}
                    {log.notes && (
                      <div>
                        <p className="text-sm font-medium">Notes:</p>
                        <p className="text-sm text-muted-foreground">{log.notes}</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-3 rounded-xl border border-border bg-muted/20 p-4">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Current Status</p>
                    <Badge className={`mt-2 ${statusConfig[log.status]?.className ?? ''}`}>
                      {statusConfig[log.status]?.label ?? log.status}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Project</p>
                    <p className="mt-1 text-sm font-medium">{project.name}</p>
                    <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5" />{project.location}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Labor */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Labor ({labor.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {labor.length === 0 ? (
                <p className="text-sm text-muted-foreground">No labor records.</p>
              ) : (
                <div className="space-y-2">
                  {labor.map((l, i) => (
                    <div key={i} className="flex items-center justify-between rounded border p-2 text-sm">
                      <span className="font-medium">{l.worker_type}</span>
                      <span>{l.hours_worked}h - ETB {l.cost.toLocaleString()}</span>
                    </div>
                  ))}
                  <p className="text-right text-sm font-medium">Total: ETB {totalLaborCost.toLocaleString()}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Materials */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Materials ({materials.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {materials.length === 0 ? (
                <p className="text-sm text-muted-foreground">No materials recorded.</p>
              ) : (
                <div className="space-y-2">
                  {materials.map((m, i) => (
                    <div key={i} className="flex items-center justify-between rounded border p-2 text-sm">
                      <span className="font-medium">{m.name}</span>
                      <span>{m.quantity} {m.unit} - ETB {m.cost.toLocaleString()}</span>
                    </div>
                  ))}
                  <p className="text-right text-sm font-medium">Total: ETB {totalMaterialCost.toLocaleString()}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Equipment */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Equipment ({equipment.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {equipment.length === 0 ? (
                <p className="text-sm text-muted-foreground">No equipment recorded.</p>
              ) : (
                <div className="space-y-2">
                  {equipment.map((e, i) => (
                    <div key={i} className="flex items-center justify-between rounded border p-2 text-sm">
                      <span className="font-medium">{e.name}</span>
                      <span>{e.hours_used}h - ETB {e.cost.toLocaleString()}</span>
                    </div>
                  ))}
                  <p className="text-right text-sm font-medium">Total: ETB {totalEquipmentCost.toLocaleString()}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Approval Progress</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {checkItem('Log created (draft)', true)}
              {checkItem('Submitted by site engineer', log.status !== 'draft')}
              {checkItem('Reviewed by office engineer', ['reviewed', 'consultant_approved', 'pm_approved'].includes(log.status))}
              {checkItem('Consultant approved', ['consultant_approved', 'pm_approved'].includes(log.status))}
              {checkItem('PM final approval', log.status === 'pm_approved')}
              {log.notes && (
                <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
                  <p className="font-medium text-foreground">Notes</p>
                  <p className="mt-1">{log.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {canSubmit && (
                <Button className="w-full" disabled={actionLoading} onClick={() => handleAction(() => submitLog(logId))}>
                  Submit Log
                </Button>
              )}
              {canReview && (
                <Button className="w-full" disabled={actionLoading} onClick={() => handleAction(() => reviewLog(logId))}>
                  Mark as Reviewed
                </Button>
              )}
              {canConsultantApprove && (
                <Button className="w-full" disabled={actionLoading} onClick={() => handleAction(() => consultantApproveLog(logId))}>
                  Consultant Approve
                </Button>
              )}
              {canPmApprove && (
                <Button className="w-full" disabled={actionLoading} onClick={() => handleAction(() => pmApproveLog(logId))}>
                  PM Final Approve
                </Button>
              )}
              {canReject && (
                <Button variant="destructive" className="w-full" disabled={actionLoading} onClick={() => handleAction(() => rejectLog(logId))}>
                  Reject Log
                </Button>
              )}
              {!canSubmit && !canReview && !canConsultantApprove && !canPmApprove && !canReject && (
                <p className="text-sm text-muted-foreground text-center py-2">No actions available for your role at this status.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Approval Workflow</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex items-start gap-3">
                <Clock3 className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="font-medium">Log created</p>
                  <p className="text-muted-foreground">Date: {new Date(log.date).toLocaleDateString()}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Users className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="font-medium">Approval chain</p>
                  <p className="text-muted-foreground">Site Eng → Office Eng → Consultant → PM</p>
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
    </div>
  )
}
