'use client'

import { useEffect, use } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { DashboardSidebar } from '@/components/dashboard/sidebar'
import { DashboardHeader } from '@/components/dashboard/header'
import { FooterBar } from '@/components/shared/footer-bar'
import { mockProjects, getUserRoleInProject, type ProjectRole } from '@/lib/mock-data'

interface DashboardLayoutProps {
  children: React.ReactNode
  params: Promise<{ projectId: string }>
}

export default function DashboardLayout({ children, params }: DashboardLayoutProps) {
  const { projectId } = use(params)
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, isAuthenticated } = useAuth()
  
  // Get role from URL or fallback to user's actual role in project
  const urlRole = searchParams.get('role') as ProjectRole | null
  const actualRole = user ? getUserRoleInProject(user.id, projectId) : null
  const userRole = urlRole || actualRole || 'site_engineer'
  
  // Find project
  const project = mockProjects.find(p => p.id === projectId)
  
  // Auth check
  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login')
    }
  }, [isAuthenticated, router])
  
  // Project not found check
  if (!project) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Project Not Found</h1>
          <p className="text-muted-foreground mb-4">
            The project you&apos;re looking for doesn&apos;t exist.
          </p>
          <button
            onClick={() => router.push('/')}
            className="text-primary hover:underline"
          >
            Return to Home
          </button>
        </div>
      </div>
    )
  }
  
  if (!isAuthenticated) {
    return null // Will redirect in useEffect
  }

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar */}
      <DashboardSidebar 
        projectId={projectId}
        projectName={project.name}
        userRole={userRole}
      />
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <DashboardHeader 
          projectId={projectId}
          projectName={project.name}
          userRole={userRole}
        />
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
        <FooterBar />
      </div>
    </div>
  )
}
