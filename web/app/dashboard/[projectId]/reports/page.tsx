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

  const downloadExcel = (report: ReportResponse) => {
    const rows: string[][] = []
    rows.push(['Smart Construction Report'])
    rows.push([`Project: ${report.project_name}`])
    rows.push([`Period: ${report.start_date} to ${report.end_date}`])
    rows.push([])

    rows.push(['=== BUDGET ==='])
    rows.push(['Total Budget', 'Used', 'Remaining', 'Period Spend'])
    rows.push([String(report.total_budget), String(report.used_budget), String(report.remaining_budget), String(report.budget_spent_in_period)])
    rows.push([])

    rows.push(['=== TASKS ==='])
    rows.push(['Name', 'Status', 'Progress %', 'Start', 'End'])
    report.tasks.forEach(t => {
      rows.push([t.name, t.status, String(t.progress_percentage), t.start_date || '', t.end_date || ''])
    })
    rows.push([])

    rows.push(['=== MANPOWER ==='])
    rows.push(['Category', 'Type', 'Workers', 'Hours', 'Cost'])
    const manpowerSections = [
      { label: 'Staff', data: report.manpower?.staff || [] },
      { label: 'Technical', data: report.manpower?.technical || [] },
      { label: 'Labor', data: report.manpower?.labor || [] },
    ]
    manpowerSections.forEach(s => {
      s.data.forEach(m => {
        rows.push([s.label, m.worker_type, String(m.total_workers), String(m.total_hours), String(m.total_cost)])
      })
    })
    rows.push([])

    rows.push(['=== MATERIALS ==='])
    rows.push(['Name', 'Quantity', 'Unit', 'Cost'])
      ; (report.materials || []).forEach(m => {
        rows.push([m.name, String(m.quantity), m.unit, String(m.cost)])
      })
    rows.push([])

    rows.push(['=== EQUIPMENT ==='])
    rows.push(['Name', 'Hours Used', 'Hours Idle', 'Cost'])
      ; (report.equipment || []).forEach(e => {
        rows.push([e.name, String(e.hours_used), String(e.hours_idle), String(e.cost)])
      })

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
      toast.error('Please allow popups to download PDF')
      return
    }

    const allManpower = [
      ...(report.manpower?.staff || []),
      ...(report.manpower?.technical || []),
      ...(report.manpower?.labor || []),
    ]
    const totalManpowerCost = allManpower.reduce((s, m) => s + m.total_cost, 0)
    const totalManpowerHours = allManpower.reduce((s, m) => s + m.total_hours, 0)
    const totalMaterialCost = (report.materials || []).reduce((s, m) => s + m.cost, 0)
    const totalEquipmentCost = (report.equipment || []).reduce((s, e) => s + e.cost, 0)

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Project Report - ${report.project_name}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; padding: 20px; font-size: 12px; }
          h1 { font-size: 24px; margin-bottom: 10px; }
          h2 { font-size: 18px; margin-top: 20px; margin-bottom: 10px; border-bottom: 2px solid #333; padding-bottom: 5px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f4f4f4; font-weight: bold; }
          .header { margin-bottom: 20px; }
          .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 20px; }
          .summary-card { border: 1px solid #ddd; padding: 10px; border-radius: 4px; }
          .summary-card h3 { font-size: 10px; color: #666; text-transform: uppercase; margin-bottom: 5px; }
          .summary-card p { font-size: 18px; font-weight: bold; }
          @media print {
            body { padding: 10px; }
            button { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${report.project_name}</h1>
          <p><strong>Location:</strong> ${report.project_location}</p>
          <p><strong>Contractor:</strong> ${report.contractor_name || 'N/A'}</p>
          <p><strong>Period:</strong> ${new Date(report.start_date).toLocaleDateString()} - ${new Date(report.end_date).toLocaleDateString()}</p>
          <p><strong>Status:</strong> ${report.project_status.replace('_', ' ').toUpperCase()} | <strong>Progress:</strong> ${report.project_progress.toFixed(1)}%</p>
        </div>

        <div class="summary">
          <div class="summary-card">
            <h3>Total Budget</h3>
            <p>${formatBudget(report.total_budget)}</p>
          </div>
          <div class="summary-card">
            <h3>Period Spend</h3>
            <p>${formatBudget(report.budget_spent_in_period)}</p>
          </div>
          <div class="summary-card">
            <h3>Tasks</h3>
            <p>${report.tasks_completed}/${report.tasks_total}</p>
          </div>
          <div class="summary-card">
            <h3>Progress</h3>
            <p>${report.project_progress.toFixed(1)}%</p>
          </div>
        </div>

        <h2>Manpower Summary</h2>
        <table>
          <thead>
            <tr>
              <th>Category</th>
              <th>Type</th>
              <th>Workers</th>
              <th>Hours</th>
              <th>Cost</th>
            </tr>
          </thead>
          <tbody>
            ${[
        { label: 'Staff', data: report.manpower?.staff || [] },
        { label: 'Technical', data: report.manpower?.technical || [] },
        { label: 'Labor', data: report.manpower?.labor || [] },
      ].flatMap(section =>
        section.data.map(m => `
                <tr>
                  <td>${section.label}</td>
                  <td>${m.worker_type}</td>
                  <td>${m.total_workers}</td>
                  <td>${m.total_hours}</td>
                  <td>${formatBudget(m.total_cost)}</td>
                </tr>
              `).join('')
      ).join('')}
            <tr style="font-weight: bold; background-color: #f4f4f4;">
              <td colspan="3">Total</td>
              <td>${totalManpowerHours.toLocaleString()}</td>
              <td>${formatBudget(totalManpowerCost)}</td>
            </tr>
          </tbody>
        </table>

        <h2>Materials</h2>
        <table>
          <thead>
            <tr>
              <th>Material</th>
              <th>Quantity</th>
              <th>Unit</th>
              <th>Cost</th>
            </tr>
          </thead>
          <tbody>
            ${(report.materials || []).map(m => `
              <tr>
                <td>${m.name}</td>
                <td>${m.quantity}</td>
                <td>${m.unit}</td>
                <td>${formatBudget(m.cost)}</td>
              </tr>
            `).join('')}
            <tr style="font-weight: bold; background-color: #f4f4f4;">
              <td colspan="3">Total</td>
              <td>${formatBudget(totalMaterialCost)}</td>
            </tr>
          </tbody>
        </table>

        <h2>Equipment</h2>
        <table>
          <thead>
            <tr>
              <th>Equipment</th>
              <th>Hours Used</th>
              <th>Hours Idle</th>
              <th>Cost</th>
            </tr>
          </thead>
          <tbody>
            ${(report.equipment || []).map(e => `
              <tr>
                <td>${e.name}</td>
                <td>${e.hours_used}</td>
                <td>${e.hours_idle}</td>
                <td>${formatBudget(e.cost)}</td>
              </tr>
            `).join('')}
            <tr style="font-weight: bold; background-color: #f4f4f4;">
              <td colspan="3">Total</td>
              <td>${formatBudget(totalEquipmentCost)}</td>
            </tr>
          </tbody>
        </table>

        <h2>Tasks</h2>
        <table>
          <thead>
            <tr>
              <th>Task</th>
              <th>Status</th>
              <th>Progress</th>
              <th>Start</th>
              <th>End</th>
            </tr>
          </thead>
          <tbody>
            ${report.tasks.map(t => `
              <tr>
                <td>${t.name}</td>
                <td>${t.status.replace('_', ' ')}</td>
                <td>${t.progress_percentage}%</td>
                <td>${t.start_date ? new Date(t.start_date).toLocaleDateString() : '—'}</td>
                <td>${t.end_date ? new Date(t.end_date).toLocaleDateString() : '—'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <script>
          window.onload = function() {
            window.print();
          }
        </script>
      </body>
      </html>
    `)
    printWindow.document.close()
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
              <Button variant="outline" size="sm" onClick={setLastMonth}>
                Last Month
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
