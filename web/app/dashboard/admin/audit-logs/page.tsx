'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { useAuth } from '@/lib/auth-context'
import { listAuditLogs } from '@/lib/api'
import type { AuditLogItem } from '@/lib/api-types'
import { Loader2, Search, FileText, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function AdminAuditLogsPage() {
    const router = useRouter()
    const { user, isAuthenticated, isLoading: authLoading } = useAuth()
    const [logs, setLogs] = useState<AuditLogItem[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [actionFilter, setActionFilter] = useState<string>('all')
    const [entityFilter, setEntityFilter] = useState<string>('all')

    useEffect(() => {
        if (!authLoading && !isAuthenticated) {
            router.push('/login')
        }
        if (!authLoading && isAuthenticated && !user?.is_admin) {
            router.push('/dashboard')
        }
    }, [authLoading, isAuthenticated, user, router])

    const loadLogs = async () => {
        setLoading(true)
        setError(null)
        try {
            const params: any = { limit: 100 }
            if (actionFilter !== 'all') params.action = actionFilter
            if (entityFilter !== 'all') params.entity_type = entityFilter

            const data = await listAuditLogs(params)
            setLogs(data)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load audit logs')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (!isAuthenticated || !user?.is_admin) return
        loadLogs()
    }, [isAuthenticated, user, actionFilter, entityFilter])

    if (authLoading || (loading && logs.length === 0)) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    if (!isAuthenticated || !user?.is_admin) return null

    const getActionBadgeColor = (action: string) => {
        if (action.includes('CREATE')) return 'bg-green-50 text-green-700 border-green-200'
        if (action.includes('UPDATE') || action.includes('EDIT')) return 'bg-blue-50 text-blue-700 border-blue-200'
        if (action.includes('DELETE')) return 'bg-red-50 text-red-700 border-red-200'
        if (action.includes('APPROVE')) return 'bg-purple-50 text-purple-700 border-purple-200'
        if (action.includes('REJECT')) return 'bg-orange-50 text-orange-700 border-orange-200'
        return 'bg-gray-50 text-gray-700 border-gray-200'
    }

    return (
        <div className="p-8 space-y-8">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => router.push('/dashboard')}>
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Audit Logs</h1>
                    <p className="text-muted-foreground mt-2">View system activity and user actions</p>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>System Activity Log</CardTitle>
                    <CardDescription>Complete history of all significant system actions</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Filters */}
                    <div className="flex flex-col sm:flex-row gap-4">
                        <Select value={actionFilter} onValueChange={setActionFilter}>
                            <SelectTrigger className="w-full sm:w-[200px]">
                                <SelectValue placeholder="Action" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Actions</SelectItem>
                                <SelectItem value="CREATE">Create</SelectItem>
                                <SelectItem value="UPDATE">Update</SelectItem>
                                <SelectItem value="DELETE">Delete</SelectItem>
                                <SelectItem value="APPROVE">Approve</SelectItem>
                                <SelectItem value="REJECT">Reject</SelectItem>
                                <SelectItem value="LOGIN">Login</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select value={entityFilter} onValueChange={setEntityFilter}>
                            <SelectTrigger className="w-full sm:w-[200px]">
                                <SelectValue placeholder="Entity Type" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Entities</SelectItem>
                                <SelectItem value="project">Project</SelectItem>
                                <SelectItem value="task">Task</SelectItem>
                                <SelectItem value="daily_log">Daily Log</SelectItem>
                                <SelectItem value="user">User</SelectItem>
                                <SelectItem value="contractor">Contractor</SelectItem>
                                <SelectItem value="supplier">Supplier</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {error && (
                        <div className="p-4 border border-destructive/20 bg-destructive/5 rounded-lg text-sm text-destructive">
                            {error}
                        </div>
                    )}

                    {/* Logs Table */}
                    <div className="border rounded-lg">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Timestamp</TableHead>
                                    <TableHead>Action</TableHead>
                                    <TableHead>Entity Type</TableHead>
                                    <TableHead>Entity ID</TableHead>
                                    <TableHead>User ID</TableHead>
                                    <TableHead>Details</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center py-8">
                                            <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                                        </TableCell>
                                    </TableRow>
                                ) : logs.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                            No audit logs found
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    logs.map((log) => (
                                        <TableRow key={log.id}>
                                            <TableCell className="font-mono text-xs">
                                                {new Date(log.created_at).toLocaleString('en-US', {
                                                    month: 'short',
                                                    day: 'numeric',
                                                    year: 'numeric',
                                                    hour: '2-digit',
                                                    minute: '2-digit',
                                                })}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className={getActionBadgeColor(log.action)}>
                                                    {log.action}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <span className="text-sm">{log.entity_type || '—'}</span>
                                            </TableCell>
                                            <TableCell>
                                                <span className="font-mono text-xs text-muted-foreground">
                                                    {log.entity_id ? log.entity_id.substring(0, 8) + '...' : '—'}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                <span className="font-mono text-xs text-muted-foreground">
                                                    {log.user_id ? log.user_id.substring(0, 8) + '...' : '—'}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                <span className="text-sm text-muted-foreground">
                                                    {log.details ? (
                                                        log.details.length > 50 ? (
                                                            <span title={log.details}>{log.details.substring(0, 50)}...</span>
                                                        ) : (
                                                            log.details
                                                        )
                                                    ) : (
                                                        '—'
                                                    )}
                                                </span>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {logs.length > 0 && (
                        <div className="text-sm text-muted-foreground text-center">
                            Showing {logs.length} most recent logs
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
