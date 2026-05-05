'use client'

import { use, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Card, CardContent } from '@/components/ui/card'
import { useAuth } from '@/lib/auth-context'
import { updateMe } from '@/lib/api'
import { apiRequest } from '@/lib/api-client'
import {
  BellRing,
  ChevronDown,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Mail,
  ShieldCheck,
  UserCog,
} from 'lucide-react'

interface SettingsPageProps {
  params: Promise<{ projectId: string }>
}

function SectionHeader({
  icon: Icon,
  title,
  description,
  open,
}: {
  icon: typeof UserCog
  title: string
  description: string
  open: boolean
}) {
  return (
    <div className="flex items-center justify-between w-full">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-primary/10 p-2 text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-base font-semibold">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
    </div>
  )
}

export default function SettingsPage({ params }: SettingsPageProps) {
  const { projectId } = use(params)
  const { user, logout, refreshUser } = useAuth()

  // Section open states
  const [accountOpen, setAccountOpen] = useState(true)
  const [notifOpen, setNotifOpen] = useState(false)
  const [securityOpen, setSecurityOpen] = useState(false)

  // Account - change email
  const [editEmail, setEditEmail] = useState(user?.email || '')
  const [emailSaving, setEmailSaving] = useState(false)
  const [emailMsg, setEmailMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Account - change password
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [showNewPw, setShowNewPw] = useState(false)
  const [pwSaving, setPwSaving] = useState(false)
  const [pwMsg, setPwMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Notifications
  const [notifInvites, setNotifInvites] = useState(true)
  const [notifLogs, setNotifLogs] = useState(true)
  const [notifTasks, setNotifTasks] = useState(true)
  const [notifBudget, setNotifBudget] = useState(false)

  // Security - forgot password
  const [resetSending, setResetSending] = useState(false)
  const [resetMsg, setResetMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleEmailChange = async () => {
    if (!editEmail.trim() || editEmail === user?.email) return
    setEmailSaving(true)
    setEmailMsg(null)
    try {
      await updateMe({ email: editEmail.trim() })
      await refreshUser()
      setEmailMsg({ type: 'success', text: 'Email updated successfully.' })
    } catch (e) {
      setEmailMsg({ type: 'error', text: e instanceof Error ? e.message : 'Failed to update email' })
    } finally {
      setEmailSaving(false)
    }
  }

  const handlePasswordChange = async () => {
    if (newPw.length < 8) {
      setPwMsg({ type: 'error', text: 'Password must be at least 8 characters.' })
      return
    }
    if (newPw !== confirmPw) {
      setPwMsg({ type: 'error', text: 'Passwords do not match.' })
      return
    }
    setPwSaving(true)
    setPwMsg(null)
    try {
      await updateMe({ password: newPw })
      setPwMsg({ type: 'success', text: 'Password changed successfully.' })
      setCurrentPw('')
      setNewPw('')
      setConfirmPw('')
    } catch (e) {
      setPwMsg({ type: 'error', text: e instanceof Error ? e.message : 'Failed to change password' })
    } finally {
      setPwSaving(false)
    }
  }

  const handleSendResetLink = async () => {
    if (!user?.email) return
    setResetSending(true)
    setResetMsg(null)
    try {
      const result = await apiRequest<{ email_sent: boolean }>('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: user.email }),
      })
      if (result.email_sent === false) {
        setResetMsg({ type: 'error', text: 'Failed to send reset email. Check SMTP configuration.' })
        return
      }
      setResetMsg({ type: 'success', text: `Reset link sent to ${user.email}` })
    } catch {
      setResetMsg({ type: 'error', text: 'Failed to send reset link.' })
    } finally {
      setResetSending(false)
    }
  }

  const handleLogoutAllDevices = async () => {
    await logout()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage your account, notifications, and security preferences.
        </p>
      </div>

      {/* Account & Profile */}
      <Collapsible open={accountOpen} onOpenChange={setAccountOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <button type="button" className="w-full p-5 text-left cursor-pointer hover:bg-muted/30 transition-colors rounded-t-lg">
              <SectionHeader icon={UserCog} title="Account" description="Email, password, and profile." open={accountOpen} />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-6 pt-0 px-5 pb-5">
              {/* Change Email */}
              <div className="space-y-3 rounded-lg border p-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  Email Address
                </div>
                <div className="flex gap-3">
                  <Input
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    onClick={() => void handleEmailChange()}
                    disabled={emailSaving || editEmail === user?.email}
                    size="sm"
                  >
                    {emailSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Update'}
                  </Button>
                </div>
                {emailMsg && (
                  <p className={`text-xs ${emailMsg.type === 'success' ? 'text-emerald-600' : 'text-destructive'}`}>
                    {emailMsg.text}
                  </p>
                )}
              </div>

              {/* Change Password */}
              <div className="space-y-3 rounded-lg border p-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <KeyRound className="h-4 w-4 text-muted-foreground" />
                  Change Password
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <Label className="text-xs text-muted-foreground">New Password</Label>
                    <div className="relative">
                      <Input
                        type={showNewPw ? 'text' : 'password'}
                        placeholder="Minimum 8 characters"
                        value={newPw}
                        onChange={(e) => setNewPw(e.target.value)}
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
                  <div className="space-y-2 sm:col-span-2">
                    <Label className="text-xs text-muted-foreground">Confirm Password</Label>
                    <Input
                      type="password"
                      placeholder="Re-enter password"
                      value={confirmPw}
                      onChange={(e) => setConfirmPw(e.target.value)}
                    />
                    {confirmPw && confirmPw !== newPw && (
                      <p className="text-xs text-destructive">Passwords do not match</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  {pwMsg && (
                    <p className={`text-xs ${pwMsg.type === 'success' ? 'text-emerald-600' : 'text-destructive'}`}>
                      {pwMsg.text}
                    </p>
                  )}
                  <Button
                    onClick={() => void handlePasswordChange()}
                    disabled={pwSaving || !newPw}
                    size="sm"
                    className="ml-auto"
                  >
                    {pwSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Change Password
                  </Button>
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Notifications */}
      <Collapsible open={notifOpen} onOpenChange={setNotifOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <button type="button" className="w-full p-5 text-left cursor-pointer hover:bg-muted/30 transition-colors rounded-t-lg">
              <SectionHeader icon={BellRing} title="Notifications" description="Control email alerts for project events." open={notifOpen} />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-4 pt-0 px-5 pb-5">
              {[
                {
                  label: 'Team Invitations',
                  desc: 'Receive emails when you are invited to a new project.',
                  checked: notifInvites,
                  onChange: setNotifInvites,
                },
                {
                  label: 'Daily Log Updates',
                  desc: 'Get notified when daily logs are submitted or require your approval.',
                  checked: notifLogs,
                  onChange: setNotifLogs,
                },
                {
                  label: 'Task Assignments',
                  desc: 'Receive emails when a task is assigned to you or updated.',
                  checked: notifTasks,
                  onChange: setNotifTasks,
                },
                {
                  label: 'Budget Alerts',
                  desc: 'Get notified when spending exceeds budget thresholds.',
                  checked: notifBudget,
                  onChange: setNotifBudget,
                },
              ].map((item) => (
                <div key={item.label} className="flex items-start justify-between gap-4 rounded-lg border p-4">
                  <div>
                    <p className="text-sm font-medium">{item.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                  </div>
                  <Switch checked={item.checked} onCheckedChange={item.onChange} />
                </div>
              ))}
              <p className="text-xs text-muted-foreground">
                Notification preferences are stored locally. Email delivery requires SMTP configuration.
              </p>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Security */}
      <Collapsible open={securityOpen} onOpenChange={setSecurityOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <button type="button" className="w-full p-5 text-left cursor-pointer hover:bg-muted/30 transition-colors rounded-t-lg">
              <SectionHeader icon={ShieldCheck} title="Security" description="Password reset, sessions, and account security." open={securityOpen} />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-4 pt-0 px-5 pb-5">
              {/* Send password reset link */}
              <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
                <div>
                  <p className="text-sm font-medium">Password Reset via Email</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Send a password reset link to <span className="font-medium">{user?.email}</span>.
                  </p>
                  {resetMsg && (
                    <p className={`text-xs mt-1 ${resetMsg.type === 'success' ? 'text-emerald-600' : 'text-destructive'}`}>
                      {resetMsg.text}
                    </p>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void handleSendResetLink()}
                  disabled={resetSending}
                >
                  {resetSending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                  Send Link
                </Button>
              </div>

              {/* Current session */}
              <div className="rounded-lg border p-4 space-y-3">
                <p className="text-sm font-medium">Current Session</p>
                <div className="flex items-center justify-between text-sm">
                  <div>
                    <p className="text-muted-foreground">Logged in as</p>
                    <p className="font-medium">{user?.full_name}</p>
                    <p className="text-xs text-muted-foreground">{user?.email}</p>
                  </div>
                  <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                    Active
                  </span>
                </div>
              </div>

              {/* Logout */}
              <div className="flex items-start justify-between gap-4 rounded-lg border border-destructive/20 bg-destructive/5 p-4">
                <div>
                  <p className="text-sm font-medium">Sign Out</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    End your current session and return to the login page.
                  </p>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => void handleLogoutAllDevices()}
                >
                  Sign Out
                </Button>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  )
}
