'use client'

import { use } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  CheckCircle2,
  Clock3,
} from 'lucide-react'
import {
  mockDailyLogs,
  mockProjects,
  mockTasks,
  mockUsers,
  type ProjectRole,
} from '@/lib/mock-data'

interface DashboardPageProps {
  params: Promise<{ projectId: string }>
}

function formatMillions(amount: number) {
  return `ETB ${(amount / 1_000_000).toFixed(1)}M`
}

function getIssueTag(log: { remarks?: string; status: string }) {
  const remark = (log.remarks || '').toLowerCase()

  if (remark.includes('weather') || remark.includes('rain')) {
    return { label: 'Weather Hold', className: 'bg-blue-100 text-blue-700' }
  }

  if (log.status === 'rejected') {
    return { label: 'Quality Failure', className: 'bg-red-100 text-red-700' }
  }

  if (log.status === 'under_review' || log.status === 'submitted') {
    return { label: 'Pending Review', className: 'bg-amber-100 text-amber-700' }
  }

  return { label: 'None', className: 'bg-slate-100 text-slate-600' }
}

export default function DashboardPage({ params }: DashboardPageProps) {
  const { projectId } = use(params)
  const searchParams = useSearchParams()
  const userRole = (searchParams.get('role') as ProjectRole) || 'site_engineer'

  const project = mockProjects.find((p) => p.id === projectId)
  const projectTasks = mockTasks.filter((t) => t.project_id === projectId)
  const projectLogs = mockDailyLogs.filter((l) => l.project_id === projectId)

  if (!project) return null

  const isProjectManager = userRole === 'project_manager'

  const activeCount = projectTasks.filter((task) => task.status === 'in_progress').length
  const atRiskCount = projectTasks.filter((task) => task.status === 'pending_dependency').length
  const delayedCount = projectTasks.filter((task) => task.status === 'delayed').length

  const totalBudget = projectTasks.reduce((sum, task) => sum + task.allocated_budget, 0)
  const totalSpent = projectTasks.reduce((sum, task) => sum + task.spent_budget, 0)
  const remaining = Math.max(totalBudget - totalSpent, 0)
  const spentPct = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0

  const pendingApprovals = projectLogs.filter((log) =>
    ['submitted', 'under_review', 'consultant_approved'].includes(log.status),
  ).length

  const aiRiskScore = Math.min(95, 45 + delayedCount * 12 + atRiskCount * 9 + pendingApprovals * 6)
  const aiMessage = delayedCount > 0 || atRiskCount > 0
    ? 'Supply chain delay expected +4 days'
    : 'Current schedule stability is healthy'

  const recentLogs = [...projectLogs].sort((a, b) => +new Date(b.log_date) - +new Date(a.log_date)).slice(0, 5)

  return (
    <div className="space-y-6">
      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Project Status</CardTitle>
            <CardDescription>Execution health snapshot</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-md border border-emerald-200 bg-emerald-50 p-2 text-center">
                <p className="text-[10px] font-semibold uppercase text-emerald-700">Active</p>
                <p className="text-xl font-semibold text-emerald-800">{activeCount}</p>
              </div>
              <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-center">
                <p className="text-[10px] font-semibold uppercase text-amber-700">At Risk</p>
                <p className="text-xl font-semibold text-amber-800">{atRiskCount}</p>
              </div>
              <div className="rounded-md border border-red-200 bg-red-50 p-2 text-center">
                <p className="text-[10px] font-semibold uppercase text-red-700">Delayed</p>
                <p className="text-xl font-semibold text-red-800">{delayedCount}</p>
              </div>
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                <span>Overall Progress</span>
                <span className="font-medium text-foreground">{project.overall_progress_pct.toFixed(0)}%</span>
              </div>
              <Progress value={project.overall_progress_pct} className="h-2" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Financial Burn & Capital</CardTitle>
            <CardDescription>Budget performance for this project</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div
                className="grid h-20 w-20 shrink-0 place-items-center rounded-full border-4 border-primary/20 text-sm font-semibold"
                style={{
                  background: `conic-gradient(hsl(var(--primary)) ${spentPct}%, hsl(var(--muted)) ${spentPct}% 100%)`,
                }}
              >
                <div className="grid h-14 w-14 place-items-center rounded-full bg-card">{spentPct}%</div>
              </div>

              <div className="space-y-1 text-sm">
                <div className="flex items-center justify-between gap-8">
                  <span className="text-muted-foreground">Contract Total</span>
                  <span className="font-medium">{formatMillions(totalBudget)}</span>
                </div>
                <div className="flex items-center justify-between gap-8">
                  <span className="text-muted-foreground">Actual Spent</span>
                  <span className="font-medium">{formatMillions(totalSpent)}</span>
                </div>
                <div className="flex items-center justify-between gap-8">
                  <span className="text-muted-foreground">Remaining</span>
                  <span className="font-medium">{formatMillions(remaining)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-blue-600 bg-linear-to-br from-blue-700 to-indigo-700 text-white shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">AI Predictor</CardTitle>
              <Bot className="h-4 w-4 text-blue-100" />
            </div>
            <CardDescription className="text-blue-100">System Live: ML Prediction Engine Active</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-blue-100">Volatility Predicted</p>
              <p className="text-3xl font-semibold">Score: {aiRiskScore}</p>
            </div>

            <div className="rounded-md border border-white/20 bg-white/10 p-3 text-sm">
              <div className="flex items-center gap-2 text-blue-50">
                <AlertTriangle className="h-4 w-4" />
                <span>{aiMessage}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Recent Daily Logs</CardTitle>
            <CardDescription>Latest submission activity from site teams</CardDescription>
          </div>
          <Link href={`/dashboard/${projectId}/logs?role=${userRole}`}>
            <Button variant="ghost" size="sm" className="gap-1">
              View All Logs <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {recentLogs.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No daily logs submitted yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Site / Project</TableHead>
                  <TableHead>Submitted By</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Issue Flagged</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentLogs.map((log) => {
                  const submitter = mockUsers.find((u) => u.id === log.submitted_by)
                  const task = mockTasks.find((t) => t.id === log.task_id)
                  const issue = getIssueTag(log)

                  return (
                    <TableRow key={log.id}>
                      <TableCell>
                        <p className="font-medium">{task?.title || project.name}</p>
                        <p className="text-xs text-muted-foreground">{project.location}</p>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarFallback className="text-[10px]">
                              {(submitter?.full_name || 'U')
                                .split(' ')
                                .map((n) => n[0])
                                .join('')
                                .slice(0, 2)
                                .toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm">{submitter?.full_name || 'Unknown User'}</span>
                        </div>
                      </TableCell>
                      <TableCell>{new Date(log.log_date).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Badge className={issue.className}>{issue.label}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Link href={`/dashboard/${projectId}/logs?role=${userRole}`}>
                          <Button size="sm" className="h-8 px-4">
                            View
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {isProjectManager && pendingApprovals === 0 && (
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="flex items-center gap-3 p-4 text-emerald-800">
            <CheckCircle2 className="h-5 w-5" />
            <p className="text-sm font-medium">Approval queue is clear. All submitted logs are currently handled.</p>
          </CardContent>
        </Card>
      )}

      {isProjectManager && pendingApprovals > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="flex items-center gap-3 p-4 text-amber-800">
            <Clock3 className="h-5 w-5" />
            <p className="text-sm font-medium">{pendingApprovals} log(s) are waiting in the review/approval pipeline.</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
