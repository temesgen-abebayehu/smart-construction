'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ArrowLeft, Loader2, Lock, Shield } from 'lucide-react'
import { updateMe } from '@/lib/api'
import { toast } from 'sonner'

export default function SettingsPage() {
    const router = useRouter()
    const { user, refreshUser } = useAuth()
    const [saving, setSaving] = useState(false)
    const [currentPassword, setCurrentPassword] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')

    const handleChangePassword = async () => {
        if (!currentPassword) {
            toast.error('Current password is required')
            return
        }
        if (!newPassword) {
            toast.error('New password is required')
            return
        }
        if (newPassword.length < 8) {
            toast.error('Password must be at least 8 characters')
            return
        }
        if (newPassword !== confirmPassword) {
            toast.error('Passwords do not match')
            return
        }

        setSaving(true)
        try {
            await updateMe({
                password: newPassword,
            })
            await refreshUser()
            setCurrentPassword('')
            setNewPassword('')
            setConfirmPassword('')
            toast.success('Password changed successfully')
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Failed to change password')
        } finally {
            setSaving(false)
        }
    }

    if (!user) {
        return (
            <div className="flex justify-center py-24">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <header className="border-b border-border bg-card">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => router.back()}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <h1 className="text-xl font-semibold">Account Settings</h1>
                </div>
            </header>

            {/* Main Content */}
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="space-y-6">
                    {/* Security Card */}
                    <Card>
                        <CardHeader>
                            <div className="flex items-center gap-2">
                                <Shield className="h-5 w-5 text-primary" />
                                <CardTitle>Security</CardTitle>
                            </div>
                            <CardDescription>Manage your password and security settings</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="currentPassword">Current Password *</Label>
                                    <Input
                                        id="currentPassword"
                                        type="password"
                                        value={currentPassword}
                                        onChange={(e) => setCurrentPassword(e.target.value)}
                                        placeholder="Enter current password"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="newPassword">New Password *</Label>
                                    <Input
                                        id="newPassword"
                                        type="password"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        placeholder="Enter new password (min 8 characters)"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="confirmPassword">Confirm New Password *</Label>
                                    <Input
                                        id="confirmPassword"
                                        type="password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        placeholder="Confirm new password"
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end gap-2">
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        setCurrentPassword('')
                                        setNewPassword('')
                                        setConfirmPassword('')
                                    }}
                                >
                                    Cancel
                                </Button>
                                <Button onClick={handleChangePassword} disabled={saving}>
                                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    <Lock className="mr-2 h-4 w-4" />
                                    Change Password
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Account Status Card */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Account Status</CardTitle>
                            <CardDescription>Your account information and status</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                <div className="flex items-center justify-between py-2 border-b">
                                    <div>
                                        <p className="font-medium">Account Status</p>
                                        <p className="text-sm text-muted-foreground">Your account is active and in good standing</p>
                                    </div>
                                    <span className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
                                        Active
                                    </span>
                                </div>

                                <div className="flex items-center justify-between py-2 border-b">
                                    <div>
                                        <p className="font-medium">Account Type</p>
                                        <p className="text-sm text-muted-foreground">
                                            {user.is_admin ? 'Administrator with full system access' : 'Standard user account'}
                                        </p>
                                    </div>
                                    <span className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700">
                                        {user.is_admin ? 'Admin' : 'User'}
                                    </span>
                                </div>

                                <div className="flex items-center justify-between py-2">
                                    <div>
                                        <p className="font-medium">Email Verified</p>
                                        <p className="text-sm text-muted-foreground">Your email address is verified</p>
                                    </div>
                                    <span className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
                                        Verified
                                    </span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Preferences Card */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Preferences</CardTitle>
                            <CardDescription>Customize your experience</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                <div className="flex items-center justify-between py-2">
                                    <div>
                                        <p className="font-medium">Email Notifications</p>
                                        <p className="text-sm text-muted-foreground">Receive email updates about your projects</p>
                                    </div>
                                    <span className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
                                        Enabled
                                    </span>
                                </div>

                                <div className="flex items-center justify-between py-2">
                                    <div>
                                        <p className="font-medium">Language</p>
                                        <p className="text-sm text-muted-foreground">Interface language</p>
                                    </div>
                                    <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                                        English
                                    </span>
                                </div>

                                <div className="flex items-center justify-between py-2">
                                    <div>
                                        <p className="font-medium">Timezone</p>
                                        <p className="text-sm text-muted-foreground">Your local timezone</p>
                                    </div>
                                    <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                                        UTC+3 (EAT)
                                    </span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
