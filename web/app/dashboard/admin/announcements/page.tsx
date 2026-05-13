'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { useAuth } from '@/lib/auth-context'
import {
    listAllAnnouncements,
    createAnnouncement,
    updateAnnouncement,
    deleteAnnouncement,
} from '@/lib/api'
import type { AnnouncementItem } from '@/lib/api-types'
import { Loader2, Plus, Edit, Trash2, Megaphone, ArrowLeft } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

export default function AdminAnnouncementsPage() {
    const router = useRouter()
    const { user, isAuthenticated, isLoading: authLoading } = useAuth()
    const { toast } = useToast()
    const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [dialogOpen, setDialogOpen] = useState(false)
    const [editingAnnouncement, setEditingAnnouncement] = useState<AnnouncementItem | null>(null)
    const [formData, setFormData] = useState({
        title: '',
        content: '',
        priority: 'normal',
        expires_at: '',
    })
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        if (!authLoading && !isAuthenticated) {
            router.push('/login')
        }
        if (!authLoading && isAuthenticated && !user?.is_admin) {
            router.push('/dashboard')
        }
    }, [authLoading, isAuthenticated, user, router])

    const loadAnnouncements = async () => {
        setLoading(true)
        setError(null)
        try {
            const data = await listAllAnnouncements()
            setAnnouncements(data)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load announcements')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (!isAuthenticated || !user?.is_admin) return
        loadAnnouncements()
    }, [isAuthenticated, user])

    const handleOpenDialog = (announcement?: AnnouncementItem) => {
        if (announcement) {
            setEditingAnnouncement(announcement)
            setFormData({
                title: announcement.title,
                content: announcement.content,
                priority: announcement.priority,
                expires_at: announcement.expires_at
                    ? new Date(announcement.expires_at).toISOString().slice(0, 16)
                    : '',
            })
        } else {
            setEditingAnnouncement(null)
            setFormData({
                title: '',
                content: '',
                priority: 'normal',
                expires_at: '',
            })
        }
        setDialogOpen(true)
    }

    const handleSave = async () => {
        if (!formData.title || !formData.content) {
            toast({
                title: 'Error',
                description: 'Title and content are required',
                variant: 'destructive',
            })
            return
        }

        setSaving(true)
        try {
            const payload = {
                title: formData.title,
                content: formData.content,
                priority: formData.priority,
                expires_at: formData.expires_at || undefined,
            }

            if (editingAnnouncement) {
                await updateAnnouncement(editingAnnouncement.id, payload)
                toast({
                    title: 'Success',
                    description: 'Announcement updated successfully',
                })
            } else {
                await createAnnouncement(payload)
                toast({
                    title: 'Success',
                    description: 'Announcement created successfully',
                })
            }

            setDialogOpen(false)
            loadAnnouncements()
        } catch (err) {
            toast({
                title: 'Error',
                description: err instanceof Error ? err.message : 'Failed to save announcement',
                variant: 'destructive',
            })
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this announcement?')) return

        try {
            await deleteAnnouncement(id)
            toast({
                title: 'Success',
                description: 'Announcement deleted successfully',
            })
            loadAnnouncements()
        } catch (err) {
            toast({
                title: 'Error',
                description: err instanceof Error ? err.message : 'Failed to delete announcement',
                variant: 'destructive',
            })
        }
    }

    const handleToggleActive = async (announcement: AnnouncementItem) => {
        try {
            await updateAnnouncement(announcement.id, {
                is_active: !announcement.is_active,
            })
            toast({
                title: 'Success',
                description: `Announcement ${announcement.is_active ? 'deactivated' : 'activated'}`,
            })
            loadAnnouncements()
        } catch (err) {
            toast({
                title: 'Error',
                description: err instanceof Error ? err.message : 'Failed to update announcement',
                variant: 'destructive',
            })
        }
    }

    if (authLoading || (loading && announcements.length === 0)) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    if (!isAuthenticated || !user?.is_admin) return null

    const getPriorityBadge = (priority: string) => {
        switch (priority) {
            case 'urgent':
                return <Badge variant="destructive">Urgent</Badge>
            case 'high':
                return <Badge className="bg-orange-500">High</Badge>
            case 'normal':
                return <Badge variant="secondary">Normal</Badge>
            case 'low':
                return <Badge variant="outline">Low</Badge>
            default:
                return <Badge variant="secondary">{priority}</Badge>
        }
    }

    return (
        <div className="p-8 space-y-8">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => router.push('/dashboard')}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Announcements</h1>
                        <p className="text-muted-foreground mt-2">Create and manage platform-wide announcements</p>
                    </div>
                </div>
                <Button onClick={() => handleOpenDialog()} className="gap-2">
                    <Plus className="h-4 w-4" />
                    New Announcement
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>All Announcements</CardTitle>
                    <CardDescription>Manage announcements visible to all users</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {error && (
                        <div className="p-4 border border-destructive/20 bg-destructive/5 rounded-lg text-sm text-destructive">
                            {error}
                        </div>
                    )}

                    <div className="border rounded-lg">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Title</TableHead>
                                    <TableHead>Priority</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Created</TableHead>
                                    <TableHead>Expires</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center py-8">
                                            <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                                        </TableCell>
                                    </TableRow>
                                ) : announcements.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                            No announcements yet
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    announcements.map((announcement) => (
                                        <TableRow key={announcement.id}>
                                            <TableCell className="font-medium max-w-xs">
                                                <div className="truncate">{announcement.title}</div>
                                                <div className="text-xs text-muted-foreground truncate">
                                                    {announcement.content.substring(0, 60)}
                                                    {announcement.content.length > 60 ? '...' : ''}
                                                </div>
                                            </TableCell>
                                            <TableCell>{getPriorityBadge(announcement.priority)}</TableCell>
                                            <TableCell>
                                                {announcement.is_active ? (
                                                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                                        Active
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">
                                                        Inactive
                                                    </Badge>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                {new Date(announcement.created_at).toLocaleDateString('en-US', {
                                                    month: 'short',
                                                    day: 'numeric',
                                                    year: 'numeric',
                                                })}
                                            </TableCell>
                                            <TableCell>
                                                {announcement.expires_at
                                                    ? new Date(announcement.expires_at).toLocaleDateString('en-US', {
                                                        month: 'short',
                                                        day: 'numeric',
                                                        year: 'numeric',
                                                    })
                                                    : '—'}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleToggleActive(announcement)}
                                                    >
                                                        {announcement.is_active ? 'Deactivate' : 'Activate'}
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => handleOpenDialog(announcement)}
                                                    >
                                                        <Edit className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => handleDelete(announcement.id)}
                                                        className="text-destructive hover:text-destructive"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            {/* Create/Edit Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>
                            {editingAnnouncement ? 'Edit Announcement' : 'Create Announcement'}
                        </DialogTitle>
                        <DialogDescription>
                            {editingAnnouncement
                                ? 'Update the announcement details'
                                : 'Create a new platform-wide announcement'}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="title">Title</Label>
                            <Input
                                id="title"
                                value={formData.title}
                                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                placeholder="Announcement title"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="content">Content</Label>
                            <Textarea
                                id="content"
                                value={formData.content}
                                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                                placeholder="Announcement content"
                                rows={5}
                            />
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="priority">Priority</Label>
                                <Select
                                    value={formData.priority}
                                    onValueChange={(value) => setFormData({ ...formData, priority: value })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="low">Low</SelectItem>
                                        <SelectItem value="normal">Normal</SelectItem>
                                        <SelectItem value="high">High</SelectItem>
                                        <SelectItem value="urgent">Urgent</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="expires_at">Expires At (Optional)</Label>
                                <Input
                                    id="expires_at"
                                    type="datetime-local"
                                    value={formData.expires_at}
                                    onChange={(e) => setFormData({ ...formData, expires_at: e.target.value })}
                                />
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
                            Cancel
                        </Button>
                        <Button onClick={handleSave} disabled={saving}>
                            {saving ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                    Saving...
                                </>
                            ) : editingAnnouncement ? (
                                'Update'
                            ) : (
                                'Create'
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
