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
  under_review: { label: 'Under Review', className: 'bg-orange-100 text-orange-700' },
  consultant_approved: { label: 'Consultant Approved', className: 'bg-indigo-100 text-indigo-700' },
  approved: { label: 'Approved', className: 'bg-green-100 text-green-700' },
  rejected: { label: 'Rejected', className: 'bg-red-100 text-red-700' },
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

      const title = log.task?.title || ''
      if (searchQuery && !title.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false
      }

      return true
    })
  }, [projectLogs, searchQuery, statusFilter])

  const reviewedCount = projectLogs.filter((log) => log.status === 'approved').length
  const underReviewCount = projectLogs.filter((log) => log.status === 'under_review').length
  const approvedCount = projectLogs.filter(
    (log) => log.status === 'approved' || log.status === 'consultant_approved',
  ).length
  const rejectedCount = projectLogs.filter((log) => log.status === 'rejected').length

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
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Reviewed Logs</p>
                <p className="mt-2 text-3xl font-semibold">{reviewedCount.toString().padStart(2, '0')}</p>
                <p className="text-xs text-muted-foreground">Lifetime Total</p>
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
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Under Review</p>
                <p className="mt-2 text-3xl font-semibold">{underReviewCount.toString().padStart(2, '0')}</p>
                <p className="text-xs text-muted-foreground">Pending Action</p>
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
                <p className="text-xs text-muted-foreground">Verified Status</p>
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
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Rejected</p>
                <p className="mt-2 text-3xl font-semibold">{rejectedCount.toString().padStart(2, '0')}</p>
                <p className="text-xs text-muted-foreground">Requires Revision</p>
              </div>
              <div className="rounded-full border border-red-200 p-3 text-red-600">
                <AlertTriangle className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg">Daily Logs Overview</CardTitle>
            <CardDescription>Recent submissions from the project team</CardDescription>
          </div>
          <Button variant="secondary" size="sm" className="gap-2">
            <Filter className="h-4 w-4" />
            Filter
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <div className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by task name..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-2">
              <Button variant={statusFilter === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setStatusFilter('all')}>
                All
              </Button>
              <Button variant={statusFilter === 'approved' ? 'default' : 'outline'} size="sm" onClick={() => setStatusFilter('approved')}>
                Approved
              </Button>
              <Button variant={statusFilter === 'under_review' ? 'default' : 'outline'} size="sm" onClick={() => setStatusFilter('under_review')}>
                Under Review
              </Button>
              <Button variant={statusFilter === 'rejected' ? 'default' : 'outline'} size="sm" onClick={() => setStatusFilter('rejected')}>
                Rejected
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
                  <TableHead>Project</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitter</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="font-medium text-primary">#{log.id.slice(0, 8).toUpperCase()}</TableCell>
                    <TableCell>{new Date(log.log_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</TableCell>
                    <TableCell>{log.task?.title || 'Unknown Task'}</TableCell>
                    <TableCell>
                      <Badge className={statusConfig[log.status].className}>{statusConfig[log.status].label}</Badge>
                    </TableCell>
                    <TableCell>{log.submitted_by?.full_name || 'Unknown'}</TableCell>
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
