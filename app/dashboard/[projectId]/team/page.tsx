'use client'

import { use } from 'react'
import { useSearchParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Plus,
  MoreHorizontal,
  Mail,
  Phone,
  UserCog,
  UserMinus,
  Shield,
} from 'lucide-react'
import {
  mockProjectMembers,
  mockUsers,
  roleLabels,
  type ProjectRole,
} from '@/lib/mock-data'

interface TeamPageProps {
  params: Promise<{ projectId: string }>
}

const roleColors: Record<ProjectRole, string> = {
  project_manager: 'bg-primary/10 text-primary border-primary/30',
  office_engineer: 'bg-blue-100 text-blue-700 border-blue-300',
  consultant: 'bg-amber-100 text-amber-700 border-amber-300',
  site_engineer: 'bg-green-100 text-green-700 border-green-300',
}

export default function TeamPage({ params }: TeamPageProps) {
  const { projectId } = use(params)
  const searchParams = useSearchParams()
  const userRole = (searchParams.get('role') as ProjectRole) || 'site_engineer'
  
  const projectMembers = mockProjectMembers.filter(pm => pm.project_id === projectId)
  
  // Group members by role
  const membersByRole = projectMembers.reduce((acc, member) => {
    const user = mockUsers.find(u => u.id === member.user_id)
    if (user) {
      if (!acc[member.role]) {
        acc[member.role] = []
      }
      acc[member.role].push({ ...member, user })
    }
    return acc
  }, {} as Record<ProjectRole, Array<typeof projectMembers[0] & { user: typeof mockUsers[0] }>>)

  const canManageTeam = userRole === 'project_manager'

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Team Members</h1>
          <p className="text-muted-foreground">
            Manage project team and roles
          </p>
        </div>
        
        {canManageTeam && (
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Add Member
          </Button>
        )}
      </div>

      {/* Team Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Members</p>
                <p className="text-2xl font-bold">{projectMembers.length}</p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Shield className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        {Object.entries(membersByRole).map(([role, members]) => (
          <Card key={role}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{roleLabels[role as ProjectRole]}</p>
                  <p className="text-2xl font-bold">{members.length}</p>
                </div>
                <Badge variant="outline" className={roleColors[role as ProjectRole]}>
                  {role.split('_').map(w => w[0].toUpperCase()).join('')}
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Team Members by Role */}
      <div className="space-y-6">
        {(['project_manager', 'office_engineer', 'consultant', 'site_engineer'] as ProjectRole[]).map((role) => {
          const members = membersByRole[role] || []
          if (members.length === 0) return null
          
          return (
            <Card key={role}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className={roleColors[role]}>
                    {roleLabels[role]}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {members.length} member{members.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <CardDescription>
                  {role === 'project_manager' && 'Owns the project, gives final approval on daily logs'}
                  {role === 'office_engineer' && 'Reviews document completeness before consultant approval'}
                  {role === 'consultant' && 'Verifies reported work matches actual site work, approves logs'}
                  {role === 'site_engineer' && 'Submits daily logs for assigned tasks'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {members.map((member) => {
                    const initials = member.user.full_name
                      .split(' ')
                      .map(n => n[0])
                      .join('')
                      .toUpperCase()
                    
                    return (
                      <div
                        key={member.id}
                        className="flex items-start gap-4 p-4 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors"
                      >
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={member.user.profile_photo_url} />
                          <AvatarFallback>{initials}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="font-semibold">{member.user.full_name}</p>
                              <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                                <Mail className="h-3.5 w-3.5" />
                                <span className="truncate">{member.user.email}</span>
                              </div>
                              {member.user.phone && (
                                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                  <Phone className="h-3.5 w-3.5" />
                                  <span>{member.user.phone}</span>
                                </div>
                              )}
                            </div>
                            
                            {canManageTeam && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                                    <MoreHorizontal className="h-4 w-4" />
                                    <span className="sr-only">Actions</span>
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem>
                                    <UserCog className="mr-2 h-4 w-4" />
                                    Change Role
                                  </DropdownMenuItem>
                                  <DropdownMenuItem className="text-destructive">
                                    <UserMinus className="mr-2 h-4 w-4" />
                                    Remove from Project
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
