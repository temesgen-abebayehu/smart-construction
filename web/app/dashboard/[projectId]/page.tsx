'use client'

import { use, useEffect, useState } from 'react'
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
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  CheckCircle2,
  Clock3,
  Loader2,
} from 'lucide-react'
import { useProjectRole } from '@/lib/project-role-context'
import { useCurrency } from '@/lib/currency-context'
import { CurrencyPicker } from '@/components/currency-picker'
import { getPrediction, getProject, getProjectDashboard, listProjectLogs, listProjectTasks } from '@/lib/api'
import type { LogListItem, PredictionResponse, ProjectDetail, TaskListItem } from '@/lib/api-types'

interface DashboardPageProps {
  params: Promise<{ projectId: string }>
}


function getIssueTag(log: LogListItem) {
  const remark = (log.notes || '').toLowerCase()

  if (remark.includes('weather') || remark.includes('rain')) {
    return { label: 'Weather Hold', className: 'bg-blue-100 text-blue-700' }
  }

  if (log.status === 'submitted' || log.status === 'reviewed') {
    return { label: 'Pending Review', className: 'bg-amber-100 text-amber-700' }
  }

  return { label: 'None', className: 'bg-slate-100 text-slate-600' }
}

export default function DashboardPage({ params }: DashboardPageProps) {
  const { projectId } = use(params)
  const userRole = useProjectRole()
  const { formatBudget } = useCurrency()

  const [project, setProject] = useState<ProjectDetail | null>(null)
  const [tasks, setTasks] = useState<TaskListItem[]>([])
  const [logs, setLogs] = useState<LogListItem[]>([])
  const [prediction, setPrediction] = useState<PredictionResponse | null>(null)
  const [dashboardSummary, setDashboardSummary] = useState<{
    task_summary: { total: number; completed: number; in_progress: number; pending: number }
    delay_risk_status: string
  } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const [proj, taskRes, logRes, pred, dashboard] = await Promise.all([
          getProject(projectId),
          listProjectTasks(projectId, { limit: 100 }),
          listProjectLogs(projectId, { limit: 100 }),
          getPrediction(projectId).catch(() => null),
          getProjectDashboard(projectId).catch(() => null),
        ])
        if (cancelled) return
        setProject(proj)
        setTasks(taskRes.data ?? [])
        setLogs(logRes.data ?? [])
        setPrediction(pred)
        setDashboardSummary(dashboard)
      } catch {
        if (!cancelled) {
          setProject(null)
          setTasks([])
          setLogs([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [projectId])

  if (loading || !project) {
    return (
      <div className="flex justify-center py-24 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  const isProjectManager = userRole === 'project_manager' || userRole === 'owner'

  const taskSummary = dashboardSummary?.task_summary
  const activeCount = taskSummary?.in_progress ?? tasks.filter((t) => t.status === 'in_progress').length
  const completedCount = taskSummary?.completed ?? tasks.filter((t) => t.status === 'completed').length
  const pendingCount = taskSummary?.pending ?? tasks.filter((t) => t.status === 'pending').length

  const totalBudget = project.total_budget
  const totalSpent = project.budget_spent
  const remaining = Math.max(totalBudget - totalSpent, 0)
  const spentPct = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0

  const pendingApprovals = logs.filter((log) =>
    ['submitted', 'reviewed', 'consultant_approved'].includes(log.status),
  ).length

  const riskLevel = prediction?.risk_level ?? dashboardSummary?.delay_risk_status ?? 'low'
  const riskLevelScore = riskLevel === 'high' ? 75 : riskLevel === 'medium' ? 55 : 35

  const aiMessage = prediction
    ? `Delay estimate: ${prediction.delay_estimate_days} days | Budget overrun: ETB ${prediction.budget_overrun_estimate.toLocaleString()}`
    : 'Current schedule stability is healthy'

  const recentLogs = [...logs]
    .sort((a, b) => +new Date(b.date) - +new Date(a.date))
    .slice(0, 5)

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
                <p className="text-[10px] font-semibold uppercase text-amber-700">Pending</p>
                <p className="text-xl font-semibold text-amber-800">{pendingCount}</p>
              </div>
              <div className="rounded-md border border-blue-200 bg-blue-50 p-2 text-center">
                <p className="text-[10px] font-semibold uppercase text-blue-700">Completed</p>
                <p className="text-xl font-semibold text-blue-800">{completedCount}</p>
              </div>
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                <span>Overall Progress</span>
                <span className="font-medium text-foreground">
                  {project.overall_progress_pct.toFixed(0)}%
                </span>
              </div>
              <Progress value={project.overall_progress_pct} className="h-2" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Financial Burn & Capital</CardTitle>
              <CurrencyPicker />
            </div>
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
                  <span className="font-medium">{formatBudget(totalBudget)}</span>
                </div>
                <div className="flex items-center justify-between gap-8">
                  <span className="text-muted-foreground">Actual Spent</span>
                  <span className="font-medium">{formatBudget(totalSpent)}</span>
                </div>
                <div className="flex items-center justify-between gap-8">
                  <span className="text-muted-foreground">Remaining</span>
                  <span className="font-medium">{formatBudget(remaining)}</span>
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
            <CardDescription className="text-blue-100">
              System Live: ML Prediction Engine Active
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-blue-100">Risk signal</p>
              <p className="text-3xl font-semibold capitalize">
                {prediction?.risk_level ?? `Score: ${riskLevelScore}`}
              </p>
            </div>

            {prediction && (
              <div className="grid grid-cols-2 gap-2 text-xs text-blue-100">
                <div>
                  <p className="font-medium text-white">{prediction.delay_estimate_days}d</p>
                  <p>Est. Delay</p>
                </div>
                <div>
                  <p className="font-medium text-white">{(prediction.confidence_score * 100).toFixed(0)}%</p>
                  <p>Confidence</p>
                </div>
              </div>
            )}

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
          <Link href={`/dashboard/${projectId}/logs`}>
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
                  <TableHead>Project</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Issue Flagged</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentLogs.map((log) => {
                  const issue = getIssueTag(log)

                  return (
                    <TableRow key={log.id}>
                      <TableCell>
                        <p className="font-medium">{project.name}</p>
                        <p className="text-xs text-muted-foreground">{project.location}</p>
                      </TableCell>
                      <TableCell>{new Date(log.date).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {log.status.replace(/_/g, ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={issue.className}>{issue.label}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Link href={`/dashboard/${projectId}/logs/${log.id}`}>
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
            <p className="text-sm font-medium">
              {pendingApprovals} log(s) are waiting in the review/approval pipeline.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
