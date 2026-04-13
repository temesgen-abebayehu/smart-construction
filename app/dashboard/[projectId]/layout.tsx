'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { ProjectRoleProvider } from '@/lib/project-role-context'
import { DashboardSidebar } from '@/components/dashboard/sidebar'
import { DashboardHeader } from '@/components/dashboard/header'
import { FooterBar } from '@/components/shared/footer-bar'
import { listProjects, projectsVisibleToUser } from '@/lib/api'
import type { ProjectListItem } from '@/lib/api-types'
import type { ProjectRole } from '@/lib/domain'
import { Skeleton } from '@/components/ui/skeleton'

interface DashboardLayoutProps {
  children: React.ReactNode
  params: Promise<{ projectId: string }>
}

export default function DashboardLayout({ children, params }: DashboardLayoutProps) {
  const { projectId } = use(params)
  const router = useRouter()
  const { user, isAuthenticated, isLoading: authLoading } = useAuth()

  const [projectRow, setProjectRow] = useState<ProjectListItem | null>(null)
  const [userRole, setUserRole] = useState<ProjectRole>('site_engineer')
  const [loadError, setLoadError] = useState(false)
  const [dataLoading, setDataLoading] = useState(true)

  useEffect(() => {
    if (!isAuthenticated) return
    let cancelled = false
    ;(async () => {
      setDataLoading(true)
      setLoadError(false)
      try {
        const { data } = await listProjects({ limit: 100 })
        if (cancelled) return
        const visible = projectsVisibleToUser(data, user)
        const row = visible.find((p) => p.id === projectId)
        if (row) {
          setProjectRow(row)
          setUserRole(row.my_role)
          setLoadError(false)
        } else {
          setProjectRow(null)
          setLoadError(true)
        }
      } catch {
        if (!cancelled) {
          setProjectRow(null)
          setLoadError(true)
        }
      } finally {
        if (!cancelled) setDataLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isAuthenticated, projectId, user])

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login')
    }
  }, [authLoading, isAuthenticated, router])

  if (authLoading || (isAuthenticated && dataLoading)) {
    return (
      <div className="min-h-screen flex bg-background p-6 gap-4">
        <Skeleton className="h-full w-64 shrink-0" />
        <div className="flex-1 space-y-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return null
  }

  if (loadError || !projectRow) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Project Not Found</h1>
          <p className="text-muted-foreground mb-4">
            You may not have access to this project, or it does not exist.
          </p>
          <button
            type="button"
            onClick={() => router.push('/')}
            className="text-primary hover:underline"
          >
            Return to Home
          </button>
        </div>
      </div>
    )
  }

  return (
    <ProjectRoleProvider role={userRole}>
      <div className="min-h-screen flex bg-background">
        <DashboardSidebar
          projectId={projectId}
          projectName={projectRow.name}
          userRole={userRole}
        />

        <div className="flex-1 flex flex-col min-w-0">
          <DashboardHeader
            projectId={projectId}
            projectName={projectRow.name}
            userRole={userRole}
          />
          <main className="flex-1 overflow-auto p-6">{children}</main>
          <FooterBar />
        </div>
      </div>
    </ProjectRoleProvider>
  )
}
