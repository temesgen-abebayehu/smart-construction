'use client'

import { use, useEffect, useState, type ReactNode } from 'react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import { useAuth } from '@/lib/auth-context'
import { getProject, updateMe } from '@/lib/api'
import type { ProjectDetail } from '@/lib/api-types'
import { roleLabels } from '@/lib/domain'
import { useProjectRole } from '@/lib/project-role-context'
import { CalendarClock, Eye, EyeOff, KeyRound, Loader2, MapPin, PencilLine, Save, UserCircle2, X } from 'lucide-react'

interface ProfilePageProps {
  params: Promise<{ projectId: string }>
}

function StatRow({ label, value, accent }: { label: string; value: ReactNode; accent?: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border bg-card px-4 py-3 text-sm shadow-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={accent}>{value}</span>
    </div>
  )
}

export default function ProfilePage({ params }: ProfilePageProps) {
  const { projectId } = use(params)
  const { user, refreshUser } = useAuth()
  const role = useProjectRole()
  const [project, setProject] = useState<ProjectDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Editable fields
  const [editName, setEditName] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editEmail, setEditEmail] = useState('')

  // Change password dialog
  const [pwOpen, setPwOpen] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNewPw, setShowNewPw] = useState(false)
  const [pwSaving, setPwSaving] = useState(false)
  const [pwError, setPwError] = useState<string | null>(null)
  const [pwSuccess, setPwSuccess] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const p = await getProject(projectId)
        if (!cancelled) setProject(p)
      } catch {
        if (!cancelled) setProject(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [projectId])

  useEffect(() => {
    if (user) {
      setEditName(user.full_name)
      setEditPhone(user.phone_number || user.phone_number|| '')
      setEditEmail(user.email)
    }
  }, [user])

  const handleSave = async () => {
    setSaving(true)
    setSaveError(null)
    try {
      await updateMe({
        full_name: editName.trim() || undefined,
        phone_number: editPhone.trim() || undefined,
        email: editEmail.trim() || undefined,
      })
      await refreshUser()
      setEditing(false)
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  const handleChangePassword = async () => {
    if (newPassword.length < 8) {
      setPwError('Password must be at least 8 characters')
      return
    }
    if (newPassword !== confirmPassword) {
      setPwError('Passwords do not match')
      return
    }
    setPwSaving(true)
    setPwError(null)
    try {
      await updateMe({ password: newPassword })
      setPwSuccess(true)
      setNewPassword('')
      setConfirmPassword('')
      setTimeout(() => { setPwOpen(false); setPwSuccess(false) }, 1500)
    } catch (e) {
      setPwError(e instanceof Error ? e.message : 'Failed to change password')
    } finally {
      setPwSaving(false)
    }
  }

  if (loading || !user || !project) {
    return (
      <div className="flex justify-center py-24 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  const initials = user.full_name
    .split(' ')
    .filter((part) => part.length > 0)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'U'

  const joinDateLabel = user.created_at
    ? `Joined ${new Date(user.created_at).toLocaleDateString()}`
    : '—'

  return (
    <div className="grid gap-6 xl:grid-cols-[280px_1fr]">
      <Card className="overflow-hidden border-0 shadow-sm">
        <CardContent className="space-y-5 p-5">
          <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-slate-100 to-slate-300 p-3 shadow-inner">
            <Avatar className="h-56 w-full rounded-2xl object-cover">
              <AvatarFallback className="text-4xl">{initials}</AvatarFallback>
            </Avatar>
          </div>

          <div className="space-y-3 rounded-2xl border bg-muted/50 p-4">
            <StatRow
              label="Account Status"
              value={
                <Badge className={user.is_active ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100' : 'bg-red-100 text-red-700'}>
                  {user.is_active ? 'Active' : 'Inactive'}
                </Badge>
              }
            />
            <StatRow label="Member Since" value={joinDateLabel} />
            <StatRow
              label="Access Level"
              value={user.is_admin ? 'Administrator' : 'Member'}
              accent="font-medium text-blue-700"
            />
          </div>

          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={() => setPwOpen(true)}
          >
            <KeyRound className="h-4 w-4" />
            Change Password
          </Button>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardHeader className="flex flex-row items-start justify-between gap-4 border-b bg-card/60 pb-4">
          <div>
            <CardTitle className="text-xl">Personal Information</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">Manage your profile and contact preferences.</p>
          </div>
          {editing ? (
            <Button variant="outline" size="sm" className="gap-2" onClick={() => {
              setEditing(false)
              setEditName(user.full_name)
              setEditPhone(user.phone_number || user.phone_number || '')
              setEditEmail(user.email)
              setSaveError(null)
            }}>
              <X className="h-4 w-4" />
              Cancel
            </Button>
          ) : (
            <Button variant="outline" className="gap-2 shadow-sm" onClick={() => setEditing(true)}>
              <PencilLine className="h-4 w-4" />
              Edit Profile
            </Button>
          )}
        </CardHeader>

        <CardContent className="space-y-6 p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Full Name</Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                disabled={!editing}
                className={!editing ? 'bg-muted/40' : ''}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Role</Label>
              <Input value={roleLabels[role]} readOnly className="bg-muted/40" />
            </div>
            <div className="space-y-2">
              <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Email</Label>
              <Input
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                disabled={!editing}
                className={!editing ? 'bg-muted/40' : ''}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Contact Number</Label>
              <Input
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                disabled={!editing}
                placeholder="+251 91 123 4567"
                className={!editing ? 'bg-muted/40' : ''}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Project Site</Label>
            <Input value={project.location || '—'} readOnly className="bg-muted/40" />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <StatRow label="Project" value={project.name} />
            <StatRow label="Current Role" value={roleLabels[role]} />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-muted/50 p-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <UserCircle2 className="h-4 w-4" />
              <span>{user.email}</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              <span>{project.location || '—'}</span>
              <CalendarClock className="ml-2 h-4 w-4" />
              <span>{joinDateLabel}</span>
            </div>
          </div>

          {saveError && (
            <p className="text-sm text-destructive">{saveError}</p>
          )}

          {editing && (
            <div className="flex justify-end pt-2">
              <Button onClick={() => void handleSave()} disabled={saving} className="gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save Changes
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Change Password Dialog */}
      <Dialog open={pwOpen} onOpenChange={(open) => { setPwOpen(open); if (!open) { setPwError(null); setPwSuccess(false) } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
            <DialogDescription>Enter a new password for your account.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="new-pw">New Password</Label>
              <div className="relative">
                <Input
                  id="new-pw"
                  type={showNewPw ? 'text' : 'password'}
                  placeholder="Minimum 8 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={pwSaving}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowNewPw(!showNewPw)}
                >
                  {showNewPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-pw">Confirm Password</Label>
              <Input
                id="confirm-pw"
                type="password"
                placeholder="Re-enter password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={pwSaving}
              />
              {confirmPassword && confirmPassword !== newPassword && (
                <p className="text-xs text-destructive">Passwords do not match</p>
              )}
            </div>
            {pwError && <p className="text-sm text-destructive">{pwError}</p>}
            {pwSuccess && <p className="text-sm text-emerald-600">Password changed successfully.</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPwOpen(false)} disabled={pwSaving}>Cancel</Button>
            <Button onClick={() => void handleChangePassword()} disabled={pwSaving || !newPassword}>
              {pwSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Update Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
