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
import { ArrowLeft, Loader2, Save } from 'lucide-react'
import { getProject, updateProject, listClients } from '@/lib/api'
import type { ProjectDetail, ClientListItem } from '@/lib/api-types'
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
    const [clients, setClients] = useState<ClientListItem[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)

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
                const [proj, clientsRes] = await Promise.all([
                    getProject(projectId),
                    listClients(),
                ])

                setProject(proj)
                setClients(clientsRes.data)

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
                            onClick={() => {
                                toast.error('Project deletion is not yet implemented')
                            }}
                        >
                            Delete Project
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
