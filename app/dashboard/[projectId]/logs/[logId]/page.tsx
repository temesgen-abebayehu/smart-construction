'use client'

import { use } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { mockDailyLogs, mockProjects, mockTasks, mockUsers, type ProjectRole, type LogStatus } from '@/lib/mock-data'
import { AlertTriangle, ArrowLeft, CheckCircle2, Clock3, FileText, MapPin, PenTool, Users } from 'lucide-react'

interface LogDetailPageProps {
  params: Promise<{ projectId: string; logId: string }>
}

const statusConfig: Record<LogStatus, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-gray-100 text-gray-700' },
  submitted: { label: 'Submitted', className: 'bg-amber-100 text-amber-700' },
  under_review: { label: 'Under Review', className: 'bg-orange-100 text-orange-700' },
  consultant_approved: { label: 'Consultant Approved', className: 'bg-indigo-100 text-indigo-700' },
  approved: { label: 'Approved', className: 'bg-green-100 text-green-700' },
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

export default function LogDetailPage({ params }: LogDetailPageProps) {
  const { projectId, logId } = use(params)
  const searchParams = useSearchParams()
  const userRole = (searchParams.get('role') as ProjectRole) || 'site_engineer'

  const project = mockProjects.find((item) => item.id === projectId)
  const log = mockDailyLogs.find((item) => item.id === logId && item.project_id === projectId)

  if (!project || !log) return null

  const task = mockTasks.find((item) => item.id === log.task_id)
  const submitter = mockUsers.find((item) => item.id === log.submitted_by)
  const workProgress = 64.2

  const evidenceImages = ['/images/site-1.jpg', '/images/site-2.jpg', '/images/site-3.jpg']

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href={`/dashboard/${projectId}/logs?role=${userRole}`}>
            <Button variant="outline" size="icon" className="h-9 w-9">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-semibold">#{log.id.toUpperCase()}</h1>
            <p className="text-sm text-muted-foreground">
              {new Date(log.log_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
              {' • '}
              {task?.title || 'Unknown Task'}
            </p>
          </div>
        </div>

        <Badge className={statusConfig[log.status].className}>{statusConfig[log.status].label}</Badge>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.6fr_0.9fr]">
        <div className="space-y-6">
          <Card>
            <CardContent className="p-5">
              <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Overall Progress</p>
                  <div className="mt-3 flex items-end gap-3">
                    <span className="text-5xl font-semibold">{workProgress}%</span>
                    <span className="pb-2 text-sm text-muted-foreground">completed this cycle</span>
                  </div>
                  <Progress value={workProgress} className="mt-4 h-2" />

                  <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4">
                    <div className="flex items-start gap-3 text-red-700">
                      <AlertTriangle className="mt-0.5 h-5 w-5" />
                      <div>
                        <p className="font-semibold">Critical Discrepancy Detected</p>
                        <p className="text-sm text-red-700/90">
                          The submitted progress conflicts with the observed site output. Material delivery and crew completion evidence require validation.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 rounded-xl border border-border bg-muted/20 p-4">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Current Status</p>
                    <Badge className={`mt-2 ${statusConfig[log.status].className}`}>{statusConfig[log.status].label}</Badge>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Reviewer</p>
                    <p className="mt-1 text-sm font-medium">{submitter?.full_name || 'Unknown User'}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Project</p>
                    <p className="mt-1 text-sm font-medium">{project.name}</p>
                    <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3.5 w-3.5" />{project.location}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Work Activities</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {log.activities.map((activity, index) => (
                  <div key={activity} className="flex items-start gap-3 rounded-lg border border-border p-3">
                    <div className="mt-0.5 rounded-full bg-blue-50 p-1.5 text-blue-700">
                      <PenTool className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Task Activity {index + 1}</p>
                      <p className="text-sm text-muted-foreground">{activity}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Material Consumption</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border border-border p-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">Ready-Mix Concrete (C30)</span>
                    <span className="font-semibold">$67,500.00</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">Used for structural pours</p>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">Steel Reinforcement</span>
                    <span className="font-semibold">$18,750.00</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">Bars, wire, and binding</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Site Evidence</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-3">
                {evidenceImages.map((image, index) => (
                  <div key={image} className="relative overflow-hidden rounded-lg border border-border bg-slate-100">
                    <div className="flex h-24 items-end justify-start bg-linear-to-br from-slate-200 to-slate-100 p-3 text-xs font-medium text-slate-700">
                      Evidence {index + 1}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Review Checklist</CardTitle>
                <Badge variant="outline">Under Review</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {checkItem('Data integrity checked', true)}
              {checkItem('Visual verification completed', true)}
              {checkItem('Safety compliance audit', false)}
              <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
                <p className="font-medium text-foreground">Notes</p>
                <p className="mt-1">Review additional evidence before final approval.</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Current Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button className="w-full">Approve</Button>
              <Button variant="outline" className="w-full">Keep Under Review</Button>
              <Button variant="destructive" className="w-full">Reject Log</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Activity Timeline</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex items-start gap-3">
                <Clock3 className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="font-medium">Log submitted</p>
                  <p className="text-muted-foreground">08:42 AM by {submitter?.full_name || 'Unknown'}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Users className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="font-medium">Awaiting review</p>
                  <p className="text-muted-foreground">Office engineer and consultant queue</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <FileText className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="font-medium">Report attached</p>
                  <p className="text-muted-foreground">Daily quantity and photo evidence included</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
