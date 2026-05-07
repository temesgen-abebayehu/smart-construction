'use client'

import { use, useCallback, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { getReportPreview, getReportDownloadUrl } from '@/lib/api'
import { getAccessToken } from '@/lib/auth-storage'
import { AlertTriangle, Bot, CalendarDays, Download, DollarSign, FileText, ListTodo, Loader2, Printer, TrendingUp } from 'lucide-react'
import { useCurrency } from '@/lib/currency-context'
import { CurrencyPicker } from '@/components/currency-picker'
import { toast } from 'sonner'

interface ReportsPageProps {
  params: Promise<{ projectId: string }>
}

type Period = 'daily' | 'weekly' | 'monthly' | 'annual' | 'custom'

export default function ReportsPage({ params }: ReportsPageProps) {
  const { projectId } = use(params)
  const { formatBudget } = useCurrency()

  const [period, setPeriod] = useState<Period>('monthly')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [report, setReport] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(false)
  const [downloading, setDownloading] = useState(false)

  const handleGenerate = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getReportPreview(projectId, {
        period,
        start: startDate || undefined,
        end: period === 'custom' ? endDate || undefined : undefined,
      })
      setReport(data)
      toast.success('Report generated')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to generate report')
      setReport(null)
    } finally {
      setLoading(false)
    }
  }, [projectId, period, startDate, endDate])

  const handleDownloadPdf = async () => {
    setDownloading(true)
    try {
      const url = getReportDownloadUrl(projectId, {
        period,
        start: startDate || undefined,
        end: period === 'custom' ? endDate || undefined : undefined,
      })
      const token = getAccessToken()
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Download failed' }))
        throw new Error(err.detail || 'Download failed')
      }
      const blob = await res.blob()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      const disposition = res.headers.get('content-disposition') || ''
      const match = disposition.match(/filename="?(.+?)"?$/)
      a.download = match?.[1] || `report_${period}.pdf`
      a.click()
      URL.revokeObjectURL(a.href)
      toast.success('PDF downloaded')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to download PDF')
    } finally {
      setDownloading(false)
    }
  }

  // Extract data from report preview
  const summary = report?.summary as Record<string, unknown> | undefined
  const periodInfo = report?.period as Record<string, unknown> | undefined
  const financial = report?.financial as Record<string, unknown> | undefined
  const tasks = report?.tasks as Record<string, unknown> | undefined
  const risk = report?.risk as Record<string, unknown> | undefined
  const progress = report?.progress as Record<string, unknown> | undefined
  const performance = report?.performance as Record<string, unknown> | undefined
  const labor = report?.labor as Record<string, unknown> | undefined
  const dailyLogs = report?.daily_logs as Record<string, unknown> | undefined
  const projectHeader = report?.project as Record<string, unknown> | undefined

  const fmtNum = (v: unknown, decimals = 1) => {
    const n = Number(v)
    return Number.isFinite(n) ? n.toFixed(decimals) : '—'
  }

  return (
    <div className="space-y-6">
      {/* Filter Bar */}
      <Card className="shadow-sm print:hidden">
        <CardContent className="p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
              <div>
                <Label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Period</Label>
                <div className="flex flex-wrap gap-1.5">
                  {(['daily', 'weekly', 'monthly', 'annual', 'custom'] as const).map((p) => (
                    <Button
                      key={p}
                      variant={period === p ? 'default' : 'secondary'}
                      size="sm"
                      className="h-8 px-3 capitalize"
                      onClick={() => setPeriod(p)}
                    >
                      {p}
                    </Button>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Start</Label>
                <Input
                  type="date"
                  value={startDate}
                  max={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="h-8 w-36 text-sm"
                />
              </div>
              {period === 'custom' && (
                <div>
                  <Label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">End</Label>
                  <Input
                    type="date"
                    value={endDate}
                    max={new Date().toISOString().split('T')[0]}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="h-8 w-36 text-sm"
                  />
                </div>
              )}
              <CurrencyPicker />
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={() => void handleGenerate()} disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                Generate Report
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => void handleDownloadPdf()}
                disabled={downloading || !report}
              >
                {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                PDF
              </Button>
              <Button variant="outline" size="sm" className="gap-2" onClick={() => window.print()} disabled={!report}>
                <Printer className="h-4 w-4" />
                Print
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* No report yet */}
      {!report && !loading && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <FileText className="h-16 w-16 text-muted-foreground/30 mb-4" />
            <h2 className="text-lg font-semibold">No report generated</h2>
            <p className="text-sm text-muted-foreground mt-1">Select a period and click &quot;Generate Report&quot; to see project analytics.</p>
          </CardContent>
        </Card>
      )}

      {loading && (
        <div className="flex justify-center py-24 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      )}

      {/* Report Content */}
      {report && !loading && (
        <>
          {/* Header */}
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold">{String(projectHeader?.name ?? '')}</h1>
              {summary && (
                <Badge className={Number(summary.cumulative_progress_pct) >= 60 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}>
                  {Number(summary.cumulative_progress_pct) >= 60 ? 'ON TRACK' : 'AT RISK'}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {String(periodInfo?.label ?? '')} | Generated: {report.generated_at ? new Date(String(report.generated_at)).toLocaleString() : '—'}
            </p>
          </div>

          {/* KPI Cards */}
          {summary && (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Card className="shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Progress</p>
                      <p className="mt-2 text-3xl font-semibold">{fmtNum(summary.cumulative_progress_pct)}%</p>
                      <p className="text-xs text-muted-foreground">Period: +{fmtNum(summary.period_progress_pct)}%</p>
                    </div>
                    <div className="rounded-full border border-emerald-200 p-3 text-emerald-600"><TrendingUp className="h-5 w-5" /></div>
                  </div>
                </CardContent>
              </Card>
              <Card className="shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Tasks</p>
                      <p className="mt-2 text-3xl font-semibold">{String(summary.tasks_completed ?? 0)}/{String(summary.tasks_total ?? 0)}</p>
                      <p className="text-xs text-muted-foreground">{String(summary.tasks_in_progress ?? 0)} in progress</p>
                    </div>
                    <div className="rounded-full border border-blue-200 p-3 text-blue-600"><ListTodo className="h-5 w-5" /></div>
                  </div>
                </CardContent>
              </Card>
              <Card className="shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Budget</p>
                      <p className="mt-2 text-3xl font-semibold">{formatBudget(Number((summary.budget as Record<string, unknown>)?.spent ?? 0))}</p>
                      <p className="text-xs text-muted-foreground">{formatBudget(Number((summary.budget as Record<string, unknown>)?.remaining ?? 0))} remaining</p>
                    </div>
                    <div className="rounded-full border border-amber-200 p-3 text-amber-600"><DollarSign className="h-5 w-5" /></div>
                  </div>
                </CardContent>
              </Card>
              <Card className="shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Risk</p>
                      <p className="mt-2 text-3xl font-semibold capitalize">{String(summary.risk_level ?? 'N/A')}</p>
                      <p className="text-xs text-muted-foreground">SPI: {fmtNum(summary.spi, 2)} | CPI: {fmtNum(summary.cpi, 2)}</p>
                    </div>
                    <div className="rounded-full border border-orange-200 p-3 text-orange-600"><AlertTriangle className="h-5 w-5" /></div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Progress & Performance */}
          <div className="grid gap-6 xl:grid-cols-2">
            {progress && (
              <Card className="shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Progress</CardTitle>
                  <CardDescription>Schedule alignment</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span>Cumulative</span>
                      <span className="font-medium">{fmtNum(progress.cumulative_pct)}%</span>
                    </div>
                    <Progress value={Number(progress.cumulative_pct) || 0} className="h-2.5" />
                  </div>
                  <div>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span>This Period</span>
                      <span className="font-medium">+{fmtNum(progress.period_pct)}%</span>
                    </div>
                    <Progress value={Number(progress.period_pct) || 0} className="h-2.5 [&>div]:bg-blue-500" />
                  </div>
                  {progress.schedule_variance_days != null && (
                    <p className="text-sm text-muted-foreground">
                      Schedule variance: <span className={Number(progress.schedule_variance_days) < 0 ? 'text-red-600 font-medium' : 'text-emerald-600 font-medium'}>
                        {Number(progress.schedule_variance_days) > 0 ? '+' : ''}{fmtNum(progress.schedule_variance_days, 0)} days
                      </span>
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {performance && (
              <Card className="shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Earned Value</CardTitle>
                  <CardDescription>Performance indices</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-lg border p-3 text-center">
                      <p className="text-2xl font-semibold">{fmtNum(performance.spi, 2)}</p>
                      <p className="text-xs text-muted-foreground">SPI</p>
                      <Badge variant="outline" className={`text-[10px] mt-1 ${String(performance.schedule_status) === 'ahead' ? 'text-emerald-600' : String(performance.schedule_status) === 'behind' ? 'text-red-600' : 'text-amber-600'}`}>
                        {String(performance.schedule_status ?? '')}
                      </Badge>
                    </div>
                    <div className="rounded-lg border p-3 text-center">
                      <p className="text-2xl font-semibold">{fmtNum(performance.cpi, 2)}</p>
                      <p className="text-xs text-muted-foreground">CPI</p>
                      <Badge variant="outline" className={`text-[10px] mt-1 ${String(performance.cost_status) === 'under' ? 'text-emerald-600' : String(performance.cost_status) === 'over' ? 'text-red-600' : 'text-amber-600'}`}>
                        {String(performance.cost_status ?? '')}
                      </Badge>
                    </div>
                    <div className="rounded-lg border p-3 text-center">
                      <p className="text-2xl font-semibold">{formatBudget(Number(performance.ev ?? 0))}</p>
                      <p className="text-xs text-muted-foreground">Earned Value</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Planned Value</span><span>{formatBudget(Number(performance.pv ?? 0))}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Actual Cost</span><span>{formatBudget(Number(performance.ac ?? 0))}</span></div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Financial & Tasks */}
          <div className="grid gap-6 xl:grid-cols-2">
            {financial && (
              <Card className="shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Financial Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-lg border p-3 text-center">
                      <p className="text-xl font-semibold">{formatBudget(Number(financial.total_budget ?? 0))}</p>
                      <p className="text-xs text-muted-foreground">Total Budget</p>
                    </div>
                    <div className="rounded-lg border p-3 text-center">
                      <p className="text-xl font-semibold">{formatBudget(Number(financial.cumulative_cost ?? 0))}</p>
                      <p className="text-xs text-muted-foreground">Total Spent</p>
                    </div>
                    <div className="rounded-lg border p-3 text-center">
                      <p className="text-xl font-semibold">{formatBudget(Number(financial.period_cost ?? 0))}</p>
                      <p className="text-xs text-muted-foreground">This Period</p>
                    </div>
                  </div>
                  {financial.by_category && (
                    <div className="space-y-2 text-sm">
                      {Object.entries(financial.by_category as Record<string, number>).map(([cat, val]) => (
                        <div key={cat} className="flex items-center justify-between">
                          <span className="capitalize">{cat}</span>
                          <span>{formatBudget(val)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {tasks && (
              <Card className="shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Tasks</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {(tasks.completed_in_period as unknown[])?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">Completed this period</p>
                      {(tasks.completed_in_period as Record<string, unknown>[]).map((t) => (
                        <div key={String(t.id)} className="flex items-center justify-between rounded border p-2 mb-1 text-sm">
                          <span>{String(t.name)}</span>
                          <Badge className="bg-emerald-100 text-emerald-700 text-[10px]">Done</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                  {(tasks.overdue as unknown[])?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold uppercase text-red-600 mb-2">Overdue</p>
                      {(tasks.overdue as Record<string, unknown>[]).map((t) => (
                        <div key={String(t.id)} className="flex items-center justify-between rounded border border-red-200 p-2 mb-1 text-sm">
                          <span>{String(t.name)}</span>
                          <Badge className="bg-red-100 text-red-700 text-[10px]">{fmtNum(t.progress_pct, 0)}%</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                  {!(tasks.completed_in_period as unknown[])?.length && !(tasks.overdue as unknown[])?.length && (
                    <p className="text-sm text-muted-foreground text-center py-4">No task changes in this period.</p>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Daily Logs & Risk */}
          <div className="grid gap-6 xl:grid-cols-2">
            {dailyLogs && (
              <Card className="shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Daily Logs</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border p-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Total</p>
                    <p className="mt-2 text-3xl font-semibold">{String(dailyLogs.total_logs ?? 0)}</p>
                  </div>
                  <div className="rounded-xl border p-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Approved</p>
                    <p className="mt-2 text-3xl font-semibold text-emerald-600">{String(dailyLogs.approved ?? 0)}</p>
                  </div>
                  <div className="rounded-xl border p-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Pending</p>
                    <p className="mt-2 text-3xl font-semibold text-amber-600">{String(dailyLogs.pending ?? 0)}</p>
                  </div>
                  <div className="rounded-xl border p-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Total Hours</p>
                    <p className="mt-2 text-3xl font-semibold">{fmtNum(dailyLogs.total_hours_period, 0)}</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {risk && (
              <Card className="border-blue-600 bg-gradient-to-br from-blue-700 to-indigo-700 text-white shadow-sm">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Risk Assessment</CardTitle>
                    <Bot className="h-4 w-4 text-blue-100" />
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-3xl font-semibold capitalize">{String(risk.risk_level ?? 'N/A')}</p>
                  {risk.reason && (
                    <p className="text-sm text-blue-100">{String(risk.reason)}</p>
                  )}
                  {risk.recommendation && (
                    <p className="text-xs text-blue-200">{String(risk.recommendation)}</p>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </>
      )}
    </div>
  )
}
