'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ArrowLeft, Loader2, User, Building2, CheckCircle2, Clock, Mail, Phone } from 'lucide-react'
import { updateMe, fetchMyProjects } from '@/lib/api'
import type { ProjectListItem } from '@/lib/api-types'
import { toast } from 'sonner'

export default function ProfilePage() {
    const router = useRouter()
    const { user, refreshUser } = useAuth()
    const [saving, setSaving] = useState(false)
    const [loading, setLoading] = useState(true)
    const [fullName, setFullName] = useState(user?.full_name || '')
    const [email, setEmail] = useState(user?.email || '')
    const [phone, setPhone] = useState(user?.phone_number || '')
    const [projects, setProjects] = useState<ProjectListItem[]>([])

    useEffect(() => {
        if (user) {
            setFullName(user.full_name || '')
            setEmail(user.email || '')
            setPhone(user.phone_number || '')

            // Load user projects
            fetchMyProjects(user.id)
                .then(setProjects)
                .catch(() => setProjects([]))
                .finally(() => setLoading(false))
        }
    }, [user])

    const initials = user?.full_name
        .split(' ')
        .filter(n => n.length > 0)
        .map(n => n[0])
        .join('')
        .toUpperCase() || 'U'

    // Calculate project statistics
    const totalProjects = projects.length
    const completedProjects = projects.filter(p => p.status === 'completed').length
    const activeProjects = projects.filter(p => ['in_progress', 'planning'].includes(p.status)).length

    const handleSave = async () => {
        if (!fullName.trim()) {
            toast.error('Full name is required')
            return
        }
        if (!email.trim()) {
            toast.error('Email is required')
            return
        }

        setSaving(true)
        try {
            await updateMe({
                full_name: fullName.trim(),
                email: email.trim(),
                phone_number: phone.trim() || undefined,
            })
            await refreshUser()
            toast.success('Profile updated successfully')
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Failed to update profile')
        } finally {
            setSaving(false)
        }
    }

    if (!user || loading) {
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
                    <h1 className="text-xl font-semibold">Profile Settings</h1>
                </div>
            </header>

            {/* Main Content */}
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="space-y-6">
                    {/* Profile Card */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Personal Information</CardTitle>
                            <CardDescription>Update your personal details and contact information</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {/* Avatar */}
                            <div className="flex items-center gap-4">
                                <Avatar className="h-20 w-20">
                                    <AvatarFallback className="text-2xl">{initials}</AvatarFallback>
                                </Avatar>
                                <div>
                                    <p className="text-sm font-medium">Profile Picture</p>
                                    <p className="text-xs text-muted-foreground">Avatar is generated from your initials</p>
                                </div>
                            </div>

                            {/* Form Fields */}
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="fullName">Full Name *</Label>
                                    <Input
                                        id="fullName"
                                        value={fullName}
                                        onChange={(e) => setFullName(e.target.value)}
                                        placeholder="Enter your full name"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="email">Email *</Label>
                                    <Input
                                        id="email"
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="your.email@example.com"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="phone">Phone Number</Label>
                                    <Input
                                        id="phone"
                                        type="tel"
                                        value={phone}
                                        onChange={(e) => setPhone(e.target.value)}
                                        placeholder="+251 912 345 678"
                                    />
                                </div>
                            </div>

                            {/* Save Button */}
                            <div className="flex justify-end gap-2">
                                <Button variant="outline" onClick={() => router.back()}>
                                    Cancel
                                </Button>
                                <Button onClick={handleSave} disabled={saving}>
                                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Save Changes
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Account Info Card */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Account Information</CardTitle>
                            <CardDescription>View your account details</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <p className="text-muted-foreground">Account Type</p>
                                    <p className="font-medium">{user.is_admin ? 'Administrator' : 'User'}</p>
                                </div>
                                <div>
                                    <p className="text-muted-foreground">Account Status</p>
                                    <p className="font-medium text-emerald-600">Active</p>
                                </div>
                                <div>
                                    <p className="text-muted-foreground">Member Since</p>
                                    <p className="font-medium">
                                        {user.created_at ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : '—'}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-muted-foreground">Last Updated</p>
                                    <p className="font-medium">
                                        {user.updated_at ? new Date(user.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Project Statistics Card */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Project Statistics</CardTitle>
                            <CardDescription>Your project involvement and contributions</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-3 gap-4">
                                <div className="rounded-lg border bg-card p-4 text-center">
                                    <div className="flex items-center justify-center mb-2">
                                        <Building2 className="h-5 w-5 text-primary" />
                                    </div>
                                    <p className="text-3xl font-bold">{totalProjects}</p>
                                    <p className="text-sm text-muted-foreground mt-1">Total Projects</p>
                                </div>
                                <div className="rounded-lg border bg-card p-4 text-center">
                                    <div className="flex items-center justify-center mb-2">
                                        <Clock className="h-5 w-5 text-amber-600" />
                                    </div>
                                    <p className="text-3xl font-bold">{activeProjects}</p>
                                    <p className="text-sm text-muted-foreground mt-1">Active Projects</p>
                                </div>
                                <div className="rounded-lg border bg-card p-4 text-center">
                                    <div className="flex items-center justify-center mb-2">
                                        <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                                    </div>
                                    <p className="text-3xl font-bold">{completedProjects}</p>
                                    <p className="text-sm text-muted-foreground mt-1">Completed</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Public Profile Info Card */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Public Profile</CardTitle>
                            <CardDescription>Information visible to other team members</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                                <User className="h-5 w-5 text-muted-foreground" />
                                <div>
                                    <p className="text-sm font-medium">{user.full_name}</p>
                                    <p className="text-xs text-muted-foreground">Full Name</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                                <Mail className="h-5 w-5 text-muted-foreground" />
                                <div>
                                    <p className="text-sm font-medium">{user.email}</p>
                                    <p className="text-xs text-muted-foreground">Email Address</p>
                                </div>
                            </div>
                            {user.phone_number && (
                                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                                    <Phone className="h-5 w-5 text-muted-foreground" />
                                    <div>
                                        <p className="text-sm font-medium">{user.phone_number}</p>
                                        <p className="text-xs text-muted-foreground">Phone Number</p>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
