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
  AlertTriangle,
  ArrowRight,
  Bot,
  CheckCircle2,
  Clock3,
  CloudSun,
  Droplets,
  Loader2,
  Thermometer,
  Settings,
  ChevronDown,
  DollarSign,
  FileText,
  LayoutDashboard,
} from 'lucide-react'
import { useProjectRole } from '@/lib/project-role-context'
import { useCurrency } from '@/lib/currency-context'
import { CurrencyPicker } from '@/components/currency-picker'
import { getPrediction, getProject, getProjectDashboard, getWeather, listProjectLogs, listProjectTasks } from '@/lib/api'
import type { LogListItem, PredictionResponse, ProjectDetail, TaskListItem, WeatherResponse } from '@/lib/api-types'
import { WeatherForecastCard } from '@/components/weather-forecast-card'

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

export default function DashboardPage({ params }: DashboardPageProps) {
  const { projectId } = use(params)
  const userRole = useProjectRole()
  const { formatBudget } = useCurrency()

  const [project, setProject] = useState<ProjectDetail | null>(null)
  const [tasks, setTasks] = useState<TaskListItem[]>([])
  const [logs, setLogs] = useState<LogListItem[]>([])
  const [prediction, setPrediction] = useState<PredictionResponse | null>(null)
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
          const [proj, taskRes, logRes, pred, dashboard, wthr] = await Promise.all([
            getProject(projectId),
            listProjectTasks(projectId, { limit: 100 }),
            listProjectLogs(projectId, { limit: 100 }),
            getPrediction(projectId).catch(() => null),
            getProjectDashboard(projectId).catch(() => null),
            getWeather(projectId).catch(() => null),
          ])
          if (cancelled) return
          setProject(proj)
          setTasks(taskRes.data ?? [])
          setLogs(logRes.data ?? [])
          setPrediction(pred)
          setDashboardSummary(dashboard)
          setWeather(wthr)
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

  const isProjectManager = userRole === 'project_manager'

  const taskSummary = dashboardSummary?.task_summary
  const activeCount = taskSummary?.in_progress ?? tasks.filter((t) => t.status === 'in_progress').length
  const completedCount = taskSummary?.completed ?? tasks.filter((t) => t.status === 'completed').length
  const pendingCount = taskSummary?.pending ?? tasks.filter((t) => t.status === 'pending').length

  const totalBudget = project.total_budget
  const totalSpent = project.budget_spent
  const remaining = Math.max(totalBudget - totalSpent, 0)
  const spentPct = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0

  const pendingApprovals = logs.filter((log) =>
    ['submitted', 'consultant_approved'].includes(log.status),
  ).length

  const riskLevel = prediction?.risk_level ?? dashboardSummary?.delay_risk_status ?? 'low'
  const riskLevelScore = riskLevel === 'high' ? 75 : riskLevel === 'medium' ? 55 : 35

  const aiMessage = prediction?.reason
    ? prediction.reason
    : prediction
      ? `Delay estimate: ${prediction.delay_estimate_days} days | Budget overrun: ETB ${prediction.budget_overrun_estimate.toLocaleString()}`
      : 'Current schedule stability is healthy'

  const recentLogs = [...logs]
    .sort((a, b) => +new Date(b.date) - +new Date(a.date))
    .slice(0, 5)

  return (
    <div className="space-y-6">
      {/* Header with Edit Button */}
      {isProjectManager && (
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">{project.name}</h2>
            <p className="text-sm text-muted-foreground">{project.location}</p>
          </div>
          <Link href={`/dashboard/${projectId}/edit`}>
            <Button variant="outline" className="gap-2">
              <Settings className="h-4 w-4" />
              Edit Project
            </Button>
          </Link>
        </div>
      )}

      <div className={`grid gap-4 ${isProjectManager ? 'xl:grid-cols-3' : 'xl:grid-cols-1'}`}>
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

        {isProjectManager && <Card className="shadow-sm">
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
        </Card>}

        {isProjectManager && <Card className="shadow-sm border-2 border-primary/20">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-primary/10 p-2">
                  <Bot className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base">AI Risk Prediction</CardTitle>
                  <CardDescription>Machine learning analysis</CardDescription>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Risk Level Badge */}
            <div className="flex items-center justify-between p-4 rounded-lg bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/20">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Risk Level</p>
                <div className="flex items-center gap-2">
                  <Badge
                    className={`text-base px-3 py-1 ${prediction?.risk_level === 'high' || prediction?.risk_level === 'critical'
                      ? 'bg-red-100 text-red-700 border-red-300'
                      : prediction?.risk_level === 'medium'
                        ? 'bg-amber-100 text-amber-700 border-amber-300'
                        : 'bg-green-100 text-green-700 border-green-300'
                      }`}
                    variant="outline"
                  >
                    {prediction?.risk_level ? prediction.risk_level.toUpperCase() : `Score: ${riskLevelScore}`}
                  </Badge>
                </div>
              </div>
              {prediction && (
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Confidence</p>
                  <p className="text-2xl font-bold text-primary">{(prediction.confidence_score * 100).toFixed(0)}%</p>
                </div>
              )}
            </div>

            {/* Key Metrics */}
            {prediction && (
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border bg-card p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock3 className="h-4 w-4 text-amber-600" />
                    <p className="text-sm font-medium text-muted-foreground">Estimated Delay</p>
                  </div>
                  <p className="text-2xl font-bold">{prediction.delay_estimate_days} days</p>
                </div>
                <div className="rounded-lg border bg-card p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign className="h-4 w-4 text-red-600" />
                    <p className="text-sm font-medium text-muted-foreground">Budget Overrun</p>
                  </div>
                  <p className="text-2xl font-bold">{formatBudget(prediction.budget_overrun_estimate)}</p>
                </div>
              </div>
            )}

            {/* Summary */}
            {prediction && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 p-3">
                <div className="flex items-start gap-2 text-sm">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-amber-600" />
                  <p className="text-amber-900 dark:text-amber-200">{aiMessage}</p>
                </div>
              </div>
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
        </Card>}

        {/* AI Prediction Details Modal */}
        <Dialog open={predictionOpen} onOpenChange={setPredictionOpen}>
          <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-primary" />
                AI Risk Prediction - Detailed Analysis
              </DialogTitle>
              <DialogDescription>
                Machine learning analysis of project risks and recommendations
              </DialogDescription>
            </DialogHeader>

            {prediction && (
              <div className="space-y-4 py-4">
                {/* Risk Level Summary */}
                <div className="flex items-center justify-between p-4 rounded-lg bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/20">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">Risk Level</p>
                    <Badge
                      className={`text-lg px-4 py-1 ${prediction.risk_level === 'high' || prediction.risk_level === 'critical'
                        ? 'bg-red-100 text-red-700 border-red-300'
                        : prediction.risk_level === 'medium'
                          ? 'bg-amber-100 text-amber-700 border-amber-300'
                          : 'bg-green-100 text-green-700 border-green-300'
                        }`}
                      variant="outline"
                    >
                      {prediction.risk_level.toUpperCase()}
                    </Badge>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Confidence</p>
                    <p className="text-3xl font-bold text-primary">{(prediction.confidence_score * 100).toFixed(0)}%</p>
                  </div>
                </div>

                {/* Key Metrics */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-lg border bg-card p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock3 className="h-5 w-5 text-amber-600" />
                      <p className="text-sm font-medium text-muted-foreground">Estimated Delay</p>
                    </div>
                    <p className="text-3xl font-bold">{prediction.delay_estimate_days} days</p>
                  </div>
                  <div className="rounded-lg border bg-card p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <DollarSign className="h-5 w-5 text-red-600" />
                      <p className="text-sm font-medium text-muted-foreground">Budget Overrun</p>
                    </div>
                    <p className="text-3xl font-bold">{formatBudget(prediction.budget_overrun_estimate)}</p>
                  </div>
                </div>

                {/* Analysis Source */}
                <div className="rounded-lg border bg-muted/30 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm font-semibold">Analysis Source</p>
                  </div>
                  <p className="text-sm capitalize">{prediction.source}</p>
                </div>

                {/* Reason */}
                <div className="rounded-lg border bg-muted/30 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <p className="text-sm font-semibold">Risk Analysis</p>
                  </div>
                  <p className="text-sm text-muted-foreground">{prediction.reason}</p>
                </div>

                {/* Recommendation */}
                <div className="rounded-lg border bg-primary/5 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <p className="text-sm font-semibold">Recommended Actions</p>
                  </div>
                  <p className="text-sm text-muted-foreground">{prediction.recommendation}</p>
                </div>

                {/* Key Factors */}
                {prediction.factors && Object.keys(prediction.factors).length > 0 && (
                  <div className="rounded-lg border bg-muted/30 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <LayoutDashboard className="h-4 w-4 text-muted-foreground" />
                      <p className="text-sm font-semibold">Contributing Factors</p>
                    </div>
                    <div className="space-y-2">
                      {Object.entries(prediction.factors).map(([key, val]) => (
                        <div key={key} className="flex items-center justify-between text-sm p-2 rounded bg-background">
                          <span className="capitalize font-medium">{key.replace(/_/g, ' ')}</span>
                          <span className="text-muted-foreground">{String(val)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* Weather Card */}
      {weather && (weather.temperature != null || weather.humidity != null || (weather.forecast && weather.forecast.length > 0)) && (
        <WeatherForecastCard weather={weather} projectLocation={project.location} />
      )}

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
                  <TableHead>Log</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Issue Flagged</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentLogs.map((log) => {
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
