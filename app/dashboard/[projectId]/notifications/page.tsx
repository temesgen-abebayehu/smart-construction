'use client'

import { use, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { mockProjects, type ProjectRole } from '@/lib/mock-data'
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  CircleAlert,
  ClipboardCheck,
  FileText,
  Info,
  Settings2,
  Sparkles,
} from 'lucide-react'

interface NotificationsPageProps {
  params: Promise<{ projectId: string }>
}

type NotificationCategory = 'risk' | 'log' | 'system' | 'assignment' | 'milestone'
type NotificationFilter = 'all' | 'unread' | 'risk' | 'system'

type NotificationItem = {
  id: string
  title: string
  message: string
  time: string
  category: NotificationCategory
  unread: boolean
}

const categoryConfig: Record<NotificationCategory, { label: string; icon: typeof Bell; pill: string; accent: string }> = {
  risk: { label: 'Risk Alert', icon: AlertTriangle, pill: 'bg-red-100 text-red-700', accent: 'border-red-200 bg-red-50' },
  log: { label: 'Daily Log', icon: ClipboardCheck, pill: 'bg-indigo-100 text-indigo-700', accent: 'border-indigo-200 bg-indigo-50' },
  system: { label: 'System Update', icon: Settings2, pill: 'bg-slate-100 text-slate-700', accent: 'border-slate-200 bg-slate-50' },
  assignment: { label: 'Assignment', icon: FileText, pill: 'bg-amber-100 text-amber-700', accent: 'border-amber-200 bg-amber-50' },
  milestone: { label: 'Milestone', icon: Sparkles, pill: 'bg-emerald-100 text-emerald-700', accent: 'border-emerald-200 bg-emerald-50' },
}

const notifications: NotificationItem[] = [
  {
    id: 'n-1',
    title: 'Skyline Tower Risk Escalation',
    message: 'Predicted risk score for Skyline Tower (Phase 2) has increased to 8.4. Structural deviation detected in foundation pour records.',
    time: '2 minutes ago',
    category: 'risk',
    unread: true,
  },
  {
    id: 'n-2',
    title: 'Daily Log Approved',
    message: 'The daily site log for Alpha Site - Wing B has been approved by the Regional Director.',
    time: '1 hour ago',
    category: 'log',
    unread: true,
  },
  {
    id: 'n-3',
    title: 'System Maintenance Scheduled',
    message: 'Aegis Construct will undergo scheduled maintenance on Sunday, Oct 22 at 02:00 AM UTC. Expect intermittent service for 60 minutes.',
    time: '4 hours ago',
    category: 'system',
    unread: false,
  },
  {
    id: 'n-4',
    title: 'New Project Assignment',
    message: 'You have been assigned as the Lead Overseer for the Harbor Bridge Renovation project.',
    time: 'Yesterday',
    category: 'assignment',
    unread: false,
  },
  {
    id: 'n-5',
    title: 'Milestone Reached',
    message: 'Project Gamma has completed the Environmental Compliance phase ahead of schedule.',
    time: 'Oct 19, 2023',
    category: 'milestone',
    unread: false,
  },
]

function FilterChip({
  active,
  children,
  onClick,
}: {
  active: boolean
  children: React.ReactNode
  onClick: () => void
}) {
  return (
    <Button
      variant={active ? 'default' : 'secondary'}
      size="sm"
      className="h-9 rounded-full px-4"
      onClick={onClick}
    >
      {children}
    </Button>
  )
}

export default function NotificationsPage({ params }: NotificationsPageProps) {
  const { projectId } = use(params)
  const searchParams = useSearchParams()
  const userRole = (searchParams.get('role') as ProjectRole) || 'site_engineer'
  const [filter, setFilter] = useState<NotificationFilter>('all')

  const project = mockProjects.find((item) => item.id === projectId)

  const filteredNotifications = useMemo(() => {
    return notifications.filter((item) => {
      if (filter === 'unread') return item.unread
      if (filter === 'risk') return item.category === 'risk'
      if (filter === 'system') return item.category === 'system'
      return true
    })
  }, [filter])

  if (!project) return null

  const unreadCount = notifications.filter((item) => item.unread).length

  const getNotificationHref = (notification: NotificationItem) => {
    if (notification.category === 'risk') return `/dashboard/${projectId}/reports?role=${userRole}`
    if (notification.category === 'log') return `/dashboard/${projectId}/logs?role=${userRole}`
    if (notification.category === 'assignment') return `/dashboard/${projectId}?role=${userRole}`
    return `/dashboard/${projectId}?role=${userRole}`
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>
            <Badge className="rounded-full bg-blue-100 text-blue-700 hover:bg-blue-100">{unreadCount} unread</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Project {project.name} • role {userRole.replace('_', ' ')}
          </p>
        </div>

        <Button variant="outline" className="gap-2 self-start shadow-sm">
          <CheckCircle2 className="h-4 w-4" />
          Mark all as read
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <FilterChip active={filter === 'all'} onClick={() => setFilter('all')}>All</FilterChip>
        <FilterChip active={filter === 'unread'} onClick={() => setFilter('unread')}>Unread</FilterChip>
        <FilterChip active={filter === 'risk'} onClick={() => setFilter('risk')}>Risk Alerts</FilterChip>
        <FilterChip active={filter === 'system'} onClick={() => setFilter('system')}>System Updates</FilterChip>
      </div>

      <div className="space-y-4">
        {filteredNotifications.map((notification) => {
          const config = categoryConfig[notification.category]
          const Icon = config.icon

          return (
            <Link key={notification.id} href={getNotificationHref(notification)} className="block">
              <Card
                className={`overflow-hidden border shadow-sm transition-shadow hover:shadow-md ${notification.unread ? 'border-l-4 border-l-blue-600' : ''}`}
              >
                <CardContent className="p-0">
                <div className="flex items-start gap-4 p-4 sm:p-5">
                  <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl border ${config.accent}`}>
                    <Icon className={`h-5 w-5 ${notification.unread ? 'text-red-600' : 'text-slate-600'}`} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="font-semibold leading-none tracking-tight">{notification.title}</h2>
                          <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${config.pill}`}>
                            {config.label}
                          </span>
                        </div>
                        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{notification.message}</p>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground">{notification.time}</span>
                        {notification.unread ? <span className="h-2.5 w-2.5 rounded-full bg-blue-700" /> : null}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            </Link>
          )
        })}
      </div>

      {filteredNotifications.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-14 text-center">
            <Info className="mb-3 h-10 w-10 text-muted-foreground/60" />
            <h2 className="text-base font-medium">No notifications match this filter</h2>
            <p className="mt-1 text-sm text-muted-foreground">Try switching back to All or Unread.</p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}