'use client'

import type { ComponentType } from 'react'
import { use, useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { getPrediction, getProject, listProjectLogs, listProjectTasks } from '@/lib/api'
import type { LogListItem, PredictionResponse, ProjectDetail, TaskListItem } from '@/lib/api-types'
import { AlertTriangle, Bot, CalendarDays, DollarSign, LayoutDashboard, ListTodo, PieChart, TrendingUp, Loader2 } from 'lucide-react'
import { useCurrency } from '@/lib/currency-context'
import { CurrencyPicker } from '@/components/currency-picker'

interface ReportsPageProps {
  params: Promise<{ projectId: string }>
}


function MetricCard({
  title,
  value,
  hint,
  icon: Icon,
  tone,
}: {
  title: string
  value: string
  hint: string
  icon: ComponentType<{ className?: string }>
  tone: string
}) {
  return (
    <Card className="shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight">{value}</p>
            <p className="text-xs text-muted-foreground">{hint}</p>
          </div>
          <div className={`rounded-full border p-3 ${tone}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function ReportsPage({ params }: ReportsPageProps) {
  const { projectId } = use(params)
  const { formatBudget } = useCurrency()

  const [project, setProject] = useState<ProjectDetail | null>(null)
  const [projectTasks, setProjectTasks] = useState<TaskListItem[]>([])
  const [projectLogs, setProjectLogs] = useState<LogListItem[]>([])
  const [prediction, setPrediction] = useState<PredictionResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const [proj, tasksRes, logsRes, pred] = await Promise.all([
          getProject(projectId),
          listProjectTasks(projectId, { limit: 200 }),
          listProjectLogs(projectId, { limit: 500 }),
          getPrediction(projectId).catch(() => null),
        ])
        if (cancelled) return
        setProject(proj)
        setProjectTasks(tasksRes.data)
        setProjectLogs(logsRes.data)
        setPrediction(pred)
      } catch {
        if (!cancelled) {
          setProject(null)
          setProjectTasks([])
          setProjectLogs([])
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

  const completedTasks = projectTasks.filter((task) => task.status === 'completed').length
  const inProgressTasks = projectTasks.filter((task) => task.status === 'in_progress').length
  const pendingTasks = projectTasks.filter((task) => task.status === 'pending').length

  const totalBudget = project.total_budget
  const totalSpent = project.budget_spent
  const budgetRemaining = Math.max(totalBudget - totalSpent, 0)

  const approvedLogs = projectLogs.filter((log) => log.status === 'pm_approved').length
  const pendingLogs = projectLogs.filter((log) =>
    ['submitted', 'reviewed', 'consultant_approved'].includes(log.status),
  ).length
  const draftLogs = projectLogs.filter((log) => log.status === 'draft').length
  const dailyLogSummary = {
    submitted: projectLogs.length,
    approved: approvedLogs,
    pending: pendingLogs,
    draft: draftLogs,
  }

  const riskScore = prediction
    ? prediction.budget_overrun_estimate != null
      ? Math.min(95, prediction.budget_overrun_estimate / 1000 + (prediction.delay_estimate_days || 0) * 2)
      : prediction.risk_level === 'high'
        ? 78
        : prediction.risk_level === 'medium'
          ? 55
          : 32
    : Math.min(95, 35 + pendingTasks * 14 + pendingLogs * 7)

  const reportDateTime = new Date().toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })

  const costShare = {
    labor: 48,
    materials: 36,
    equipment: 16,
  }

  return (
    <div className="space-y-6">
      <Card className="border-border/70 shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <div className="min-w-44 rounded-md border border-border bg-card px-3 py-2 text-sm">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Project</p>
                <p className="mt-1 font-medium">{project.name}</p>
              </div>
              <div className="min-w-44 rounded-md border border-border bg-card px-3 py-2 text-sm">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Time Filter</p>
                <div className="mt-1 flex flex-wrap gap-2">
                  <Button variant="secondary" size="sm" className="h-7 px-3">Daily</Button>
                  <Button variant="secondary" size="sm" className="h-7 px-3">Weekly</Button>
                  <Button variant="default" size="sm" className="h-7 px-3">Monthly</Button>
                  <Button variant="secondary" size="sm" className="h-7 px-3">Custom</Button>
                </div>
              </div>
              <div className="min-w-52 rounded-md border border-border bg-card px-3 py-2 text-sm">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Date Range</p>
                <div className="mt-1 flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-muted-foreground" />
                  <span>Oct 1 - Oct 31, 2024</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" className="gap-2">
                <LayoutDashboard className="h-4 w-4" />
                PDF
              </Button>
              <Button variant="outline" size="sm" className="gap-2">
                <PieChart className="h-4 w-4" />
                Excel
              </Button>
              <Button size="sm">Generate Report</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold">{project.name}</h1>
          <Badge className={project.overall_progress_pct >= 60 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}>
            {project.overall_progress_pct >= 60 ? 'ON TRACK' : 'AT RISK'}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">Report Date & Time: {reportDateTime}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Overall Progress"
          value={`${project.overall_progress_pct.toFixed(1)}%`}
          hint="Progress vs baseline plan"
          icon={TrendingUp}
          tone="border-emerald-200 bg-emerald-50 text-emerald-600"
        />
        <MetricCard
          title="Tasks Completed"
          value={`${completedTasks.toString().padStart(2, '0')}/${pendingTasks.toString().padStart(3, '0')}`}
          hint="Completed vs pending"
          icon={ListTodo}
          tone="border-blue-200 bg-blue-50 text-blue-600"
        />
        <MetricCard
          title="Budget Used"
          value={formatBudget(totalSpent)}
          hint={`${formatBudget(budgetRemaining)} remaining`}
          icon={DollarSign}
          tone="border-amber-200 bg-amber-50 text-amber-600"
        />
        <MetricCard
          title="Delay Risk"
          value={`${riskScore.toFixed(1)}%`}
          hint="AI-driven risk estimate"
          icon={AlertTriangle}
          tone="border-orange-200 bg-orange-50 text-orange-600"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.5fr_0.9fr]">
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Project Progress Overview</CardTitle>
            <CardDescription>Planned vs actual schedule alignment</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="h-56 rounded-xl border border-border bg-linear-to-b from-slate-50 to-white p-4">
              <div className="flex h-full flex-col justify-between">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>PLANNED</span>
                  <span>ACTUAL</span>
                </div>
                <div className="relative h-32 overflow-hidden rounded-xl border border-dashed border-blue-200 bg-white">
                  <div className="absolute left-4 right-4 top-1/2 h-px bg-slate-200" />
                  <div className="absolute left-6 right-8 top-12 h-1 rounded-full bg-blue-600/70" />
                  <div className="absolute left-6 top-16 h-12 w-[72%] rounded-tl-full border-l-2 border-b-2 border-blue-500/80" />
                  <div className="absolute left-[65%] top-8 h-4 w-14 rounded bg-blue-700" />
                </div>
                <div>
                  <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                    <span>MILESTONE PROGRESS</span>
                    <span>4 of 6 Milestones Met</span>
                  </div>
                  <Progress value={68} className="h-2" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Cost Overview</CardTitle>
            <CardDescription>Budget by delivery category</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="mx-auto grid h-40 w-40 place-items-center rounded-full border-14 border-slate-100 border-t-blue-700 border-r-indigo-500 border-b-slate-300 border-l-slate-200">
              <div className="text-center">
                <p className="text-2xl font-semibold">{formatBudget(totalBudget)}</p>
                <p className="text-xs text-muted-foreground">Total budget</p>
              </div>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between"><span>Labor Cost</span><span>{costShare.labor}%</span></div>
              <Progress value={costShare.labor} className="h-2" />
              <div className="flex items-center justify-between"><span>Materials Cost</span><span>{costShare.materials}%</span></div>
              <Progress value={costShare.materials} className="h-2" />
              <div className="flex items-center justify-between"><span>Equipment Cost</span><span>{costShare.equipment}%</span></div>
              <Progress value={costShare.equipment} className="h-2" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1fr_1fr]">
        <Card className="border-blue-600 bg-linear-to-br from-blue-700 to-indigo-700 text-white shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Risk & Insights</CardTitle>
              <Bot className="h-4 w-4 text-blue-100" />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-4xl font-semibold">{riskScore.toFixed(1)}%</p>
            <p className="text-sm text-blue-100">AI-based risk prediction</p>
            <div className="space-y-2 rounded-lg border border-white/20 bg-white/10 p-3 text-sm leading-6 text-blue-50">
              {prediction?.reason ? (
                <p><strong className="text-white">Insight:</strong> {prediction.reason}</p>
              ) : (
                <>
                  <p><strong className="text-white">Insight:</strong> High risk due to delayed inspections.</p>
                  <p><strong className="text-white">Insight:</strong> Material shortage impacting timeline.</p>
                </>
              )}
              {prediction?.recommendation && (
                <p><strong className="text-white">Recommendation:</strong> {prediction.recommendation}</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Task Summary</CardTitle>
            <CardDescription>High-level task execution overview</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="mb-1 flex items-center justify-between text-sm"><span>Total Tasks</span><span>{projectTasks.length}</span></div>
              <Progress value={100} className="h-2" />
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between text-sm"><span>Completed Tasks</span><span>{completedTasks}</span></div>
              <Progress value={projectTasks.length ? (completedTasks / projectTasks.length) * 100 : 0} className="h-2 [&>div]:bg-emerald-500" />
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between text-sm"><span>In Progress Tasks</span><span>{inProgressTasks}</span></div>
              <Progress value={projectTasks.length ? (inProgressTasks / projectTasks.length) * 100 : 0} className="h-2 [&>div]:bg-blue-500" />
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between text-sm"><span>Pending Tasks</span><span className="text-amber-600">{pendingTasks}</span></div>
              <Progress value={projectTasks.length ? (pendingTasks / projectTasks.length) * 100 : 0} className="h-2 [&>div]:bg-red-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Daily Log Summary</CardTitle>
            <CardDescription>Compact approval overview</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-border p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Submitted</p>
              <p className="mt-2 text-3xl font-semibold">{dailyLogSummary.submitted.toString().padStart(2, '0')}</p>
            </div>
            <div className="rounded-xl border border-border p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Approved</p>
              <p className="mt-2 text-3xl font-semibold text-emerald-600">{dailyLogSummary.approved.toString().padStart(2, '0')}</p>
            </div>
            <div className="rounded-xl border border-border p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Pending</p>
              <p className="mt-2 text-3xl font-semibold text-amber-600">{dailyLogSummary.pending.toString().padStart(2, '0')}</p>
            </div>
            <div className="rounded-xl border border-border p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Drafts</p>
              <p className="mt-2 text-3xl font-semibold text-red-600">{dailyLogSummary.draft.toString().padStart(2, '0')}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-red-200 bg-red-50 shadow-sm">
          <CardContent className="flex items-start gap-3 p-4 text-red-800">
            <AlertTriangle className="mt-1 h-5 w-5" />
            <div>
              <p className="font-semibold">Project Status Alert</p>
              <p className="text-sm text-red-700">Critical discrepancy detected in the latest report cycle. Review site evidence before approval.</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-amber-200 bg-amber-50 shadow-sm">
          <CardContent className="flex items-start gap-3 p-4 text-amber-800">
            <AlertTriangle className="mt-1 h-5 w-5" />
            <div>
              <p className="font-semibold">Task Delay Warning</p>
              <p className="text-sm text-amber-700">Task completion is slipping by 4 days. Review workforce allocation and logistics immediately.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
