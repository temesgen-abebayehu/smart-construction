'use client'

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ArrowLeft, Loader2, Save } from 'lucide-react'
import { getLog, updateDailyLog } from '@/lib/api'
import type { LogDetailResponse } from '@/lib/api-types'
import { toast } from 'sonner'

interface EditLogPageProps {
    params: Promise<{ projectId: string; logId: string }>
}

export default function EditLogPage({ params }: EditLogPageProps) {
    const { projectId, logId } = use(params)
    const router = useRouter()

    const [log, setLog] = useState<LogDetailResponse | null>(null)
    const [notes, setNotes] = useState('')
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        const loadLog = async () => {
            setLoading(true)
            try {
                const logData = await getLog(logId)
                setLog(logData)
                setNotes(logData.notes || '')
            } catch (e) {
                toast.error('Failed to load log')
                router.back()
            } finally {
                setLoading(false)
            }
        }
        loadLog()
    }, [logId, router])

    const handleSave = async () => {
        if (!log) return

        // Only allow editing draft or rejected logs
        if (log.status !== 'draft' && log.status !== 'rejected') {
            toast.error('Only draft or rejected logs can be edited')
            return
        }

        setSaving(true)
        try {
            await updateDailyLog(logId, {
                notes: notes.trim() || undefined,
            })
            toast.success('Log updated successfully')
            router.push(`/dashboard/${projectId}/logs/${logId}`)
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Failed to update log')
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

    if (!log) {
        return null
    }

    // Check if log can be edited
    if (log.status !== 'draft' && log.status !== 'rejected') {
        return (
            <div className="space-y-6">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => router.back()}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold">Cannot Edit Log</h1>
                        <p className="text-sm text-muted-foreground">Only draft or rejected logs can be edited</p>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6 pb-12">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div>
                    <h1 className="text-2xl font-bold">Edit Daily Log</h1>
                    <p className="text-sm text-muted-foreground">
                        Status: <span className="font-medium capitalize">{log.status}</span>
                        {log.rejection_reason && ` - ${log.rejection_reason}`}
                    </p>
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Log Details</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>Notes / Remarks</Label>
                                <Textarea
                                    placeholder="Additional notes, issues, or observations..."
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    rows={5}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Weather</Label>
                                <Input value={log.weather || 'N/A'} disabled />
                            </div>

                            <div className="space-y-2">
                                <Label>Date</Label>
                                <Input value={new Date(log.date).toLocaleDateString()} disabled />
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Note</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground">
                                Currently, only notes can be edited. To modify human resources, materials, or equipment,
                                please contact your project manager or create a new log.
                            </p>
                        </CardContent>
                    </Card>
                </div>

                {/* Sidebar */}
                <div className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Actions</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            <Button
                                onClick={handleSave}
                                disabled={saving}
                                className="w-full"
                            >
                                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                Save Changes
                            </Button>
                            <Button
                                variant="outline"
                                onClick={() => router.back()}
                                disabled={saving}
                                className="w-full"
                            >
                                Cancel
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
