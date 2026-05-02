'use client'

import { createContext, useContext, type ReactNode } from 'react'
import type { ProjectRole } from './domain'

const ProjectRoleContext = createContext<ProjectRole>('site_engineer')

export function ProjectRoleProvider({
  role,
  children,
}: {
  role: ProjectRole
  children: ReactNode
}) {
  return (
    <ProjectRoleContext.Provider value={role}>
      {children}
    </ProjectRoleContext.Provider>
  )
}

export function useProjectRole(): ProjectRole {
  return useContext(ProjectRoleContext)
}
