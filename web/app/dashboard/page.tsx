'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/lib/auth-context'
import { ProjectSelectionModal } from '@/components/project-selection-modal'
import { fetchMyProjects } from '@/lib/api'
import type { ProjectListItem } from '@/lib/api-types'
import { roleLabels, statusColors } from '@/lib/domain'
import {
  ArrowRight,
  Building2,
  Calendar,
  Loader2,
  LogOut,
  MapPin,
  Plus,
  TrendingUp,
  Users,
} from 'lucide-react'

export default function DashboardProjectListPage() {
  const router = useRouter()
  const { user, isAuthenticated, isLoading: authLoading, logout } = useAuth()
  const [modalOpen, setModalOpen] = useState(true)
  const [projects, setProjects] = useState<ProjectListItem[]>([])
  const [projectsLoading, setProjectsLoading] = useState(false)
  const [projectsError, setProjectsError] = useState<string | null>(null)

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login')
    }
  }, [authLoading, isAuthenticated, router])

  useEffect(() => {
    if (!isAuthenticated || !user) return

    let cancelled = false

    ;(async () => {
      setProjectsLoading(true)
      setProjectsError(null)
      try {
        const visibleProjects = await fetchMyProjects(user.id)
        if (!cancelled) {
          setProjects(visibleProjects)
        }
      } catch (error) {
        if (!cancelled) {
          setProjects([])
          setProjectsError(error instanceof Error ? error.message : 'Failed to load your projects')
        }
      } finally {
        if (!cancelled) {
          setProjectsLoading(false)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [isAuthenticated, user?.id])

  const handleLogout = async () => {
    await logout()
    router.push('/')
  }

  const handleModalChange = (open: boolean) => {
    setModalOpen(open)
  }

  const handleOpenProject = (projectId: string) => {
    router.push(`/dashboard/${projectId}`)
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
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Building2 className="h-7 w-7 text-primary" />
            <span className="font-bold text-xl text-foreground">ConstructPro</span>
          </Link>
          <div className="flex items-center gap-4">
            {/* Profile Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2 pl-2 pr-3">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                  </Avatar>
                  <div className="hidden sm:block text-left">
                    <p className="text-sm font-medium leading-none max-w-[120px] truncate">{user?.full_name}</p>
                    <p className="text-xs text-muted-foreground">{user?.email}</p>
                  </div>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div>
                    <p className="font-medium">{user?.full_name}</p>
                    <p className="text-xs text-muted-foreground font-normal">{user?.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => router.push('/dashboard/profile')}>
                  <User className="mr-2 h-4 w-4" />
                  Profile
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => router.push('/dashboard/settings')}>
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setModalOpen(true)}>
                  <Building2 className="mr-2 h-4 w-4" />
                  Select Project
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium uppercase tracking-[0.25em] text-muted-foreground">
              Your workspace
            </p>
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Pick a project or start a new one
            </h1>
            <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">
              choose your existing projects below if you have any. 
             or create a new project immediately.
            </p>
          </div>

          <Button onClick={() => router.push('/dashboard/new-project')} className="gap-2 self-start">
            <Plus className="h-4 w-4" />
            Create New Project
          </Button>
        </div>

        {projectsLoading && (
          <div className="flex items-center justify-center rounded-xl border border-dashed border-border bg-card/60 py-16 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        )}

        {!projectsLoading && projectsError && (
          <Card className="border-destructive/20 bg-destructive/5">
            <CardContent className="p-6 text-sm text-destructive">{projectsError}</CardContent>
          </Card>
        )}

        {!projectsLoading && !projectsError && projects.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center gap-4 py-16 text-center">
              <Building2 className="h-12 w-12 text-muted-foreground/60" />
              <div className="space-y-2">
                <h2 className="text-xl font-semibold">No projects assigned yet</h2>
                <p className="max-w-md text-sm text-muted-foreground">
                  Create your first project to get started, then invite your team and begin tracking
                  progress.
                </p>
              </div>
              <Button onClick={() => router.push('/dashboard/new-project')} className="gap-2">
                <Plus className="h-4 w-4" />
                Create New Project
              </Button>
            </CardContent>
          </Card>
        )}

        {!projectsLoading && !projectsError && projects.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {projects.map((project) => {
              const progressPct = Math.min(
                100,
                Math.max(0, Number(project.overall_progress_pct ?? 0)) || 0,
              )
              const statusClass =
                statusColors[project.status] ?? 'bg-muted text-muted-foreground'
              const roleLabel = roleLabels[project.my_role] ?? 'Team member'
              const dueDate = project.planned_end_date
                ? new Date(project.planned_end_date).toLocaleDateString('en-US', {
                    month: 'short',
                    year: 'numeric',
                  })
                : null

              return (
                <Card key={project.id} className="group overflow-hidden transition-shadow hover:shadow-lg">
                  <CardHeader className="space-y-4 pb-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <CardTitle className="truncate text-xl">{project.name}</CardTitle>
                        <CardDescription className="mt-1 flex items-center gap-2 text-sm">
                          <Badge variant="secondary" className={statusClass}>
                            {String(project.status ?? 'unknown').replace('_', ' ')}
                          </Badge>
                          <span className="text-muted-foreground">{roleLabel}</span>
                        </CardDescription>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenProject(project.id)}
                        aria-label={`Open ${project.name}`}
                      >
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5" />
                        {project.location || project.client_name || '—'}
                      </span>
                      {dueDate && (
                        <span className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5" />
                          {dueDate}
                        </span>
                      )}
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4 pt-0">
                    <div className="flex items-center gap-4 text-sm">
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <Users className="h-4 w-4 text-primary" />
                        {roleLabel}
                      </span>
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <TrendingUp className="h-4 w-4 text-accent" />
                        {progressPct.toFixed(1)}% complete
                      </span>
                    </div>

                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>

                    <Button
                      variant="outline"
                      className="w-full justify-between"
                      onClick={() => handleOpenProject(project.id)}
                    >
                      Open Project
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </main>

      {/* Project Selection Modal */}
      <ProjectSelectionModal open={modalOpen} onOpenChange={handleModalChange} />
    </div>
  )
}
