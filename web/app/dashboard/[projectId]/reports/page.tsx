'use client'

import { use, useCallback, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { generateReport } from '@/lib/api'
import type { ReportResponse } from '@/lib/api-types'
import { Download, FileSpreadsheet, FileText, Loader2 } from 'lucide-react'
import { useCurrency } from '@/lib/currency-context'
import { CurrencyPicker } from '@/components/currency-picker'
import { toast } from 'sonner'

interface ReportsPageProps {
  params: Promise<{ projectId: string }>
}

export default function ReportsPage({ params }: ReportsPageProps) {
  const { projectId } = use(params)
  const { formatBudget } = useCurrency()

  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [format, setFormat] = useState<'pdf' | 'excel'>('pdf')
  const [loading, setLoading] = useState(false)

  // Quick date range presets
  const setThisMonth = () => {
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    setStartDate(start.toISOString().split('T')[0])
    setEndDate(end.toISOString().split('T')[0])
  }

  const setLastMonth = () => {
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const end = new Date(now.getFullYear(), now.getMonth(), 0)
    setStartDate(start.toISOString().split('T')[0])
    setEndDate(end.toISOString().split('T')[0])
  }

  const setLast7Days = () => {
    const end = new Date()
    const start = new Date()
    start.setDate(start.getDate() - 7)
    setStartDate(start.toISOString().split('T')[0])
    setEndDate(end.toISOString().split('T')[0])
  }

  const setLast30Days = () => {
    const end = new Date()
    const start = new Date()
    start.setDate(start.getDate() - 30)
    setStartDate(start.toISOString().split('T')[0])
    setEndDate(end.toISOString().split('T')[0])
  }

  const handleDownload = useCallback(async () => {
    if (!startDate || !endDate) {
      toast.error('Please select both start and end dates')
      return
    }
    setLoading(true)
    try {
      const data = await generateReport(projectId, {
        start_date: startDate,
        end_date: endDate,
      })

      if (format === 'excel') {
        downloadExcel(data)
      } else {
        downloadPDF(data)
      }

      toast.success(`Report downloaded as ${format.toUpperCase()}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to generate report')
    } finally {
      setLoading(false)
    }
  }, [projectId, startDate, endDate, format])

  const fmt = (n: number) => formatBudget(n)

  const downloadExcel = (report: ReportResponse) => {
    const rows: string[][] = []
    const d = (s: string | null) => s ? new Date(s).toLocaleDateString() : '—'

    rows.push(['SMART CONSTRUCTION — PROJECT REPORT'])
    rows.push([`Project: ${report.project_name}`])
    rows.push([`Location: ${report.project_location || 'N/A'}`])
    rows.push([`Client: ${report.client_name || 'N/A'}`])
    rows.push([`Period: ${report.start_date} to ${report.end_date} (${report.total_days} days)`])
    rows.push([`Status: ${report.project_status}`, `Progress: ${report.project_progress}%`])
    rows.push([])

    rows.push(['=== BUDGET SUMMARY ==='])
    rows.push(['Total Budget', 'Budget Spend', 'Cumulative Spend', 'Remaining'])
    rows.push([String(report.total_budget), String(report.budget_spent_in_period), String(report.used_budget), String(report.remaining_budget)])
    rows.push([])

    rows.push(['=== MANPOWER ==='])
    rows.push(['Worker Type', 'No. of Workers', 'Hours Worked', 'Hourly Rate', 'Cost'])
    const mpSections = [
      { label: 'Staff', data: report.manpower?.staff || [] },
      { label: 'Technical', data: report.manpower?.technical || [] },
      { label: 'Labor', data: report.manpower?.labor || [] },
    ]
    let totalMpWorkers = 0, totalMpHours = 0, totalMpCost = 0
    mpSections.forEach(s => {
      s.data.forEach(m => {
        rows.push([m.worker_type, String(m.total_workers), String(m.total_hours), String(m.hourly_rate), String(m.total_cost)])
        totalMpWorkers += m.total_workers; totalMpHours += m.total_hours; totalMpCost += m.total_cost
      })
    })
    rows.push(['TOTAL', String(totalMpWorkers), String(totalMpHours), '', String(totalMpCost)])
    rows.push([])

    rows.push(['=== MATERIALS ==='])
    rows.push(['Material Type', 'Supplier', 'Quantity', 'Unit', 'Unit Cost', 'Total Cost'])
    let totalMatCost = 0
      ; (report.materials || []).forEach(m => {
        rows.push([m.name, m.supplier || '—', String(m.quantity), m.unit, String(m.unit_cost), String(m.cost)])
        totalMatCost += m.cost
      })
    rows.push(['TOTAL', '', '', '', '', String(totalMatCost)])
    rows.push([])

    rows.push(['=== EQUIPMENT ==='])
    rows.push(['Equipment Type', 'Start Date', 'Hours / Trip', 'Unit Cost', 'Idle Hours', 'Idle Reason', 'Total Cost'])
    let totalEqCost = 0
      ; (report.equipment || []).forEach(e => {
        rows.push([e.name, e.start_date || '—', String(e.hours_used), String(e.unit_cost), String(e.hours_idle), e.idle_reasons, String(e.cost)])
        totalEqCost += e.cost
      })
    rows.push(['TOTAL', '', '', '', '', '', String(totalEqCost)])
    rows.push([])

    rows.push(['=== TASKS ==='])
    rows.push(['#', 'Task Name', 'Weight %', 'Status', 'Progress %', 'Total Activities', 'Activities Done', 'Start', 'End'])
    report.tasks.forEach((t, i) => {
      rows.push([String(i + 1), t.name, String(t.weight), t.status, String(t.progress_percentage), String(t.activities_total), String(t.activities_completed), d(t.start_date), d(t.end_date)])
    })
    rows.push([])

    rows.push(['=== DAILY LOGS ==='])
    rows.push([`Total: ${report.daily_logs_summary.total}`, `Draft: ${report.daily_logs_summary.draft}`, `Submitted: ${report.daily_logs_summary.submitted}`, `Consultant OK: ${report.daily_logs_summary.consultant_approved}`, `PM Approved: ${report.daily_logs_summary.pm_approved}`, `Rejected: ${report.daily_logs_summary.rejected}`])
    rows.push(['Date', 'Submitted By', 'Status', 'Acts Done', 'Manpower Cost', 'Material Cost', 'Equipment Cost', 'Total Cost'])
    report.daily_logs.forEach(l => {
      rows.push([l.date, l.submitted_by, l.status, String(l.acts_done), String(l.manpower_cost), String(l.material_cost), String(l.equipment_cost), String(l.total_cost)])
    })
    rows.push(['TOTAL', '', '', '', '', '', '', String(report.daily_logs_summary.total_cost)])

    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `report_${report.project_name.replace(/\s+/g, '_')}_${startDate}_${endDate}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const downloadPDF = (report: ReportResponse) => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      toast.error('Please allow popups to open the print dialog')
      return
    }

    const allMp = [
      ...(report.manpower?.staff || []),
      ...(report.manpower?.technical || []),
      ...(report.manpower?.labor || []),
    ]
    const totalMpWorkers = allMp.reduce((s, m) => s + m.total_workers, 0)
    const totalMpHours = allMp.reduce((s, m) => s + m.total_hours, 0)
    const totalMpCost = allMp.reduce((s, m) => s + m.total_cost, 0)
    const totalMatCost = (report.materials || []).reduce((s, m) => s + m.cost, 0)
    const totalEqHours = (report.equipment || []).reduce((s, e) => s + e.hours_used, 0)
    const totalEqCost = (report.equipment || []).reduce((s, e) => s + e.cost, 0)
    const d = (s: string | null) => s ? new Date(s).toLocaleDateString() : '—'
    const mpSections = [
      { label: 'Staff', data: report.manpower?.staff || [] },
      { label: 'Technical', data: report.manpower?.technical || [] },
      { label: 'Labor', data: report.manpower?.labor || [] },
    ]

    printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Project Report — ${report.project_name}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:Arial,sans-serif;font-size:11px;color:#111;padding:18px}
    h1{font-size:20px;font-weight:bold;margin-bottom:4px}
    h2{font-size:13px;font-weight:bold;margin:18px 0 6px;background:#1e3a5f;color:#fff;padding:4px 8px;border-radius:2px}
    .meta{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:12px}
    .meta-item{border:1px solid #ddd;border-radius:3px;padding:6px 10px}
    .meta-item .label{font-size:9px;color:#666;text-transform:uppercase;letter-spacing:.5px;margin-bottom:2px}
    .meta-item .value{font-size:13px;font-weight:bold}
    .info{display:grid;grid-template-columns:1fr 1fr;gap:4px 24px;margin-bottom:12px;font-size:11px}
    .info span{color:#555}
    table{width:100%;border-collapse:collapse;margin-bottom:6px;font-size:10.5px}
    th{background:#f0f4f8;border:1px solid #c9d4de;padding:5px 6px;text-align:left;font-weight:bold;font-size:10px;text-transform:uppercase}
    td{border:1px solid #ddd;padding:4px 6px}
    tr:nth-child(even) td{background:#fafbfc}
    .total-row td{font-weight:bold;background:#eef2f7!important;border-top:2px solid #99aec4}
    .status-completed{color:#16a34a;font-weight:600}
    .status-in_progress{color:#d97706;font-weight:600}
    .status-pending{color:#6b7280}
    .page-break{page-break-before:always}
    @media print{
      body{padding:10px}
      h2{-webkit-print-color-adjust:exact;print-color-adjust:exact}
      .meta-item,.total-row td,.status-completed,.status-in_progress{-webkit-print-color-adjust:exact;print-color-adjust:exact}
    }
  </style>
</head>
<body>
  <h1>${report.project_name}</h1>
  <div class="info">
    <div><span>Location:</span> ${report.project_location || '—'}</div>
    <div><span>Client:</span> ${report.client_name || '—'}</div>
    <div><span>Report Period:</span> ${d(report.start_date)} – ${d(report.end_date)} (${report.total_days} days)</div>
    <div><span>Planned Start:</span> ${report.planned_start_date ? d(report.planned_start_date) : '—'}</div>
    <div><span>Status:</span> ${report.project_status.replace(/_/g, ' ').toUpperCase()}</div>
    <div><span>Planned End:</span> ${report.planned_end_date ? d(report.planned_end_date) : '—'}</div>
  </div>

  <div class="meta">
    <div class="meta-item"><div class="label">Total Contract Value</div><div class="value">${fmt(report.total_budget)}</div></div>
    <div class="meta-item"><div class="label">Budget Spend</div><div class="value">${fmt(report.budget_spent_in_period)}</div></div>
    <div class="meta-item"><div class="label">Cumulative Spend</div><div class="value">${fmt(report.used_budget)}</div></div>
    <div class="meta-item"><div class="label">Remaining Budget</div><div class="value">${fmt(report.remaining_budget)}</div></div>
    <div class="meta-item"><div class="label">Physical Progress</div><div class="value">${report.project_progress.toFixed(2)}%</div></div>
    <div class="meta-item"><div class="label">Tasks (Done / Total)</div><div class="value">${report.tasks_completed} / ${report.tasks_total}</div></div>
  </div>

  <h2>Manpower</h2>
  <table>
    <thead><tr><th>Worker Type</th><th>No. of Workers</th><th>Hours Worked</th><th>Hourly Rate</th><th>Cost</th></tr></thead>
    <tbody>
      ${mpSections.flatMap(s => s.data.map(m => `
      <tr>
        <td>${m.worker_type}</td><td>${m.total_workers}</td>
        <td>${m.total_hours.toLocaleString()}</td><td>${fmt(m.hourly_rate)}</td><td>${fmt(m.total_cost)}</td>
      </tr>`)).join('')}
      <tr class="total-row"><td>Total</td><td>${totalMpWorkers}</td><td>${totalMpHours.toLocaleString()}</td><td></td><td>${fmt(totalMpCost)}</td></tr>
    </tbody>
  </table>

  <h2>Materials</h2>
  <table>
    <thead><tr><th>Material Type</th><th>Supplier</th><th>Quantity</th><th>Unit</th><th>Unit Cost</th><th>Total Cost</th></tr></thead>
    <tbody>
      ${(report.materials || []).map(m => `
      <tr>
        <td>${m.name}</td><td>${m.supplier || '—'}</td><td>${m.quantity.toLocaleString()}</td>
        <td>${m.unit || '—'}</td><td>${fmt(m.unit_cost)}</td><td>${fmt(m.cost)}</td>
      </tr>`).join('')}
      <tr class="total-row"><td colspan="5">Total</td><td>${fmt(totalMatCost)}</td></tr>
    </tbody>
  </table>

  <h2>Equipment</h2>
  <table>
    <thead><tr><th>Equipment Type</th><th>Start Date</th><th>Hours / Trip</th><th>Unit Cost</th><th>Idle Hours</th><th>Idle Reason</th><th>Total Cost</th></tr></thead>
    <tbody>
      ${(report.equipment || []).map(e => `
      <tr>
        <td>${e.name}</td><td>${e.start_date || '—'}</td><td>${e.hours_used.toLocaleString()}</td>
        <td>${fmt(e.unit_cost)}</td><td>${e.hours_idle.toLocaleString()}</td><td>${e.idle_reasons}</td><td>${fmt(e.cost)}</td>
      </tr>`).join('')}
      <tr class="total-row"><td colspan="2">Total</td><td>${totalEqHours.toLocaleString()}</td><td></td><td></td><td></td><td>${fmt(totalEqCost)}</td></tr>
    </tbody>
  </table>

  <h2>Tasks</h2>
  <table>
    <thead><tr><th>#</th><th>Task Name</th><th>Weight %</th><th>Status</th><th>Progress %</th><th>Total Acts.</th><th>Acts. Done</th><th>Start Date</th><th>End Date</th></tr></thead>
    <tbody>
      ${report.tasks.map((t, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${t.name}</td>
        <td>${t.weight}%</td>
        <td class="status-${t.status}">${t.status.replace(/_/g, ' ')}</td>
        <td>${t.progress_percentage}%</td>
        <td>${t.activities_total}</td>
        <td>${t.activities_completed}</td>
        <td>${d(t.start_date)}</td>
        <td>${d(t.end_date)}</td>
      </tr>`).join('')}
    </tbody>
  </table>

  <h2>Daily Logs</h2>
  <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:5px;margin-bottom:8px">
    <div class="meta-item"><div class="label">Total Logs</div><div class="value">${report.daily_logs_summary.total}</div></div>
    <div class="meta-item"><div class="label">Draft</div><div class="value">${report.daily_logs_summary.draft}</div></div>
    <div class="meta-item"><div class="label">Submitted</div><div class="value">${report.daily_logs_summary.submitted}</div></div>
    <div class="meta-item"><div class="label">Consultant OK</div><div class="value">${report.daily_logs_summary.consultant_approved}</div></div>
    <div class="meta-item"><div class="label">PM Approved</div><div class="value">${report.daily_logs_summary.pm_approved}</div></div>
    <div class="meta-item"><div class="label">Rejected</div><div class="value">${report.daily_logs_summary.rejected}</div></div>
  </div>
  <table>
    <thead><tr><th>Date</th><th>Submitted By</th><th>Status</th><th>Acts Done</th><th>Manpower Cost</th><th>Material Cost</th><th>Equipment Cost</th><th>Total Cost</th></tr></thead>
    <tbody>
      ${report.daily_logs.map(l => `
      <tr>
        <td>${l.date}</td><td>${l.submitted_by}</td><td>${l.status}</td><td>${l.acts_done}</td>
        <td>${fmt(l.manpower_cost)}</td><td>${fmt(l.material_cost)}</td><td>${fmt(l.equipment_cost)}</td>
        <td>${fmt(l.total_cost)}</td>
      </tr>`).join('')}
      <tr class="total-row"><td colspan="7">Total</td><td>${fmt(report.daily_logs_summary.total_cost)}</td></tr>
    </tbody>
  </table>

  <p style="margin-top:16px;font-size:9px;color:#888;border-top:1px solid #ddd;padding-top:6px">
    Generated on ${new Date().toLocaleString()} &nbsp;|&nbsp; Smart Construction Management System
  </p>
</body>
</html>`)

    printWindow.document.close()
    setTimeout(() => {
      printWindow.focus()
      printWindow.print()
    }, 300)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Project Reports</h1>
          <p className="text-sm text-muted-foreground">Generate and download project reports</p>
        </div>
        <CurrencyPicker />
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Generate Report</CardTitle>
          <CardDescription>Select date range and format to download project report</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <Label className="text-sm font-medium mb-2 block">Quick Date Ranges</Label>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={setLast7Days}>
                Last 7 Days
              </Button>
              <Button variant="outline" size="sm" onClick={setLast30Days}>
                Last 30 Days
              </Button>
              <Button variant="outline" size="sm" onClick={setThisMonth}>
                This Month
              </Button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="start-date">Start Date *</Label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                max={new Date().toISOString().split('T')[0]}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end-date">End Date *</Label>
              <Input
                id="end-date"
                type="date"
                value={endDate}
                max={new Date().toISOString().split('T')[0]}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="format">Report Format</Label>
            <Select value={format} onValueChange={(v) => setFormat(v as 'pdf' | 'excel')}>
              <SelectTrigger id="format">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pdf">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    <span>PDF (Print)</span>
                  </div>
                </SelectItem>
                <SelectItem value="excel">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="h-4 w-4" />
                    <span>Excel (CSV)</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            className="w-full gap-2"
            size="lg"
            onClick={() => void handleDownload()}
            disabled={loading || !startDate || !endDate}
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Generating Report...
              </>
            ) : (
              <>
                <Download className="h-5 w-5" />
                Download {format.toUpperCase()} Report
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-blue-200 bg-blue-50/50">
        <CardContent className="p-4">
          <div className="flex gap-3">
            <FileText className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-blue-900">Report Contents</p>
              <p className="text-xs text-blue-700">
                Reports include budget summary, task progress, manpower hours and costs, materials usage,
                equipment utilization, and overall project metrics for the selected date range.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
