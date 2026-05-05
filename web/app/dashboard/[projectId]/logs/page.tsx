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
  Search,
  Calendar,
  Loader2,
  Plus,
  XCircle,
} from 'lucide-react'
import type { LogListItem } from '@/lib/api-types'
import type { LogStatus } from '@/lib/domain'
import { listProjectLogs, createDailyLog } from '@/lib/api'
import { useProjectRole } from '@/lib/project-role-context'
import { useAuth } from '@/lib/auth-context'

interface LogsPageProps {
  params: Promise<{ projectId: string }>
}

const statusConfig: Record<LogStatus, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-gray-100 text-gray-700' },
  submitted: { label: 'Submitted', className: 'bg-amber-100 text-amber-700' },
  consultant_approved: { label: 'Consultant Approved', className: 'bg-indigo-100 text-indigo-700' },
  pm_approved: { label: 'Approved', className: 'bg-green-100 text-green-700' },
  rejected: { label: 'Rejected', className: 'bg-red-100 text-red-700' },
}

export default function LogsPage({ params }: LogsPageProps) {
  const { projectId } = use(params)
  const userRole = useProjectRole()
  const { user } = useAuth()
  const [projectLogs, setProjectLogs] = useState<LogListItem[]>([])
  const [loading, setLoading] = useState(true)

  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')

  const loadLogs = async () => {
    setLoading(true)
    try {
      const { data } = await listProjectLogs(projectId, {
        limit: 500,
        // Site engineer: own logs only
        created_by: userRole === 'site_engineer' ? user?.id : undefined,
      })
      setProjectLogs(data)
    } catch {
      setProjectLogs([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadLogs()
  }, [projectId, userRole])

  // Role-based log filtering
  const visibleLogs = useMemo(() => {
    let logs = projectLogs
    if (userRole === 'consultant') {
      // Consultant sees only submitted logs (for their review) + consultant_approved + pm_approved
      logs = logs.filter((l) => ['submitted', 'consultant_approved', 'pm_approved'].includes(l.status))
    } else if (userRole === 'project_manager') {
      // PM sees consultant_approved (for final approval) + pm_approved + rejected
      logs = logs.filter((l) => ['consultant_approved', 'pm_approved', 'rejected'].includes(l.status))
    }
    // Site engineer sees all their own logs (draft, submitted, rejected, approved)
    return logs
  }, [projectLogs, userRole])

  const filteredLogs = useMemo(() => {
    return visibleLogs.filter((log) => {
      if (statusFilter !== 'all' && log.status !== statusFilter) return false
      if (searchQuery) {
        const notes = log.notes || ''
        if (!notes.toLowerCase().includes(searchQuery.toLowerCase())) return false
      }
      return true
    })
  }, [visibleLogs, searchQuery, statusFilter])

  // Status filter buttons per role
  const statusFilters = useMemo(() => {
    const filters: { key: string; label: string }[] = [{ key: 'all', label: 'All' }]
    if (userRole === 'site_engineer') {
      filters.push(
        { key: 'draft', label: 'Draft' },
        { key: 'submitted', label: 'Submitted' },
        { key: 'rejected', label: 'Rejected' },
        { key: 'pm_approved', label: 'Approved' },
      )
    } else if (userRole === 'consultant') {
      filters.push(
        { key: 'submitted', label: 'Needs Review' },
        { key: 'consultant_approved', label: 'Approved by Me' },
        { key: 'pm_approved', label: 'PM Approved' },
      )
    } else if (userRole === 'project_manager') {
      filters.push(
        { key: 'consultant_approved', label: 'Needs Approval' },
        { key: 'pm_approved', label: 'Approved' },
        { key: 'rejected', label: 'Rejected' },
      )
    }
    return filters
  }, [userRole])

  // Summary counts based on visible logs
  const counts = useMemo(() => {
    const c = { submitted: 0, consultant_approved: 0, pm_approved: 0, draft: 0, rejected: 0 }
    for (const l of visibleLogs) {
      if (l.status in c) c[l.status as keyof typeof c]++
    }
    return c
  }, [visibleLogs])

  const handleCreateLog = async () => {
    try {
      await createDailyLog(projectId, {
        date: new Date().toISOString().split('T')[0],
        notes: '',
      })
      await loadLogs()
    } catch {
      // handle error
    }
  }

  const pageTitle = userRole === 'site_engineer'
    ? 'My Daily Logs'
    : userRole === 'consultant'
      ? 'Logs for Review'
      : 'Daily Log Approvals'

  const pageDescription = userRole === 'site_engineer'
    ? 'Create and track your daily log submissions.'
    : userRole === 'consultant'
      ? 'Review and approve submitted daily logs from site engineers.'
      : 'Give final approval on consultant-reviewed daily logs.'

  if (loading) {
    return (
      <div className="flex justify-center py-24 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{pageTitle}</h1>
          <p className="text-sm text-muted-foreground">{pageDescription}</p>
        </div>
        {userRole === 'site_engineer' && (
          <Button className="gap-2" onClick={() => void handleCreateLog()}>
            <Plus className="h-4 w-4" />
            New Daily Log
          </Button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {userRole === 'site_engineer' && (
          <>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Drafts</p>
                    <p className="mt-2 text-3xl font-semibold">{counts.draft.toString().padStart(2, '0')}</p>
                    <p className="text-xs text-muted-foreground">Not yet submitted</p>
                  </div>
                  <div className="rounded-full border border-gray-200 p-3 text-gray-600">
                    <AlertTriangle className="h-5 w-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Submitted</p>
                    <p className="mt-2 text-3xl font-semibold">{counts.submitted.toString().padStart(2, '0')}</p>
                    <p className="text-xs text-muted-foreground">Awaiting consultant review</p>
                  </div>
                  <div className="rounded-full border border-amber-200 p-3 text-amber-600">
                    <CircleAlert className="h-5 w-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Rejected</p>
                    <p className="mt-2 text-3xl font-semibold text-red-600">{counts.rejected.toString().padStart(2, '0')}</p>
                    <p className="text-xs text-muted-foreground">Needs correction</p>
                  </div>
                  <div className="rounded-full border border-red-200 p-3 text-red-600">
                    <XCircle className="h-5 w-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Approved</p>
                    <p className="mt-2 text-3xl font-semibold text-emerald-600">{counts.pm_approved.toString().padStart(2, '0')}</p>
                    <p className="text-xs text-muted-foreground">Fully approved</p>
                  </div>
                  <div className="rounded-full border border-emerald-200 p-3 text-emerald-600">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {userRole === 'consultant' && (
          <>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Needs Review</p>
                    <p className="mt-2 text-3xl font-semibold text-amber-600">{counts.submitted.toString().padStart(2, '0')}</p>
                    <p className="text-xs text-muted-foreground">Submitted by site engineers</p>
                  </div>
                  <div className="rounded-full border border-amber-200 p-3 text-amber-600">
                    <CircleAlert className="h-5 w-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Approved by Me</p>
                    <p className="mt-2 text-3xl font-semibold text-emerald-600">{counts.consultant_approved.toString().padStart(2, '0')}</p>
                    <p className="text-xs text-muted-foreground">Sent to PM for final approval</p>
                  </div>
                  <div className="rounded-full border border-emerald-200 p-3 text-emerald-600">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {userRole === 'project_manager' && (
          <>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Needs Approval</p>
                    <p className="mt-2 text-3xl font-semibold text-amber-600">{counts.consultant_approved.toString().padStart(2, '0')}</p>
                    <p className="text-xs text-muted-foreground">Consultant approved, awaiting you</p>
                  </div>
                  <div className="rounded-full border border-amber-200 p-3 text-amber-600">
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
                    <p className="mt-2 text-3xl font-semibold text-emerald-600">{counts.pm_approved.toString().padStart(2, '0')}</p>
                    <p className="text-xs text-muted-foreground">Fully approved</p>
                  </div>
                  <div className="rounded-full border border-emerald-200 p-3 text-emerald-600">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg">Daily Logs</CardTitle>
            <CardDescription>{visibleLogs.length} logs visible</CardDescription>
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
              {statusFilters.map((f) => (
                <Button
                  key={f.key}
                  variant={statusFilter === f.key ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setStatusFilter(f.key)}
                >
                  {f.label}
                </Button>
              ))}
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
                          {userRole === 'site_engineer' ? 'View' : 'Review'}
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
