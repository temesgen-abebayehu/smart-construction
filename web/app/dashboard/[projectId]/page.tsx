'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
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
  ArrowRight,
  Bot,
  CheckCircle2,
  BarChart3,
  Clock3,
  CloudSun,
  Droplets,
  Loader2,
  Thermometer,
  Settings,
  ChevronDown,
  FileText,
} from 'lucide-react'
import { useProjectRole } from '@/lib/project-role-context'
import { useCurrency } from '@/lib/currency-context'
import { getPrediction, getProject, getProjectBudget, getProjectDashboard, getWeather, listProjectLogs, listProjectTasks } from '@/lib/api'
import type { BudgetSummary, LogListItem, PredictionResponse, ProjectDetail, TaskListItem, WeatherResponse } from '@/lib/api-types'
import { WeatherForecastCard } from '@/components/weather-forecast-card'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from 'recharts'

interface DashboardPageProps {
  params: Promise<{ projectId: string }>
}


function getIssueTag(log: LogListItem) {
  const remark = (log.notes || '').toLowerCase()

  if (remark.includes('weather') || remark.includes('rain')) {
    return { label: 'Weather Hold', className: 'bg-blue-100 text-blue-700' }
  }

  if (log.status === 'submitted') {
    return { label: 'Pending Review', className: 'bg-amber-100 text-amber-700' }
  }

  return { label: 'None', className: 'bg-slate-100 text-slate-600' }
}

type MlFeatureValues = {
  cost_deviation?: number | null
  time_deviation?: number | null
  task_progress?: number | null
  equipment_utilization_rate?: number | null
  worker_count?: number | null
  material_usage?: number | null
  temperature?: number | null
  humidity?: number | null
  machinery_status?: number | null
}

type MlProbabilityValues = {
  low?: number
  medium?: number
  high?: number
  critical?: number
}

type RiskDriver = {
  label: string
  value: string
  tone: 'ok' | 'warning' | 'critical'
  detail: string
}

