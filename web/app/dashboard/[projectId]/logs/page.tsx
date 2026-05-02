'use client'

import { use, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
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
  CheckCircle2,
  CircleAlert,
  Filter,
  Search,
  Calendar,
  Loader2,
} from 'lucide-react'
import type { LogListItem } from '@/lib/api-types'
import type { LogStatus } from '@/lib/domain'
import { listProjectLogs } from '@/lib/api'

interface LogsPageProps {
  params: Promise<{ projectId: string }>
}

const statusConfig: Record<LogStatus, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-gray-100 text-gray-700' },
  submitted: { label: 'Submitted', className: 'bg-amber-100 text-amber-700' },
  reviewed: { label: 'Reviewed', className: 'bg-orange-100 text-orange-700' },
  consultant_approved: { label: 'Consultant Approved', className: 'bg-indigo-100 text-indigo-700' },
  pm_approved: { label: 'PM Approved', className: 'bg-green-100 text-green-700' },
}

export default function LogsPage({ params }: LogsPageProps) {
  const { projectId } = use(params)
  const [projectLogs, setProjectLogs] = useState<LogListItem[]>([])
  const [loading, setLoading] = useState(true)

  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const { data } = await listProjectLogs(projectId, { limit: 500 })
        if (!cancelled) setProjectLogs(data)
      } catch {
        if (!cancelled) setProjectLogs([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [projectId])

  const filteredLogs = useMemo(() => {
    return projectLogs.filter((log) => {
      if (statusFilter !== 'all' && log.status !== statusFilter) return false
      if (searchQuery) {
        const notes = log.notes || ''
        if (!notes.toLowerCase().includes(searchQuery.toLowerCase())) return false
      }
      return true
    })
  }, [projectLogs, searchQuery, statusFilter])

  const reviewedCount = projectLogs.filter((log) => log.status === 'reviewed').length
  const submittedCount = projectLogs.filter((log) => log.status === 'submitted').length
  const approvedCount = projectLogs.filter(
    (log) => log.status === 'pm_approved' || log.status === 'consultant_approved',
  ).length
  const draftCount = projectLogs.filter((log) => log.status === 'draft').length

  if (loading) {
    return (
      <div className="flex justify-center py-24 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Daily Logs Overview</h1>
        <p className="text-sm text-muted-foreground">Track submitted site logs and review status at a glance.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Reviewed</p>
                <p className="mt-2 text-3xl font-semibold">{reviewedCount.toString().padStart(2, '0')}</p>
                <p className="text-xs text-muted-foreground">Office Engineer reviewed</p>
              </div>
              <div className="rounded-full border border-blue-200 p-3 text-blue-700">
                <CheckCircle2 className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Submitted</p>
                <p className="mt-2 text-3xl font-semibold">{submittedCount.toString().padStart(2, '0')}</p>
                <p className="text-xs text-muted-foreground">Awaiting review</p>
              </div>
              <div className="rounded-full border border-orange-200 p-3 text-orange-600">
                <CircleAlert className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Approved</p>
                <p className="mt-2 text-3xl font-semibold">{approvedCount.toString().padStart(2, '0')}</p>
                <p className="text-xs text-muted-foreground">Consultant or PM approved</p>
              </div>
              <div className="rounded-full border border-emerald-200 p-3 text-emerald-600">
                <CheckCircle2 className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Drafts</p>
                <p className="mt-2 text-3xl font-semibold">{draftCount.toString().padStart(2, '0')}</p>
                <p className="text-xs text-muted-foreground">Not yet submitted</p>
              </div>
              <div className="rounded-full border border-gray-200 p-3 text-gray-600">
                <AlertTriangle className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg">Daily Logs</CardTitle>
            <CardDescription>Recent submissions from the project team</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by notes..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button variant={statusFilter === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setStatusFilter('all')}>
                All
              </Button>
              <Button variant={statusFilter === 'submitted' ? 'default' : 'outline'} size="sm" onClick={() => setStatusFilter('submitted')}>
                Submitted
              </Button>
              <Button variant={statusFilter === 'reviewed' ? 'default' : 'outline'} size="sm" onClick={() => setStatusFilter('reviewed')}>
                Reviewed
              </Button>
              <Button variant={statusFilter === 'pm_approved' ? 'default' : 'outline'} size="sm" onClick={() => setStatusFilter('pm_approved')}>
                Approved
              </Button>
              <Button variant={statusFilter === 'draft' ? 'default' : 'outline'} size="sm" onClick={() => setStatusFilter('draft')}>
                Draft
              </Button>
            </div>
          </div>

          {filteredLogs.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <Calendar className="mx-auto mb-4 h-12 w-12 opacity-50" />
              <p>No daily logs found.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Weather</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="font-medium text-primary">#{log.id.slice(0, 8).toUpperCase()}</TableCell>
                    <TableCell>{new Date(log.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</TableCell>
                    <TableCell>
                      <Badge className={statusConfig[log.status]?.className ?? 'bg-gray-100 text-gray-700'}>
                        {statusConfig[log.status]?.label ?? log.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="capitalize">{log.weather || '-'}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{log.notes || '-'}</TableCell>
                    <TableCell className="text-right">
                      <Link href={`/dashboard/${projectId}/logs/${log.id}`}>
                        <Button variant="ghost" size="sm" className="text-primary">
                          View Details
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
