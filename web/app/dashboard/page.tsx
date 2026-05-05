'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import { fetchMyProjects } from '@/lib/api'
import type { ProjectListItem } from '@/lib/api-types'
import { roleLabels, statusColors } from '@/lib/domain'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  ArrowRight,
  Building2,
  Calendar,
  Loader2,
  LogOut,
  MapPin,
  Plus,
  TrendingUp,
} from 'lucide-react'

export default function DashboardProjectListPage() {
  const router = useRouter()
  const { user, isAuthenticated, isLoading: authLoading, logout } = useAuth()
  const [projects, setProjects] = useState<ProjectListItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login')
    }
  }, [authLoading, isAuthenticated, router])

  useEffect(() => {
    if (!user) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const visible = await fetchMyProjects(user.id)
        if (!cancelled) setProjects(visible)
      } catch {
        if (!cancelled) setProjects([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [user?.id])

  const handleLogout = async () => {
    await logout()
    router.push('/')
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!isAuthenticated) return null

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Building2 className="h-7 w-7 text-primary" />
            <span className="font-bold text-xl text-foreground">ConstructPro</span>
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground hidden sm:block">
              {user?.full_name}
            </span>
            <Button variant="ghost" size="sm" onClick={() => void handleLogout()} className="gap-2">
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Your Projects</h1>
            <p className="text-sm text-muted-foreground">Select a project to open, or create a new one.</p>
          </div>
          <Button className="gap-2" onClick={() => router.push('/dashboard/new-project')}>
            <Plus className="h-4 w-4" />
            New Project
          </Button>
        </div>

        {loading && (
          <div className="flex justify-center py-24 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        )}

        {!loading && projects.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <Building2 className="h-16 w-16 text-muted-foreground/30 mb-4" />
              <h2 className="text-lg font-semibold">No projects yet</h2>
              <p className="text-sm text-muted-foreground mt-1 mb-6 max-w-sm">
                Create your first project to start managing tasks, teams, and daily logs.
              </p>
              <Button className="gap-2" onClick={() => router.push('/dashboard/new-project')}>
                <Plus className="h-4 w-4" />
                Create Your First Project
              </Button>
            </CardContent>
          </Card>
        )}

        {!loading && projects.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => {
              const progressPct = Math.min(100, Math.max(0, Number(project.overall_progress_pct ?? 0)) || 0)
              const statusClass = statusColors[project.status] ?? 'bg-muted text-muted-foreground'
              const roleLabel = roleLabels[project.my_role] ?? 'Team member'
              return (
                <button
                  key={project.id}
                  type="button"
                  onClick={() => router.push(`/dashboard/${project.id}`)}
                  className="text-left p-5 rounded-xl border border-border hover:border-primary/50 hover:shadow-md bg-card transition-all group cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <h3 className="font-semibold text-foreground truncate">{project.name}</h3>
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0 mt-0.5" />
                  </div>

                  <div className="flex items-center gap-2 mb-3">
                    <Badge variant="secondary" className={`${statusClass} text-xs`}>
                      {String(project.status ?? 'unknown').replace('_', ' ')}
                    </Badge>
                    <Badge variant="outline" className="text-xs font-normal">
                      {roleLabel}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-muted-foreground mb-4">
                    {project.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {project.location}
                      </span>
                    )}
                    {project.planned_end_date && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(project.planned_end_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-xs mb-2">
                    <TrendingUp className="h-3.5 w-3.5 text-primary" />
                    <span className="font-medium">{progressPct.toFixed(0)}% complete</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