function toFiniteNumber(value: unknown, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function splitRecommendationItems(text: string) {
  return text
    .replace(/\r/g, '\n')
    .split(/\n+|•|;/)
    .map((part) => part.replace(/^[-*]\s*/, '').trim())
    .filter(Boolean)
}

function formatCompactAmount(value: number) {
  const absolute = Math.abs(value)
  const sign = value < 0 ? '-' : ''

  if (absolute >= 1_000_000) {
    return `${sign}${(absolute / 1_000_000).toFixed(absolute >= 10_000_000 ? 0 : 1)}m`
  }

  if (absolute >= 1_000) {
    return `${sign}${(absolute / 1_000).toFixed(absolute >= 10_000 ? 0 : 1)}k`
  }

  return `${sign}${absolute.toLocaleString()}`
}

function getTaskStatusChartData(tasks: TaskListItem[]) {
  return [
    { name: 'Completed', value: tasks.filter((task) => task.status === 'completed').length, fill: '#10b981' },
    { name: 'In Progress', value: tasks.filter((task) => task.status === 'in_progress').length, fill: '#f59e0b' },
    { name: 'Pending', value: tasks.filter((task) => task.status === 'pending').length, fill: '#64748b' },
  ].filter((item) => item.value > 0)
}

function getTaskProgressChartData(tasks: TaskListItem[]) {
  return [...tasks]
    .sort((a, b) => (b.progress_percentage || 0) - (a.progress_percentage || 0))
    .slice(0, 6)
    .map((task) => ({
      name: task.title.length > 18 ? `${task.title.slice(0, 18)}…` : task.title,
      progress: clamp(task.progress_percentage || 0, 0, 100),
      remaining: clamp(100 - (task.progress_percentage || 0), 0, 100),
    }))
}

function getLogTrendChartData(trendLogs: LogListItem[]) {
  const recentLogs = [...trendLogs]
    .sort((a, b) => +new Date(a.date) - +new Date(b.date))
    .slice(-7)

  const grouped: Record<string, { submitted: number; consultant_approved: number; pm_approved: number; rejected: number }> = {}

  recentLogs.forEach((log) => {
    const day = new Date(log.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    if (!grouped[day]) {
      grouped[day] = { submitted: 0, consultant_approved: 0, pm_approved: 0, rejected: 0 }
    }

    switch (log.status) {
      case 'submitted':
        grouped[day].submitted += 1
        break
      case 'consultant_approved':
        grouped[day].consultant_approved += 1
        break
      case 'pm_approved':
        grouped[day].pm_approved += 1
        break
      case 'rejected':
        grouped[day].rejected += 1
        break
      default:
        break
    }
  })

  return Object.keys(grouped).map((day) => ({
    day,
    submitted: grouped[day].submitted,
    consultant_approved: grouped[day].consultant_approved,
    pm_approved: grouped[day].pm_approved,
    rejected: grouped[day].rejected,
  }))
}

function getResourceSpendData(logs: LogListItem[]) {
  const manpower = logs.reduce(
    (sum, log) => sum + (log.manpower_cost || 0),
    0,
  )
  const materials = logs.reduce(
    (sum, log) => sum + (log.materials_cost || 0),
    0,
  )
  const equipment = logs.reduce(
    (sum, log) => sum + (log.equipment_cost || 0),
    0,
  )

  return [
    { name: 'Labor', value: manpower, fill: '#0f766e' },
    { name: 'Materials', value: materials, fill: '#2563eb' },
    { name: 'Equipment', value: equipment, fill: '#9333ea' },
  ]
}

const taskStatusChartConfig = {
  completed: { label: 'Completed', color: '#10b981' },
  in_progress: { label: 'In Progress', color: '#f59e0b' },
  pending: { label: 'Pending', color: '#64748b' },
}

const taskProgressChartConfig = {
  progress: { label: 'Progress', color: '#2563eb' },
  remaining: { label: 'Remaining', color: '#e5e7eb' },
}

const logTrendChartConfig = {
  submitted: { label: 'Submitted', color: '#f59e0b' },
  consultant_approved: { label: 'Consultant Approved', color: '#8b5cf6' },
  pm_approved: { label: 'PM Approved', color: '#10b981' },
  rejected: { label: 'Rejected', color: '#ef4444' },
}

const resourceSpendChartConfig = {
  value: { label: 'Cost', color: '#2563eb' },
}

export default function DashboardPage({ params }: DashboardPageProps) {
  const { projectId } = use(params)
  const userRole = useProjectRole()
  const { formatBudget } = useCurrency()

  const [project, setProject] = useState<ProjectDetail | null>(null)
  const [tasks, setTasks] = useState<TaskListItem[]>([])
  const [logs, setLogs] = useState<LogListItem[]>([])
  const [prediction, setPrediction] = useState<PredictionResponse | null>(null)
  const [budgetSummary, setBudgetSummary] = useState<BudgetSummary | null>(null)
  const [weather, setWeather] = useState<WeatherResponse | null>(null)
  const [dashboardSummary, setDashboardSummary] = useState<{
    task_summary: { total: number; completed: number; in_progress: number; pending: number }
    delay_risk_status: string
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [predictionOpen, setPredictionOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
      ; (async () => {
        setLoading(true)
        try {
          // Only fetch prediction for Project Managers to speed up load
          const predictionPromise =
            userRole === 'project_manager'
              ? getPrediction(projectId).catch(() => null)
              : Promise.resolve<PredictionResponse | null>(null)

          const [projectResult, budgetResult, tasksResult, logsResult, dashboardResult, weatherResult, predictionResult] =
            await Promise.all([
              getProject(projectId),
              getProjectBudget(projectId).catch(() => null),
              listProjectTasks(projectId, { limit: 100 }),
              listProjectLogs(projectId, { limit: 100 }),
              getProjectDashboard(projectId).catch(() => null),
              getWeather(projectId).catch(() => null),
              predictionPromise,
            ] as const)

          if (cancelled) return
          setProject(projectResult)
          setBudgetSummary(budgetResult)
          setTasks(tasksResult.data ?? [])
          setLogs(logsResult.data ?? [])
          setDashboardSummary(dashboardResult)
          setWeather(weatherResult)
          setPrediction(predictionResult)
        } catch {
          if (!cancelled) {
            setProject(null)
            setBudgetSummary(null)
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
  }, [projectId, userRole])

  if (loading || !project) {
    return (
      <div className="flex justify-center py-24 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  const isProjectManager = userRole === 'project_manager'

  const taskSummary = dashboardSummary?.task_summary
  const activeCount = taskSummary?.in_progress ?? tasks.filter((t) => t.status === 'in_progress').length
  const completedCount = taskSummary?.completed ?? tasks.filter((t) => t.status === 'completed').length
  const pendingCount = taskSummary?.pending ?? tasks.filter((t) => t.status === 'pending').length

  const totalBudget = project.total_budget
  const totalSpent = project.budget_spent
  const remaining = Math.max(totalBudget - totalSpent, 0)
  const spentPct = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0
  const totalReceived = budgetSummary?.total_received ?? 0
  const receivedPct = totalBudget > 0 ? Math.round((totalReceived / totalBudget) * 100) : 0
  const remainingReceived = Math.max(totalBudget - totalReceived, 0)
  const additionalDays = prediction?.delay_estimate_days ?? 0
  const additionalBudget = Math.max(0, prediction?.budget_overrun_estimate ?? 0)
  const totalProjectAfterPrediction = totalBudget + additionalBudget
  const budgetRisePct = totalBudget > 0 ? Math.round((additionalBudget / totalBudget) * 100) : 0

  const pendingApprovals = logs.filter((log) =>
    ['submitted', 'consultant_approved'].includes(log.status),
  ).length

  const taskStatusData = getTaskStatusChartData(tasks)
  const taskProgressData = getTaskProgressChartData(tasks)
  const logTrendData = getLogTrendChartData(logs)
  const resourceSpendData = getResourceSpendData(logs)

  // Calculate project completion live from tasks (avoids stale backend value)
  // Formula: Σ(task.progress_percentage / 100 * task.weight)
  // A task with weight=1.9 that is 100% done contributes 1.9 to the total
  const liveProjectCompletion = tasks.reduce(
    (sum, t) => sum + (t.progress_percentage || 0) / 100.0 * (t.weight || 0),
    0
  )
  const overallCompletion = clamp(liveProjectCompletion, 0, 100)

  const predictionReason = typeof prediction?.reason === 'string' ? prediction.reason : ''
  const predictionRecommendation =
    typeof prediction?.recommendation === 'string' ? prediction.recommendation : ''
  const recommendationItems = splitRecommendationItems(predictionRecommendation)

  const recentLogs = [...logs]
    .sort((a, b) => +new Date(b.date) - +new Date(a.date))
    .slice(0, 5)
  const visibleRecentLogs = isProjectManager || userRole === 'consultant'
    ? recentLogs.filter((log) => log.status !== 'draft')
    : recentLogs

  return (
    <div className="space-y-6">
      {/* Header with Action Buttons */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{project.name}</h2>
          <p className="text-sm text-muted-foreground">{project.location}</p>
        </div>
        <div className="flex items-center gap-2">
          {userRole === 'site_engineer' && (
            <Link href={`/dashboard/${projectId}/logs/create`}>
              <Button className="gap-2">
                <FileText className="h-4 w-4" />
                Create Daily Log
              </Button>
            </Link>
          )}
          {isProjectManager && (
            <Link href={`/dashboard/${projectId}/edit`}>
              <Button variant="outline" className="gap-2">
                <Settings className="h-4 w-4" />
                Edit Project
              </Button>
            </Link>
          )}
        </div>
      </div>

      <div className={`grid gap-4 ${isProjectManager ? 'xl:grid-cols-2' : 'xl:grid-cols-1'}`}>
        <Card className="shadow-sm border bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Project Progress & Budget</CardTitle>
            <CardDescription>Progress, spend, and client funding in one simple view</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2 rounded-xl border bg-muted/20 p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-foreground">Overall project completion</span>
                <span className="font-semibold text-foreground">{overallCompletion.toFixed(1)}%</span>
              </div>
              <Progress value={overallCompletion} className="h-3" />
              <p className="text-xs text-muted-foreground">
                {overallCompletion > 75
                  ? 'Project is moving well.'
                  : overallCompletion > 40
                    ? 'Project is progressing steadily.'
                    : 'Project needs more attention.'}
              </p>
            </div>

            {isProjectManager && (
              <div className="space-y-3 rounded-xl border bg-muted/20 p-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-foreground">Spend budget</span>
                    <span className="font-semibold text-foreground">{spentPct.toFixed(1)}%</span>
                  </div>
                  <Progress value={spentPct} className="h-3" />
                  <p className="text-xs text-muted-foreground">
                    {formatBudget(totalSpent)} spent from {formatBudget(totalBudget)}.
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Budget remaining</span>
                    <span>{formatBudget(remaining)} / {formatBudget(totalBudget)}</span>
                  </div>
                  <div className="flex h-3 overflow-hidden rounded-full bg-muted">
                    <div
                      className="bg-emerald-500"
                      style={{ width: `${clamp(100 - spentPct, 0, 100)}%` }}
                    />
                    <div className="bg-slate-200 dark:bg-slate-700" style={{ width: `${clamp(spentPct, 0, 100)}%` }} />
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{formatBudget(remaining)} remaining</span>
                    <span>{formatBudget(totalSpent)} spent</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Received from client</span>
                    <span>{formatBudget(totalReceived)} / {formatBudget(totalBudget)}</span>
                  </div>
                  <div className="flex h-3 overflow-hidden rounded-full bg-muted">
                    <div
                      className="bg-emerald-500"
                      style={{ width: `${clamp(receivedPct, 0, 100)}%` }}
                    />
                    <div className="bg-slate-200 dark:bg-slate-700" style={{ width: `${100 - clamp(receivedPct, 0, 100)}%` }} />
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{formatBudget(totalReceived)} received</span>
                    <span>{formatBudget(remainingReceived)} left to receive</span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {isProjectManager && (
          <Card className="shadow-sm border bg-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="rounded-lg bg-primary/10 p-2">
                    <Bot className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-base">AI Risk Prediction</CardTitle>
                    <CardDescription>Simple prediction summary and detail view</CardDescription>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {prediction ? (
                <div className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border bg-blue-50 p-4 shadow-sm dark:bg-blue-950/20">
                      <p className="text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300">Estimated additional day</p>
                      <p className="mt-2 text-3xl font-bold text-blue-900 dark:text-blue-100">{additionalDays}</p>
                      <p className="mt-1 text-xs text-blue-700/80 dark:text-blue-200/80">Days of extra time expected.</p>
                    </div>
                    <div className="rounded-xl border bg-amber-50 p-4 shadow-sm dark:bg-amber-950/20">
                      <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">Estimated additional budget</p>
                      <p className="mt-2 text-3xl font-bold text-amber-900 dark:text-amber-100">Birr {formatCompactAmount(additionalBudget)}</p>
                      <p className="mt-1 text-xs text-amber-700/80 dark:text-amber-200/80">Extra cost impact on the plan.</p>
                    </div>
                  </div>

                  <div className="rounded-xl border bg-muted/20 p-4 shadow-sm">
                    <p className="text-sm font-medium text-foreground">
                      {additionalDays > 0
                        ? `The plan may delay by ${additionalDays} day(s).`
                        : 'No extra delay is predicted.'}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Open the detail view for the full explanation and recommendations.
                    </p>
                  </div>
                </div>
              ) : (
                <p className="rounded-xl border bg-muted/20 p-4 text-sm text-muted-foreground">
                  No prediction available yet.
                </p>
              )}

              {/* View Details Button */}
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={() => setPredictionOpen(true)}
              >
                View Detailed Analysis
                <ArrowRight className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        )}

        {/* AI Prediction Details Modal */}
        <Dialog open={predictionOpen} onOpenChange={setPredictionOpen}>
          <DialogContent className="sm:max-w-2xl max-h-[88vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-primary" />
                AI Risk Prediction - Detailed Analysis
              </DialogTitle>
              <DialogDescription>
                Clean summary of risk, delay, budget impact, and recommendations
              </DialogDescription>
            </DialogHeader>

            {prediction && (
              <div className="space-y-4 py-4 pr-1 sm:pr-2">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border bg-rose-50 p-4 shadow-sm dark:bg-rose-950/20">
                    <p className="text-xs font-semibold uppercase tracking-wide text-rose-700 dark:text-rose-300">Risk level</p>
                    <p className="mt-2 text-2xl font-bold text-rose-900 dark:text-rose-100">
                      {prediction.risk_level.replace(/_/g, ' ')}
                    </p>
                  </div>
                  <div className="rounded-xl border bg-blue-50 p-4 shadow-sm dark:bg-blue-950/20">
                    <p className="text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300">Estimated additional day</p>
                    <p className="mt-2 text-3xl font-bold text-blue-900 dark:text-blue-100">{additionalDays}</p>
                  </div>
                  <div className="rounded-xl border bg-amber-50 p-4 shadow-sm dark:bg-amber-950/20">
                    <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">Estimated additional budget</p>
                    <p className="mt-2 text-3xl font-bold text-amber-900 dark:text-amber-100">Birr {formatCompactAmount(additionalBudget)}</p>
                  </div>
                </div>

                {additionalDays > 0 && predictionReason.trim() && (
                  <div className="space-y-3 rounded-xl border bg-muted/20 p-4 shadow-sm">
                    <p className="text-sm font-semibold text-foreground">Delay reason</p>
                    <p className="text-sm text-muted-foreground">
                      The plan will delay in {additionalDays} day(s) because {predictionReason}.
                    </p>
                  </div>
                )}

                <div className="space-y-3 rounded-xl border bg-muted/20 p-4 shadow-sm">
                  <p className="text-sm font-semibold text-foreground">Budget impact</p>
                  {additionalBudget > 0 ? (
                    <p className="text-sm text-muted-foreground">
                      You will spend Birr {formatCompactAmount(additionalBudget)} more. The project total cost will rise by {budgetRisePct}% and it will total Birr {formatCompactAmount(totalProjectAfterPrediction)}.
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">No extra budget cost is predicted at the moment.</p>
                  )}
                </div>

                <div className="space-y-3 rounded-xl border bg-card p-4 shadow-sm">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <p className="text-sm font-semibold text-foreground">Recommendations</p>
                  </div>
                  {recommendationItems.length > 0 ? (
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      {recommendationItems.map((item) => (
                        <li key={item} className="flex gap-2">
                          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">No recommendation text is available yet.</p>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {isProjectManager && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            <div>
              <h3 className="text-lg font-semibold">Project Analytics</h3>
              <p className="text-sm text-muted-foreground">Visual summaries that help you understand delivery, approvals, and resources faster.</p>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Task Delivery Mix</CardTitle>
                <CardDescription>Completed, active, and pending workload balance</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {taskStatusData.length > 0 ? (
                  <ChartContainer config={taskStatusChartConfig} className="h-64 w-full">
                    <PieChart>
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Pie data={taskStatusData} dataKey="value" nameKey="name" innerRadius={58} outerRadius={86} paddingAngle={3}>
                        {taskStatusData.map((entry) => (
                          <Cell key={entry.name} fill={entry.fill} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ChartContainer>
                ) : (
                  <p className="py-10 text-center text-sm text-muted-foreground">No task data available yet.</p>
                )}

                <div className="flex flex-wrap gap-2 rounded-xl border bg-muted/20 p-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                    Completed
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                    In progress
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-slate-500" />
                    Pending
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs">
                  {taskStatusData.map((item) => (
                    <div key={item.name} className="rounded-md border bg-muted/30 p-2">
                      <p className="font-medium text-foreground">{item.name}</p>
                      <p className="text-muted-foreground">{item.value} tasks</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Top Task Progress</CardTitle>
                <CardDescription>Which tasks are moving fastest and which still need attention</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {taskProgressData.length > 0 ? (
                  <ChartContainer config={taskProgressChartConfig} className="h-64 w-full">
                    <BarChart data={taskProgressData} layout="vertical" margin={{ left: 10, right: 12 }}>
                      <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                      <XAxis type="number" domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
                      <YAxis type="category" dataKey="name" width={110} />
                      <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
                      <Bar dataKey="progress" stackId="progress" fill="#2563eb" radius={[0, 6, 6, 0]} />
                      <Bar dataKey="remaining" stackId="progress" fill="#e5e7eb" radius={[0, 6, 6, 0]} />
                    </BarChart>
                  </ChartContainer>
                ) : (
                  <p className="py-10 text-center text-sm text-muted-foreground">No tasks available yet.</p>
                )}
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Recent Review Flow</CardTitle>
                <CardDescription>Daily log activity across submission and approval stages</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {logTrendData.length > 0 ? (
                  <ChartContainer config={logTrendChartConfig} className="h-64 w-full">
                    <BarChart data={logTrendData} margin={{ left: 10, right: 12 }}>
                      <CartesianGrid vertical={false} strokeDasharray="3 3" />
                      <XAxis dataKey="day" tickLine={false} axisLine={false} />
                      <YAxis allowDecimals={false} />
                      <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
                      <Bar dataKey="submitted" stackId="logs" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="consultant_approved" stackId="logs" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="pm_approved" stackId="logs" fill="#10b981" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="rejected" stackId="logs" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ChartContainer>
                ) : (
                  <p className="py-10 text-center text-sm text-muted-foreground">No review activity yet.</p>
                )}

                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full bg-amber-100 px-3 py-1 font-medium text-amber-700">{recentLogs.length} recent logs</span>
                  <span className="rounded-full bg-emerald-100 px-3 py-1 font-medium text-emerald-700">{completedCount} completed tasks</span>
                  <span className="rounded-full bg-sky-100 px-3 py-1 font-medium text-sky-700">{pendingApprovals} pending approvals</span>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Resource Spend</CardTitle>
                <CardDescription>Where project costs are currently concentrated</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {resourceSpendData.some((item) => item.value > 0) ? (
                  <ChartContainer config={resourceSpendChartConfig} className="h-64 w-full">
                    <BarChart data={resourceSpendData} margin={{ left: 10, right: 12 }}>
                      <CartesianGrid vertical={false} strokeDasharray="3 3" />
                      <XAxis dataKey="name" tickLine={false} axisLine={false} />
                      <YAxis tickFormatter={(value) => formatBudget(Number(value))} />
                      <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
                      <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                        {resourceSpendData.map((entry) => (
                          <Cell key={entry.name} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ChartContainer>
                ) : (
                  <p className="py-10 text-center text-sm text-muted-foreground">No resource spending available yet.</p>
                )}

                <div className="grid gap-2 text-xs sm:grid-cols-3">
                  {resourceSpendData.map((item) => (
                    <div key={item.name} className="rounded-md border bg-muted/30 p-2">
                      <p className="font-medium text-foreground">{item.name}</p>
                      <p className="text-muted-foreground">{formatBudget(item.value)}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Weather Card */}
      {
        weather && (weather.temperature != null || weather.humidity != null || (weather.forecast && weather.forecast.length > 0)) && (
          <WeatherForecastCard weather={weather} projectLocation={project.location} />
        )
      }

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
          {visibleRecentLogs.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No daily logs submitted yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Log</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Issue Flagged</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleRecentLogs.map((log) => {
                  const issue = getIssueTag(log)
                  const taskName = log.task_id ? tasks.find(t => t.id === log.task_id)?.title : null

                  return (
                    <TableRow key={log.id}>
                      <TableCell>
                        <p className="font-medium">{taskName || `#${log.id.slice(0, 8).toUpperCase()}`}</p>
                        {log.notes && <p className="text-xs text-muted-foreground truncate max-w-[200px]">{log.notes}</p>}
                      </TableCell>
                      <TableCell>{new Date(log.date).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Badge className={
                          log.status === 'pm_approved' ? 'bg-emerald-100 text-emerald-700' :
                            log.status === 'consultant_approved' ? 'bg-indigo-100 text-indigo-700' :
                              log.status === 'submitted' ? 'bg-amber-100 text-amber-700' :
                                log.status === 'rejected' ? 'bg-red-100 text-red-700' :
                                  'bg-gray-100 text-gray-700'
                        }>
                          {log.status === 'pm_approved' ? 'Approved' : log.status.replace(/_/g, ' ')}
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

      {
        isProjectManager && pendingApprovals === 0 && (
          <Card className="border-emerald-200 bg-emerald-50">
            <CardContent className="flex items-center gap-3 p-4 text-emerald-800">
              <CheckCircle2 className="h-5 w-5" />
              <p className="text-sm font-medium">Approval queue is clear. All submitted logs are currently handled.</p>
            </CardContent>
          </Card>
        )
      }

      {
        isProjectManager && pendingApprovals > 0 && (
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="flex items-center gap-3 p-4 text-amber-800">
              <Clock3 className="h-5 w-5" />
              <p className="text-sm font-medium">
                {pendingApprovals} log(s) are waiting in the review/approval pipeline.
              </p>
            </CardContent>
          </Card>
        )
      }
    </div>
  )
}
