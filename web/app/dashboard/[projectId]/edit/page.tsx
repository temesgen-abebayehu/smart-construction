'use client'

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { ArrowLeft, Loader2, Save, Trash2, AlertTriangle } from 'lucide-react'
import { getProject, updateProject, deleteProject } from '@/lib/api'
import type { ProjectDetail } from '@/lib/api-types'
import type { ProjectStatus } from '@/lib/domain'
import { toast } from 'sonner'

interface ProjectEditPageProps {
    params: Promise<{ projectId: string }>
}

const PROJECT_STATUSES: { value: ProjectStatus; label: string }[] = [
    { value: 'planning', label: 'Planning' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'completed', label: 'Completed' },
    { value: 'on_hold', label: 'On Hold' },
]

export default function ProjectEditPage({ params }: ProjectEditPageProps) {
    const { projectId } = use(params)
    const router = useRouter()

    const [project, setProject] = useState<ProjectDetail | null>(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
    const [deleteConfirmText, setDeleteConfirmText] = useState('')
    const [deleting, setDeleting] = useState(false)

    // Form state
    const [name, setName] = useState('')
    const [description, setDescription] = useState('')
    const [location, setLocation] = useState('')
    const [status, setStatus] = useState<ProjectStatus>('planning')
    const [totalBudget, setTotalBudget] = useState('')
    const [plannedStartDate, setPlannedStartDate] = useState('')
    const [plannedEndDate, setPlannedEndDate] = useState('')

    useEffect(() => {
        const loadData = async () => {
            setLoading(true)
            try {
                const proj = await getProject(projectId)
                setProject(proj)

                // Populate form
                setName(proj.name)
                setDescription(proj.description || '')
                setLocation(proj.location || '')
                setStatus(proj.status)
                setTotalBudget(String(proj.total_budget))
                setPlannedStartDate(proj.planned_start_date ? proj.planned_start_date.split('T')[0] : '')
                setPlannedEndDate(proj.planned_end_date ? proj.planned_end_date.split('T')[0] : '')
            } catch (error) {
                toast.error('Failed to load project')
                router.push(`/dashboard/${projectId}`)
            } finally {
                setLoading(false)
            }
        }

        loadData()
    }, [projectId, router])

    const handleSave = async () => {
        if (!name.trim()) {
            toast.error('Project name is required')
            return
        }

        if (!location.trim()) {
            toast.error('Location is required')
            return
        }

        const budget = parseFloat(totalBudget)
        if (isNaN(budget) || budget < 0) {
            toast.error('Please enter a valid budget')
            return
        }

        setSaving(true)
        try {
            await updateProject(projectId, {
                name: name.trim(),
                description: description.trim() || undefined,
                location: location.trim(),
                status,
                total_budget: budget,
                planned_start_date: plannedStartDate ? `${plannedStartDate}T00:00:00` : undefined,
                planned_end_date: plannedEndDate ? `${plannedEndDate}T00:00:00` : undefined,
            })

            toast.success('Project updated successfully')
            router.push(`/dashboard/${projectId}`)
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to update project')
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async () => {
        if (deleteConfirmText !== project?.name) {
            toast.error('Project name does not match')
            return
        }

        setDeleting(true)
        try {
            await deleteProject(projectId)
            toast.success('Project deleted successfully')
            router.push('/dashboard')
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to delete project')
            setDeleting(false)
        }
    }

    if (loading) {
        return (
            <div className="flex justify-center py-24">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    if (!project) return null

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Link href={`/dashboard/${projectId}`}>
                    <Button variant="outline" size="icon">
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-3xl font-bold">Edit Project</h1>
                    <p className="text-muted-foreground">Update project details and settings</p>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Project Information</CardTitle>
                    <CardDescription>
                        Update the basic information about your construction project
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid gap-6 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="name">Project Name *</Label>
                            <Input
                                id="name"
                                placeholder="Enter project name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="status">Status *</Label>
                            <Select value={status} onValueChange={(v) => setStatus(v as ProjectStatus)}>
                                <SelectTrigger id="status">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {PROJECT_STATUSES.map((s) => (
                                        <SelectItem key={s.value} value={s.value}>
                                            {s.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="description">Description</Label>
                        <Textarea
                            id="description"
                            placeholder="Enter project description"
                            rows={4}
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                        />
                    </div>

                    <div className="grid gap-6 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="location">Location *</Label>
                            <Input
                                id="location"
                                placeholder="Enter project location"
                                value={location}
                                onChange={(e) => setLocation(e.target.value)}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="totalBudget">Total Budget (ETB) *</Label>
                            <Input
                                id="totalBudget"
                                type="number"
                                min={0}
                                step={0.01}
                                placeholder="0.00"
                                value={totalBudget}
                                onChange={(e) => setTotalBudget(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="grid gap-6 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="plannedStartDate">Planned Start Date</Label>
                            <Input
                                id="plannedStartDate"
                                type="date"
                                value={plannedStartDate}
                                onChange={(e) => setPlannedStartDate(e.target.value)}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="plannedEndDate">Planned End Date</Label>
                            <Input
                                id="plannedEndDate"
                                type="date"
                                value={plannedEndDate}
                                onChange={(e) => setPlannedEndDate(e.target.value)}
                            />
                        </div>
                    </div>

                    {project.client && (
                        <div className="rounded-lg border border-border bg-muted/30 p-4">
                            <Label className="text-sm font-medium">Client Information</Label>
                            <div className="mt-2 space-y-1">
                                <p className="text-sm">
                                    <span className="font-medium">Name:</span> {project.client.name}
                                </p>
                                {project.client.contact_email && (
                                    <p className="text-sm">
                                        <span className="font-medium">Email:</span> {project.client.contact_email}
                                    </p>
                                )}
                            </div>
                            <p className="mt-2 text-xs text-muted-foreground">
                                Client information cannot be changed after project creation. Manage clients in the Stakeholders section.
                            </p>
                        </div>
                    )}

                    <div className="flex justify-end gap-3 pt-4">
                        <Button
                            variant="outline"
                            onClick={() => router.push(`/dashboard/${projectId}`)}
                            disabled={saving}
                        >
                            Cancel
                        </Button>
                        <Button onClick={handleSave} disabled={saving} className="gap-2">
                            {saving ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <Save className="h-4 w-4" />
                                    Save Changes
                                </>
                            )}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <Card className="border-destructive/50">
                <CardHeader>
                    <CardTitle className="text-destructive">Danger Zone</CardTitle>
                    <CardDescription>
                        Irreversible actions that affect this project
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-between rounded-lg border border-destructive/50 bg-destructive/5 p-4">
                        <div>
                            <p className="font-medium">Delete Project</p>
                            <p className="text-sm text-muted-foreground">
                                Permanently delete this project and all associated data
                            </p>
                        </div>
                        <Button
                            variant="destructive"
                            onClick={() => setDeleteDialogOpen(true)}
                            className="gap-2"
                        >
                            <Trash2 className="h-4 w-4" />
                            Delete Project
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Delete Confirmation Dialog */}
            <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-destructive">
                            <AlertTriangle className="h-5 w-5" />
                            Delete Project
                        </DialogTitle>
                        <DialogDescription>
                            This action cannot be undone. This will permanently delete the project and all associated data including tasks, logs, budget records, and team assignments.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4">
                            <p className="text-sm font-medium mb-2">Please type <span className="font-mono font-bold">{project?.name}</span> to confirm:</p>
                            <Input
                                placeholder="Type project name here"
                                value={deleteConfirmText}
                                onChange={(e) => setDeleteConfirmText(e.target.value)}
                                className="font-mono"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setDeleteDialogOpen(false)
                                setDeleteConfirmText('')
                            }}
                            disabled={deleting}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleDelete}
                            disabled={deleting || deleteConfirmText !== project?.name}
                            className="gap-2"
                        >
                            {deleting ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Deleting...
                                </>
                            ) : (
                                <>
                                    <Trash2 className="h-4 w-4" />
                                    Delete Project
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
