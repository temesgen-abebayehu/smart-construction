'use client'

import { use, useCallback, useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
  Loader2,
} from 'lucide-react'
import {
  listProjectMembersEnriched,
  inviteProjectMember,
  updateMemberRole,
  removeMember,
} from '@/lib/api'
import type { EnrichedMemberRow } from '@/lib/api-types'
import { roleLabels, type ProjectRole } from '@/lib/domain'
import { useProjectRole } from '@/lib/project-role-context'

interface TeamPageProps {
  params: Promise<{ projectId: string }>
}

const roleColors: Record<ProjectRole, string> = {
  owner: 'bg-purple-100 text-purple-700 border-purple-300',
  project_manager: 'bg-primary/10 text-primary border-primary/30',
  office_engineer: 'bg-blue-100 text-blue-700 border-blue-300',
  consultant: 'bg-amber-100 text-amber-700 border-amber-300',
  site_engineer: 'bg-green-100 text-green-700 border-green-300',
}

const ALL_ROLES: ProjectRole[] = ['owner', 'project_manager', 'office_engineer', 'consultant', 'site_engineer']

export default function TeamPage({ params }: TeamPageProps) {
  const { projectId } = use(params)
  const userRole = useProjectRole()

  const [rows, setRows] = useState<EnrichedMemberRow[]>([])
  const [loading, setLoading] = useState(true)

  // Invite dialog state
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<ProjectRole>('site_engineer')
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)

  // Change role dialog state
  const [changeRoleOpen, setChangeRoleOpen] = useState(false)
  const [changeRoleTarget, setChangeRoleTarget] = useState<{
    userId: string
    name: string
    currentRole: ProjectRole
  } | null>(null)
  const [newRole, setNewRole] = useState<ProjectRole>('site_engineer')
  const [changeRoleLoading, setChangeRoleLoading] = useState(false)
  const [changeRoleError, setChangeRoleError] = useState<string | null>(null)

  // Remove member dialog state
  const [removeOpen, setRemoveOpen] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<{
    userId: string
    name: string
  } | null>(null)
  const [removeLoading, setRemoveLoading] = useState(false)

  const refreshMembers = useCallback(async () => {
    try {
      const enriched = await listProjectMembersEnriched(projectId)
      setRows(enriched)
    } catch {
      setRows([])
    }
  }, [projectId])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const enriched = await listProjectMembersEnriched(projectId)
        if (!cancelled) setRows(enriched)
      } catch {
        if (!cancelled) setRows([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [projectId])

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return
    setInviteLoading(true)
    setInviteError(null)
    try {
      await inviteProjectMember(projectId, { email: inviteEmail.trim(), role: inviteRole })
      setInviteOpen(false)
      setInviteEmail('')
      setInviteRole('site_engineer')
      await refreshMembers()
    } catch (e) {
      setInviteError(e instanceof Error ? e.message : 'Failed to send invitation')
    } finally {
      setInviteLoading(false)
    }
  }

  const handleChangeRole = async () => {
    if (!changeRoleTarget) return
    setChangeRoleLoading(true)
    setChangeRoleError(null)
    try {
      await updateMemberRole(projectId, changeRoleTarget.userId, newRole)
      setChangeRoleOpen(false)
      setChangeRoleTarget(null)
      await refreshMembers()
    } catch (e) {
      setChangeRoleError(e instanceof Error ? e.message : 'Failed to update role')
    } finally {
      setChangeRoleLoading(false)
    }
  }

  const handleRemove = async () => {
    if (!removeTarget) return
    setRemoveLoading(true)
    try {
      await removeMember(projectId, removeTarget.userId)
      setRemoveOpen(false)
      setRemoveTarget(null)
      await refreshMembers()
    } catch {
      // Stay on dialog so user can retry
    } finally {
      setRemoveLoading(false)
    }
  }

  const projectMembers = rows.map((r) => ({
    id: r.id,
    role: r.role,
    user: {
      id: r.user.id,
      full_name: r.user.full_name,
      email: r.user.email,
      phone: r.user.phone_number,
    },
  }))

  const membersByRole = projectMembers.reduce(
    (acc, member) => {
      if (!acc[member.role]) acc[member.role] = []
      acc[member.role].push(member)
      return acc
    },
    {} as Record<ProjectRole, typeof projectMembers>,
  )

  const canManageTeam = userRole === 'project_manager' || userRole === 'owner'

  if (loading) {
    return (
      <div className="flex justify-center py-24 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Team Members</h1>
          <p className="text-muted-foreground">
            Manage project team and roles
          </p>
        </div>

        {canManageTeam && (
          <Button className="gap-2" onClick={() => setInviteOpen(true)}>
            <Plus className="h-4 w-4" />
            Add Member
          </Button>
        )}
      </div>

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
                  {role.split('_').map((w) => w[0].toUpperCase()).join('')}
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="space-y-6">
        {ALL_ROLES.map((role) => {
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
                  {role === 'owner' && 'Project owner with full administrative access'}
                  {role === 'project_manager' && 'Manages the project, gives final approval on daily logs'}
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
                      .filter((n) => n.length > 0)
                      .map((n) => n[0])
                      .join('')
                      .toUpperCase() || 'U'

                    return (
                      <div
                        key={member.id}
                        className="flex items-start gap-4 p-4 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors"
                      >
                        <Avatar className="h-12 w-12">
                          <AvatarFallback>{initials}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="font-semibold">{member.user.full_name}</p>
                              {member.user.email && (
                                <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                                  <Mail className="h-3.5 w-3.5" />
                                  <span className="truncate">{member.user.email}</span>
                                </div>
                              )}
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
                                  <DropdownMenuItem
                                    onSelect={() => {
                                      setChangeRoleTarget({
                                        userId: member.user.id,
                                        name: member.user.full_name,
                                        currentRole: member.role,
                                      })
                                      setNewRole(member.role)
                                      setChangeRoleError(null)
                                      setChangeRoleOpen(true)
                                    }}
                                  >
                                    <UserCog className="mr-2 h-4 w-4" />
                                    Change Role
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    className="text-destructive"
                                    onSelect={() => {
                                      setRemoveTarget({
                                        userId: member.user.id,
                                        name: member.user.full_name,
                                      })
                                      setRemoveOpen(true)
                                    }}
                                  >
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

      {/* Invite Member Dialog */}
      <Dialog open={inviteOpen} onOpenChange={(open) => { setInviteOpen(open); if (!open) setInviteError(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Invite Team Member</DialogTitle>
            <DialogDescription>
              Send an invitation to join this project. They will receive a link to accept.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="invite-email">Email address</Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="colleague@company.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                disabled={inviteLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-role">Role</Label>
              <Select
                value={inviteRole}
                onValueChange={(v) => setInviteRole(v as ProjectRole)}
                disabled={inviteLoading}
              >
                <SelectTrigger id="invite-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ALL_ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {roleLabels[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {inviteError && (
              <p className="text-sm text-destructive">{inviteError}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)} disabled={inviteLoading}>
              Cancel
            </Button>
            <Button onClick={handleInvite} disabled={inviteLoading || !inviteEmail.trim()}>
              {inviteLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                'Send Invitation'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Role Dialog */}
      <Dialog open={changeRoleOpen} onOpenChange={(open) => { setChangeRoleOpen(open); if (!open) setChangeRoleError(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Change Role</DialogTitle>
            <DialogDescription>
              Update the role for <span className="font-medium text-foreground">{changeRoleTarget?.name}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Current role</Label>
              <p className="text-sm text-muted-foreground">
                {changeRoleTarget ? roleLabels[changeRoleTarget.currentRole] : ''}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-role">New role</Label>
              <Select
                value={newRole}
                onValueChange={(v) => setNewRole(v as ProjectRole)}
                disabled={changeRoleLoading}
              >
                <SelectTrigger id="new-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ALL_ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {roleLabels[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {changeRoleError && (
              <p className="text-sm text-destructive">{changeRoleError}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChangeRoleOpen(false)} disabled={changeRoleLoading}>
              Cancel
            </Button>
            <Button
              onClick={handleChangeRole}
              disabled={changeRoleLoading || newRole === changeRoleTarget?.currentRole}
            >
              {changeRoleLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                'Update Role'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Member Confirmation */}
      <AlertDialog open={removeOpen} onOpenChange={setRemoveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove team member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove <span className="font-medium text-foreground">{removeTarget?.name}</span> from
              this project? They will lose access to all project resources.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removeLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleRemove()
              }}
              disabled={removeLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {removeLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Removing...
                </>
              ) : (
                'Remove'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
