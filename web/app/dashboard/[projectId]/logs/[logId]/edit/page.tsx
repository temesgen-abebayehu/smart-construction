'use client'

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
    Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
    getLog, updateDailyLog,
    listLogManpower, listLogMaterials, listLogEquipment, listLogPhotos,
    addLogManpower, addLogMaterial, addLogEquipment, deleteLogPhoto,
    deleteLogManpower, updateLogManpower,
    deleteLogMaterial, updateLogMaterial,
    deleteLogEquipment, updateLogEquipment,
    listLogCompletedActivities, addLogCompletedActivity, removeLogCompletedActivity,
    listTaskActivities, getTask, listSuppliers,
} from '@/lib/api'
import { getApiBaseUrl } from '@/lib/api-client'
import { getAccessToken } from '@/lib/auth-storage'
import type { LogDetailResponse, DailyLogPhoto, TaskListItem, TaskActivityItem, SupplierItem } from '@/lib/api-types'
import {
    ArrowLeft, CheckCircle2, Image as ImageIcon, Loader2, Package, Pencil, Plus, Save, Trash2, Truck, Upload, Users,
} from 'lucide-react'
import { toast } from 'sonner'

interface EditLogPageProps {
    params: Promise<{ projectId: string; logId: string }>
}

type LaborEntry = { id: string; worker_type: string; number_of_workers: number; hours_worked: number; overtime_hours: number; hourly_rate: number; overtime_rate: number; cost: number }
type MaterialEntry = { id: string; name: string; supplier_id?: string | null; supplier_name?: string | null; quantity: number; unit: string; unit_cost: number; cost: number; delivery_date?: string | null }
type EquipmentEntry = { id: string; name: string; quantity: number; start_date?: string | null; hours_used: number; unit_cost: number; cost: number; idle_hours: number; idle_reason?: string | null }

const statusConfig: Record<string, { label: string; className: string }> = {
    draft: { label: 'Draft', className: 'bg-gray-100 text-gray-700' },
    submitted: { label: 'Submitted', className: 'bg-amber-100 text-amber-700' },
    consultant_approved: { label: 'Consultant Approved', className: 'bg-indigo-100 text-indigo-700' },
    pm_approved: { label: 'Approved', className: 'bg-green-100 text-green-700' },
    rejected: { label: 'Rejected', className: 'bg-red-100 text-red-700' },
}

export default function EditLogPage({ params }: EditLogPageProps) {
    const { projectId, logId } = use(params)
    const router = useRouter()

    const [log, setLog] = useState<LogDetailResponse | null>(null)
    const [notes, setNotes] = useState('')
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)

    const [labor, setLabor] = useState<LaborEntry[]>([])
    const [materials, setMaterials] = useState<MaterialEntry[]>([])
    const [equipment, setEquipment] = useState<EquipmentEntry[]>([])
    const [photos, setPhotos] = useState<DailyLogPhoto[]>([])
    const [suppliers, setSuppliers] = useState<SupplierItem[]>([])

    const [task, setTask] = useState<TaskListItem | null>(null)
    const [availableActivities, setAvailableActivities] = useState<TaskActivityItem[]>([])
    const [completedActivityIds, setCompletedActivityIds] = useState<Set<string>>(new Set())

    const [addType, setAddType] = useState<'labor' | 'material' | 'equipment' | null>(null)
    const [addingEntry, setAddingEntry] = useState(false)

    const [hrForm, setHrForm] = useState({ labor_type: '', worker_count: '1', hours_worked: '8', overtime_hours: '0', hourly_rate: '', overtime_rate: '' })
    const [matForm, setMatForm] = useState({ supplier_id: '', material_type: '', quantity: '', unit: 'bags', unit_cost: '', delivery_date: new Date().toISOString().split('T')[0] })
    const [eqForm, setEqForm] = useState({ type: '', quantity: '1', start_time: '08:00', operation_time: '', cost_per_unit: '', idle_hours: '0', idle_reason: '' })

    const [uploadingPhoto, setUploadingPhoto] = useState(false)
    const [deletingPhotoId, setDeletingPhotoId] = useState<string | null>(null)

    // Delete / Edit state for sub-entries
    const [deletingEntryId, setDeletingEntryId] = useState<string | null>(null)
    const [savingEdit, setSavingEdit] = useState(false)
    const [editDialog, setEditDialog] = useState<{ type: 'labor' | 'material' | 'equipment'; id: string } | null>(null)
    const [editHrForm, setEditHrForm] = useState({ labor_type: '', worker_count: '1', hours_worked: '8', overtime_hours: '0', hourly_rate: '', overtime_rate: '' })
    const [editMatForm, setEditMatForm] = useState({ supplier_id: '', material_type: '', quantity: '', unit: 'bags', unit_cost: '', delivery_date: '' })
    const [editEqForm, setEditEqForm] = useState({ type: '', quantity: '1', start_time: '08:00', operation_time: '', cost_per_unit: '', idle_hours: '0', idle_reason: '' })

    const loadAll = async () => {
        setLoading(true)
        try {
            const [logData, laborData, matData, eqData, photoData] = await Promise.all([
                getLog(logId),
                listLogManpower(logId).catch(() => []),
                listLogMaterials(logId).catch(() => []),
                listLogEquipment(logId).catch(() => []),
                listLogPhotos(logId).catch(() => []),
            ])
            setLog(logData)
            setNotes(logData.notes || '')
            setLabor(laborData)
            setMaterials(matData)
            setEquipment(eqData)
            setPhotos(photoData)

            try {
                const suppliersData = await listSuppliers(projectId, { limit: 100 })
                setSuppliers(suppliersData)
            } catch { setSuppliers([]) }

            if (logData.task_id) {
                try {
                    const [taskData, acts, completedActs] = await Promise.all([
                        getTask(logData.task_id),
                        listTaskActivities(logData.task_id),
                        listLogCompletedActivities(logId),
                    ])
                    setTask(taskData)
                    setAvailableActivities(acts)
                    setCompletedActivityIds(new Set((completedActs as any[]).map(a => a.task_activity_id)))
                } catch { setTask(null); setAvailableActivities([]); setCompletedActivityIds(new Set()) }
            }
        } catch {
            toast.error('Failed to load log')
            router.back()
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { loadAll() }, [logId])

    const calcHrCost = () => {
        const wc = Number(hrForm.worker_count) || 0
        const hw = Number(hrForm.hours_worked) || 0
        const hr = Number(hrForm.hourly_rate) || 0
        const oh = Number(hrForm.overtime_hours) || 0
        const or_ = Number(hrForm.overtime_rate) || (hr * 1.5)
        return (wc * hw * hr) + (wc * oh * or_)
    }
    const calcMatCost = () => (Number(matForm.quantity) || 0) * (Number(matForm.unit_cost) || 0)
    const calcEqCost = () => (Number(eqForm.operation_time) || 0) * (Number(eqForm.cost_per_unit) || 0)

    const handleAddEntry = async () => {
        if (!addType) return
        setAddingEntry(true)
        try {
            if (addType === 'labor') {
                if (!hrForm.labor_type.trim() || !hrForm.hourly_rate) { toast.error('Labor type and hourly rate are required'); return }
                const workerCount = Number(hrForm.worker_count) || 1
                const hoursWorked = Number(hrForm.hours_worked) || 0
                const overtimeHours = Number(hrForm.overtime_hours) || 0
                const hourlyRate = Number(hrForm.hourly_rate)
                const overtimeRate = Number(hrForm.overtime_rate) || (hourlyRate * 1.5)
                await addLogManpower(logId, {
                    worker_type: hrForm.labor_type.trim(),
                    number_of_workers: workerCount,
                    hours_worked: hoursWorked,
                    overtime_hours: overtimeHours,
                    hourly_rate: hourlyRate,
                    overtime_rate: overtimeRate,
                    cost: calcHrCost(),
                })
                setHrForm({ labor_type: '', worker_count: '1', hours_worked: '8', overtime_hours: '0', hourly_rate: '', overtime_rate: '' })
            } else if (addType === 'material') {
                if (!matForm.material_type.trim() || !matForm.quantity || !matForm.unit_cost) { toast.error('Material type, quantity and unit cost are required'); return }
                const supplierObj = matForm.supplier_id ? suppliers.find(s => s.id === matForm.supplier_id) : null
                const unitCost = Number(matForm.unit_cost)
                await addLogMaterial(logId, {
                    name: matForm.material_type.trim(),
                    supplier_id: matForm.supplier_id || undefined,
                    supplier_name: supplierObj?.name || undefined,
                    quantity: Number(matForm.quantity),
                    unit: matForm.unit,
                    unit_cost: unitCost,
                    cost: calcMatCost(),
                    delivery_date: matForm.delivery_date || undefined,
                })
                setMatForm({ supplier_id: '', material_type: '', quantity: '', unit: 'bags', unit_cost: '', delivery_date: new Date().toISOString().split('T')[0] })
            } else if (addType === 'equipment') {
                if (!eqForm.type.trim() || !eqForm.operation_time || !eqForm.cost_per_unit) { toast.error('Equipment type, operation time and cost are required'); return }
                const unitCost = Number(eqForm.cost_per_unit)
                const startDate = eqForm.start_time ? `${new Date().toISOString().split('T')[0]}T${eqForm.start_time}:00Z` : undefined
                await addLogEquipment(logId, {
                    name: eqForm.type.trim(),
                    quantity: Number(eqForm.quantity) || 1,
                    start_date: startDate,
                    hours_used: Number(eqForm.operation_time),
                    unit_cost: unitCost,
                    cost: calcEqCost(),
                    idle_hours: Number(eqForm.idle_hours) || 0,
                    idle_reason: eqForm.idle_reason.trim() || undefined,
                })
                setEqForm({ type: '', quantity: '1', start_time: '08:00', operation_time: '', cost_per_unit: '', idle_hours: '0', idle_reason: '' })
            }
            setAddType(null)
            await loadAll()
            toast.success('Entry added')
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Failed to add entry')
        } finally {
            setAddingEntry(false)
        }
    }

    const openEditDialog = (type: 'labor' | 'material' | 'equipment', id: string) => {
        if (type === 'labor') {
            const entry = labor.find(l => l.id === id)
            if (!entry) return
            setEditHrForm({
                labor_type: entry.worker_type,
                worker_count: String(entry.number_of_workers),
                hours_worked: String(entry.hours_worked),
                overtime_hours: String(entry.overtime_hours),
                hourly_rate: String(entry.hourly_rate),
                overtime_rate: String(entry.overtime_rate),
            })
        } else if (type === 'material') {
            const entry = materials.find(m => m.id === id)
            if (!entry) return
            setEditMatForm({
                supplier_id: entry.supplier_id ?? '',
                material_type: entry.name,
                quantity: String(entry.quantity),
                unit: entry.unit,
                unit_cost: String(entry.unit_cost),
                delivery_date: entry.delivery_date ? entry.delivery_date.split('T')[0] : '',
            })
        } else {
            const entry = equipment.find(e => e.id === id)
            if (!entry) return
            setEditEqForm({
                type: entry.name,
                quantity: String(entry.quantity),
                start_time: entry.start_date ? new Date(entry.start_date).toTimeString().slice(0, 5) : '08:00',
                operation_time: String(entry.hours_used),
                cost_per_unit: String(entry.unit_cost),
                idle_hours: String(entry.idle_hours),
                idle_reason: entry.idle_reason ?? '',
            })
        }
        setEditDialog({ type, id })
    }

    const handleDeleteEntry = async (type: 'labor' | 'material' | 'equipment', id: string) => {
        if (!confirm('Delete this entry?')) return
        setDeletingEntryId(id)
        try {
            if (type === 'labor') await deleteLogManpower(id)
            else if (type === 'material') await deleteLogMaterial(id)
            else await deleteLogEquipment(id)
            await loadAll()
            toast.success('Entry deleted')
        } catch { toast.error('Failed to delete entry') }
        finally { setDeletingEntryId(null) }
    }

    const handleSaveEdit = async () => {
        if (!editDialog) return
        setSavingEdit(true)
        try {
            if (editDialog.type === 'labor') {
                const wc = Number(editHrForm.worker_count) || 1
                const hw = Number(editHrForm.hours_worked) || 0
                const hr = Number(editHrForm.hourly_rate) || 0
                const oh = Number(editHrForm.overtime_hours) || 0
                const or_ = Number(editHrForm.overtime_rate) || (hr * 1.5)
                await updateLogManpower(editDialog.id, {
                    worker_type: editHrForm.labor_type.trim(),
                    number_of_workers: wc, hours_worked: hw,
                    overtime_hours: oh, hourly_rate: hr,
                    overtime_rate: or_, cost: (wc * hw * hr) + (wc * oh * or_),
                })
            } else if (editDialog.type === 'material') {
                const supplierObj = editMatForm.supplier_id ? suppliers.find(s => s.id === editMatForm.supplier_id) : null
                const qty = Number(editMatForm.quantity) || 0
                const uc = Number(editMatForm.unit_cost) || 0
                await updateLogMaterial(editDialog.id, {
                    name: editMatForm.material_type.trim(),
                    supplier_id: editMatForm.supplier_id || undefined,
                    supplier_name: supplierObj?.name || undefined,
                    quantity: qty, unit: editMatForm.unit,
                    unit_cost: uc, cost: qty * uc,
                    delivery_date: editMatForm.delivery_date || undefined,
                })
            } else {
                const qty = Number(editEqForm.quantity) || 1
                const ot = Number(editEqForm.operation_time) || 0
                const cpu = Number(editEqForm.cost_per_unit) || 0
                const startDate = editEqForm.start_time ? `${new Date().toISOString().split('T')[0]}T${editEqForm.start_time}:00Z` : undefined
                await updateLogEquipment(editDialog.id, {
                    name: editEqForm.type.trim(), quantity: qty,
                    start_date: startDate, hours_used: ot,
                    unit_cost: cpu, cost: ot * cpu,
                    idle_hours: Number(editEqForm.idle_hours) || 0,
                    idle_reason: editEqForm.idle_reason.trim() || undefined,
                })
            }
            setEditDialog(null)
            await loadAll()
            toast.success('Entry updated')
        } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed to update entry') }
        finally { setSavingEdit(false) }
    }

    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) { toast.error('Invalid file type'); return }
        if (file.size > 10 * 1024 * 1024) { toast.error('File too large. Max 10 MB'); return }
        setUploadingPhoto(true)
        try {
            const fd = new FormData()
            fd.append('file', file)
            await fetch(`${getApiBaseUrl()}/daily-logs/${logId}/photos`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${getAccessToken() ?? ''}` },
                body: fd,
            })
            await loadAll()
            toast.success('Photo uploaded')
        } catch { toast.error('Failed to upload photo') }
        finally { setUploadingPhoto(false); e.target.value = '' }
    }

    const handlePhotoDelete = async (photoId: string) => {
        if (!confirm('Delete this photo?')) return
        setDeletingPhotoId(photoId)
        try { await deleteLogPhoto(logId, photoId); await loadAll(); toast.success('Photo deleted') }
        catch { toast.error('Failed to delete photo') }
        finally { setDeletingPhotoId(null) }
    }

    const handleSave = async () => {
        if (!log) return
        setSaving(true)
        try {
            await updateDailyLog(logId, { notes: notes.trim() || undefined })
            if (log.status === 'rejected') {
                sessionStorage.setItem(`log_edited_${logId}`, '1')
            }
            toast.success('Log updated successfully')
            router.push(`/dashboard/${projectId}/logs/${logId}`)
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Failed to update log')
        } finally { setSaving(false) }
    }

    if (loading) return <div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
    if (!log) return null

    if (log.status !== 'draft' && log.status !== 'rejected') {
        return (
            <div className="space-y-6">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => router.back()}><ArrowLeft className="h-5 w-5" /></Button>
                    <div>
                        <h1 className="text-2xl font-bold">Cannot Edit Log</h1>
                        <p className="text-sm text-muted-foreground">Only draft or rejected logs can be edited</p>
                    </div>
                </div>
            </div>
        )
    }

    const totalLaborCost = labor.reduce((s, l) => s + l.cost, 0)
    const totalMaterialCost = materials.reduce((s, m) => s + m.cost, 0)
    const totalEquipmentCost = equipment.reduce((s, e) => s + e.cost, 0)

    return (
        <div className="space-y-6 pb-12">
            <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" onClick={() => router.back()}><ArrowLeft className="h-5 w-5" /></Button>
                    <div>
                        <h1 className="text-2xl font-bold">Edit Daily Log</h1>
                        <p className="text-sm text-muted-foreground">
                            {new Date(log.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                    </div>
                </div>
                <Badge className={statusConfig[log.status]?.className ?? ''}>{statusConfig[log.status]?.label ?? log.status}</Badge>
            </div>

            {log.status === 'rejected' && log.rejection_reason && (
                <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 p-3 text-sm text-red-700 dark:text-red-400">
                    <strong>Rejection reason:</strong> {log.rejection_reason}
                </div>
            )}

            <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
                <div className="space-y-6">

                    {/* Notes */}
                    <Card>
                        <CardHeader><CardTitle className="text-base">Notes &amp; Weather</CardTitle></CardHeader>
                        <CardContent className="space-y-3">
                            <div className="space-y-1.5">
                                <Label>Notes / Remarks</Label>
                                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} placeholder="Additional notes, issues, or observations..." />
                            </div>
                            <div className="space-y-1.5">
                                <Label>Weather</Label>
                                <Input value={log.weather || 'N/A'} disabled />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Human Resources */}
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4" />Human Resources ({labor.length})</CardTitle>
                            <Button variant="outline" size="sm" className="gap-1" onClick={() => setAddType('labor')}><Plus className="h-3.5 w-3.5" />Add</Button>
                        </CardHeader>
                        <CardContent>
                            {labor.length === 0 ? <p className="text-sm text-muted-foreground">No labor records.</p> : (
                                <div className="space-y-2">
                                    {labor.map((l) => (
                                        <div key={l.id} className="rounded border p-3 text-sm space-y-1">
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="font-medium capitalize">{l.worker_type}</span>
                                                <div className="flex items-center gap-1">
                                                    <span className="font-medium mr-1">ETB {l.cost.toLocaleString()}</span>
                                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditDialog('labor', l.id)}><Pencil className="h-3.5 w-3.5" /></Button>
                                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" disabled={deletingEntryId === l.id} onClick={() => handleDeleteEntry('labor', l.id)}>{deletingEntryId === l.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}</Button>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-x-4 text-xs text-muted-foreground">
                                                <div>No. of Workers: {l.number_of_workers}</div>
                                                <div>Hourly Rate: ETB {l.hourly_rate.toLocaleString()}</div>
                                                <div>Regular Hours: {l.hours_worked}h</div>
                                                <div>Overtime Hours: {l.overtime_hours}h</div>
                                                {l.overtime_hours > 0 && <div className="col-span-2">Overtime Rate: ETB {l.overtime_rate.toLocaleString()}/hr</div>}
                                            </div>
                                        </div>
                                    ))}
                                    <p className="text-right text-sm font-medium pt-2 border-t">Total: ETB {totalLaborCost.toLocaleString()}</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Materials */}
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle className="text-base flex items-center gap-2"><Package className="h-4 w-4" />Materials ({materials.length})</CardTitle>
                            <Button variant="outline" size="sm" className="gap-1" onClick={() => setAddType('material')}><Plus className="h-3.5 w-3.5" />Add</Button>
                        </CardHeader>
                        <CardContent>
                            {materials.length === 0 ? <p className="text-sm text-muted-foreground">No materials recorded.</p> : (
                                <div className="space-y-2">
                                    {materials.map((m) => {
                                        const supplier = m.supplier_id ? suppliers.find(s => s.id === m.supplier_id) : null
                                        return (
                                            <div key={m.id} className="rounded border p-3 text-sm space-y-1">
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className="font-medium">{m.name}</span>
                                                    <div className="flex items-center gap-1">
                                                        <span className="font-medium mr-1">ETB {m.cost.toLocaleString()}</span>
                                                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditDialog('material', m.id)}><Pencil className="h-3.5 w-3.5" /></Button>
                                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" disabled={deletingEntryId === m.id} onClick={() => handleDeleteEntry('material', m.id)}>{deletingEntryId === m.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}</Button>
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-2 gap-x-4 text-xs text-muted-foreground">
                                                    {supplier && (
                                                        <div className="col-span-2">
                                                            Supplier: {supplier.name} {supplier.role ? `(${supplier.role})` : ''}
                                                        </div>
                                                    )}
                                                    <div>Quantity: {m.quantity} {m.unit}</div>
                                                    <div>Unit Cost: ETB {m.unit_cost.toLocaleString()}</div>
                                                    {m.delivery_date && (
                                                        <div className="col-span-2">
                                                            Delivery: {new Date(m.delivery_date).toLocaleDateString()}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )
                                    })}
                                    <p className="text-right text-sm font-medium pt-2 border-t">Total: ETB {totalMaterialCost.toLocaleString()}</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Equipment */}
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle className="text-base flex items-center gap-2"><Truck className="h-4 w-4" />Equipment ({equipment.length})</CardTitle>
                            <Button variant="outline" size="sm" className="gap-1" onClick={() => setAddType('equipment')}><Plus className="h-3.5 w-3.5" />Add</Button>
                        </CardHeader>
                        <CardContent>
                            {equipment.length === 0 ? <p className="text-sm text-muted-foreground">No equipment recorded.</p> : (
                                <div className="space-y-2">
                                    {equipment.map((e) => (
                                        <div key={e.id} className="rounded border p-3 text-sm space-y-1">
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="font-medium">{e.name}</span>
                                                <div className="flex items-center gap-1">
                                                    <span className="font-medium mr-1">ETB {e.cost.toLocaleString()}</span>
                                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditDialog('equipment', e.id)}><Pencil className="h-3.5 w-3.5" /></Button>
                                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" disabled={deletingEntryId === e.id} onClick={() => handleDeleteEntry('equipment', e.id)}>{deletingEntryId === e.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}</Button>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-x-4 text-xs text-muted-foreground">
                                                <div>Quantity: {e.quantity}</div>
                                                {e.start_date && (
                                                    <div>Start: {new Date(e.start_date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</div>
                                                )}
                                                <div>Hours/Trip: {e.hours_used}h</div>
                                                <div>Unit Cost: ETB {e.unit_cost.toLocaleString()}</div>
                                                {e.idle_hours > 0 && (
                                                    <>
                                                        <div className="col-span-2 text-amber-600">Idle Hours: {e.idle_hours}h</div>
                                                        {e.idle_reason && <div className="col-span-2 text-amber-600">Reason: {e.idle_reason}</div>}
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                    <p className="text-right text-sm font-medium pt-2 border-t">Total: ETB {totalEquipmentCost.toLocaleString()}</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Photos */}
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle className="text-base flex items-center gap-2"><ImageIcon className="h-4 w-4" />Photos ({photos.length})</CardTitle>
                            <div>
                                <input type="file" accept="image/*" onChange={handlePhotoUpload} disabled={uploadingPhoto} className="hidden" id="edit-photo-upload" />
                                <label htmlFor="edit-photo-upload">
                                    <Button variant="outline" size="sm" className="gap-1" disabled={uploadingPhoto} asChild>
                                        <span>
                                            {uploadingPhoto ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                                            {uploadingPhoto ? 'Uploading…' : 'Upload'}
                                        </span>
                                    </Button>
                                </label>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {photos.length === 0 ? <p className="text-sm text-muted-foreground">No photos attached.</p> : (
                                <div className="grid grid-cols-2 gap-3">
                                    {photos.map((photo) => (
                                        <div key={photo.id} className="relative group rounded-lg overflow-hidden border">
                                            <img src={photo.url_path} alt={photo.original_filename || 'Log photo'} className="w-full h-32 object-cover" />
                                            <Button
                                                variant="destructive" size="icon"
                                                className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                                                onClick={() => handlePhotoDelete(photo.id)}
                                                disabled={deletingPhotoId === photo.id}
                                            >
                                                {deletingPhotoId === photo.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                                            </Button>
                                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                                                <p className="text-xs text-white truncate">{photo.original_filename || 'Photo'}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Activities grouped by task */}
                    {task && availableActivities.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base flex items-center gap-2"><CheckCircle2 className="h-4 w-4" />Activities</CardTitle>
                                <p className="text-sm text-muted-foreground">{completedActivityIds.size} completed in this log</p>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{task.title}</p>
                                <div className="space-y-1">
                                    {availableActivities.map((activity) => {
                                        const isCompleted = completedActivityIds.has(activity.id)
                                        return (
                                            <div key={activity.id} className="flex items-center justify-between rounded-lg border p-2.5">
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <button
                                                        type="button"
                                                        className={`grid h-5 w-5 shrink-0 place-items-center rounded border transition-colors ${isCompleted ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300 hover:border-emerald-400'}`}
                                                        onClick={async () => {
                                                            try {
                                                                if (isCompleted) {
                                                                    await removeLogCompletedActivity(logId, activity.id)
                                                                    setCompletedActivityIds(prev => { const n = new Set(prev); n.delete(activity.id); return n })
                                                                    toast.success('Activity unmarked')
                                                                } else {
                                                                    await addLogCompletedActivity(logId, activity.id)
                                                                    setCompletedActivityIds(prev => new Set(prev).add(activity.id))
                                                                    toast.success('Activity marked complete')
                                                                }
                                                            } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed to update') }
                                                        }}
                                                    >
                                                        {isCompleted && <CheckCircle2 className="h-3 w-3" />}
                                                    </button>
                                                    <span className={`text-sm truncate ${isCompleted ? 'font-medium' : ''}`}>{activity.name}</span>
                                                </div>
                                                <Badge variant="outline" className="text-[10px] shrink-0">{activity.percentage}%</Badge>
                                            </div>
                                        )
                                    })}
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>

                {/* Sidebar */}
                <div className="space-y-4">
                    <Card>
                        <CardHeader><CardTitle className="text-base">Save Changes</CardTitle></CardHeader>
                        <CardContent className="space-y-2">
                            <Button onClick={handleSave} disabled={saving} className="w-full gap-2">
                                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                Save &amp; Return
                            </Button>
                            <Button variant="outline" onClick={() => router.back()} disabled={saving} className="w-full">Cancel</Button>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader><CardTitle className="text-base">Log Info</CardTitle></CardHeader>
                        <CardContent className="space-y-3 text-sm">
                            <div><p className="text-xs text-muted-foreground">Date</p><p className="font-medium">{new Date(log.date).toLocaleDateString()}</p></div>
                            <div><p className="text-xs text-muted-foreground">Weather</p><p className="font-medium">{log.weather || 'N/A'}</p></div>
                            <div>
                                <p className="text-xs text-muted-foreground">Cost Summary</p>
                                <p className="text-xs">Labor: ETB {totalLaborCost.toLocaleString()}</p>
                                <p className="text-xs">Materials: ETB {totalMaterialCost.toLocaleString()}</p>
                                <p className="text-xs">Equipment: ETB {totalEquipmentCost.toLocaleString()}</p>
                                <p className="mt-1 font-semibold">Total: ETB {(totalLaborCost + totalMaterialCost + totalEquipmentCost).toLocaleString()}</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Add Entry Dialog */}
            <Dialog open={!!addType} onOpenChange={(open) => { if (!open) setAddType(null) }}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>
                            {addType === 'labor' && 'Add Human Resource'}
                            {addType === 'material' && 'Add Material'}
                            {addType === 'equipment' && 'Add Equipment'}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-3 py-2">
                        {addType === 'labor' && (
                            <>
                                <div className="space-y-1.5">
                                    <Label>Labor Type *</Label>
                                    <Input placeholder="e.g. Mason, Carpenter, Laborer" value={hrForm.labor_type} onChange={(e) => setHrForm(p => ({ ...p, labor_type: e.target.value }))} />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1.5"><Label>Worker Count</Label><Input type="number" min="1" value={hrForm.worker_count} onChange={(e) => setHrForm(p => ({ ...p, worker_count: e.target.value }))} /></div>
                                    <div className="space-y-1.5"><Label>Hourly Rate (ETB) *</Label><Input type="number" step="0.01" placeholder="Rate/hr" value={hrForm.hourly_rate} onChange={(e) => setHrForm(p => ({ ...p, hourly_rate: e.target.value }))} /></div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1.5"><Label>Regular Hours</Label><Input type="number" step="0.5" value={hrForm.hours_worked} onChange={(e) => setHrForm(p => ({ ...p, hours_worked: e.target.value }))} /></div>
                                    <div className="space-y-1.5"><Label>Overtime Hours</Label><Input type="number" step="0.5" value={hrForm.overtime_hours} onChange={(e) => setHrForm(p => ({ ...p, overtime_hours: e.target.value }))} /></div>
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Overtime Rate (ETB/hr, default 1.5×)</Label>
                                    <Input type="number" step="0.01" placeholder="Optional" value={hrForm.overtime_rate} onChange={(e) => setHrForm(p => ({ ...p, overtime_rate: e.target.value }))} />
                                </div>
                                {hrForm.labor_type && hrForm.hourly_rate && (
                                    <p className="text-right text-sm font-medium">Total: ETB {calcHrCost().toLocaleString()}</p>
                                )}
                            </>
                        )}

                        {addType === 'material' && (
                            <>
                                {suppliers.length > 0 && (
                                    <div className="space-y-1.5">
                                        <Label>Supplier (Optional)</Label>
                                        <Select value={matForm.supplier_id || 'none'} onValueChange={(v) => setMatForm(p => ({ ...p, supplier_id: v === 'none' ? '' : v }))}>
                                            <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none">No supplier</SelectItem>
                                                {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}
                                <div className="space-y-1.5">
                                    <Label>Material Type *</Label>
                                    <Input placeholder="e.g. Cement, Rebar, Sand" value={matForm.material_type} onChange={(e) => setMatForm(p => ({ ...p, material_type: e.target.value }))} />
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                    <div className="space-y-1.5">
                                        <Label>Quantity *</Label>
                                        <Input type="number" min="0" value={matForm.quantity} onChange={(e) => setMatForm(p => ({ ...p, quantity: e.target.value }))} />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label>Unit</Label>
                                        <Select value={matForm.unit} onValueChange={(v) => setMatForm(p => ({ ...p, unit: v }))}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                {['bags', 'kg', 'ton', 'm3', 'm2', 'm', 'pcs', 'liters'].map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label>Unit Cost (ETB) *</Label>
                                        <Input type="number" min="0" step="0.01" value={matForm.unit_cost} onChange={(e) => setMatForm(p => ({ ...p, unit_cost: e.target.value }))} />
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Delivery Date</Label>
                                    <Input type="date" value={matForm.delivery_date} onChange={(e) => setMatForm(p => ({ ...p, delivery_date: e.target.value }))} />
                                </div>
                                {matForm.quantity && matForm.unit_cost && (
                                    <p className="text-right text-sm font-medium">Total: ETB {calcMatCost().toLocaleString()}</p>
                                )}
                            </>
                        )}

                        {addType === 'equipment' && (
                            <>
                                <div className="space-y-1.5">
                                    <Label>Equipment Type *</Label>
                                    <Input placeholder="e.g. Excavator, Compactor, Crane" value={eqForm.type} onChange={(e) => setEqForm(p => ({ ...p, type: e.target.value }))} />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1.5"><Label>Operation Time (hrs) *</Label><Input type="number" min="0" step="0.5" value={eqForm.operation_time} onChange={(e) => setEqForm(p => ({ ...p, operation_time: e.target.value }))} /></div>
                                    <div className="space-y-1.5"><Label>Cost/hr (ETB) *</Label><Input type="number" min="0" step="0.01" value={eqForm.cost_per_unit} onChange={(e) => setEqForm(p => ({ ...p, cost_per_unit: e.target.value }))} /></div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1.5"><Label>Idle Hours</Label><Input type="number" min="0" step="0.5" value={eqForm.idle_hours} onChange={(e) => setEqForm(p => ({ ...p, idle_hours: e.target.value }))} /></div>
                                    <div className="space-y-1.5"><Label>Idle Reason</Label><Input placeholder="Reason for idle" value={eqForm.idle_reason} onChange={(e) => setEqForm(p => ({ ...p, idle_reason: e.target.value }))} /></div>
                                </div>
                                {eqForm.operation_time && eqForm.cost_per_unit && (
                                    <p className="text-right text-sm font-medium">Total: ETB {calcEqCost().toLocaleString()}</p>
                                )}
                            </>
                        )}
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setAddType(null)}>Cancel</Button>
                        <Button onClick={handleAddEntry} disabled={addingEntry}>
                            {addingEntry && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Add
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit Entry Dialog */}
            <Dialog open={!!editDialog} onOpenChange={(open) => { if (!open) setEditDialog(null) }}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>
                            {editDialog?.type === 'labor' && 'Edit Human Resource'}
                            {editDialog?.type === 'material' && 'Edit Material'}
                            {editDialog?.type === 'equipment' && 'Edit Equipment'}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-3 py-2">
                        {editDialog?.type === 'labor' && (
                            <>
                                <div className="space-y-1.5">
                                    <Label>Labor Type *</Label>
                                    <Input placeholder="e.g. Mason, Carpenter, Laborer" value={editHrForm.labor_type} onChange={(e) => setEditHrForm(p => ({ ...p, labor_type: e.target.value }))} />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1.5"><Label>Worker Count</Label><Input type="number" min="1" value={editHrForm.worker_count} onChange={(e) => setEditHrForm(p => ({ ...p, worker_count: e.target.value }))} /></div>
                                    <div className="space-y-1.5"><Label>Hourly Rate (ETB) *</Label><Input type="number" step="0.01" value={editHrForm.hourly_rate} onChange={(e) => setEditHrForm(p => ({ ...p, hourly_rate: e.target.value }))} /></div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1.5"><Label>Regular Hours</Label><Input type="number" step="0.5" value={editHrForm.hours_worked} onChange={(e) => setEditHrForm(p => ({ ...p, hours_worked: e.target.value }))} /></div>
                                    <div className="space-y-1.5"><Label>Overtime Hours</Label><Input type="number" step="0.5" value={editHrForm.overtime_hours} onChange={(e) => setEditHrForm(p => ({ ...p, overtime_hours: e.target.value }))} /></div>
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Overtime Rate (ETB/hr)</Label>
                                    <Input type="number" step="0.01" placeholder="Default 1.5×" value={editHrForm.overtime_rate} onChange={(e) => setEditHrForm(p => ({ ...p, overtime_rate: e.target.value }))} />
                                </div>
                            </>
                        )}

                        {editDialog?.type === 'material' && (
                            <>
                                {suppliers.length > 0 && (
                                    <div className="space-y-1.5">
                                        <Label>Supplier (Optional)</Label>
                                        <Select value={editMatForm.supplier_id || 'none'} onValueChange={(v) => setEditMatForm(p => ({ ...p, supplier_id: v === 'none' ? '' : v }))}>
                                            <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none">No supplier</SelectItem>
                                                {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}
                                <div className="space-y-1.5">
                                    <Label>Material Type *</Label>
                                    <Input placeholder="e.g. Cement, Rebar, Sand" value={editMatForm.material_type} onChange={(e) => setEditMatForm(p => ({ ...p, material_type: e.target.value }))} />
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                    <div className="space-y-1.5">
                                        <Label>Quantity *</Label>
                                        <Input type="number" min="0" value={editMatForm.quantity} onChange={(e) => setEditMatForm(p => ({ ...p, quantity: e.target.value }))} />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label>Unit</Label>
                                        <Select value={editMatForm.unit} onValueChange={(v) => setEditMatForm(p => ({ ...p, unit: v }))}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                {['bags', 'kg', 'ton', 'm3', 'm2', 'm', 'pcs', 'liters'].map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label>Unit Cost (ETB) *</Label>
                                        <Input type="number" min="0" step="0.01" value={editMatForm.unit_cost} onChange={(e) => setEditMatForm(p => ({ ...p, unit_cost: e.target.value }))} />
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Delivery Date</Label>
                                    <Input type="date" value={editMatForm.delivery_date} onChange={(e) => setEditMatForm(p => ({ ...p, delivery_date: e.target.value }))} />
                                </div>
                            </>
                        )}

                        {editDialog?.type === 'equipment' && (
                            <>
                                <div className="space-y-1.5">
                                    <Label>Equipment Type *</Label>
                                    <Input placeholder="e.g. Excavator, Compactor, Crane" value={editEqForm.type} onChange={(e) => setEditEqForm(p => ({ ...p, type: e.target.value }))} />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1.5"><Label>Operation Time (hrs) *</Label><Input type="number" min="0" step="0.5" value={editEqForm.operation_time} onChange={(e) => setEditEqForm(p => ({ ...p, operation_time: e.target.value }))} /></div>
                                    <div className="space-y-1.5"><Label>Cost/hr (ETB) *</Label><Input type="number" min="0" step="0.01" value={editEqForm.cost_per_unit} onChange={(e) => setEditEqForm(p => ({ ...p, cost_per_unit: e.target.value }))} /></div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1.5"><Label>Idle Hours</Label><Input type="number" min="0" step="0.5" value={editEqForm.idle_hours} onChange={(e) => setEditEqForm(p => ({ ...p, idle_hours: e.target.value }))} /></div>
                                    <div className="space-y-1.5"><Label>Idle Reason</Label><Input placeholder="Reason for idle" value={editEqForm.idle_reason} onChange={(e) => setEditEqForm(p => ({ ...p, idle_reason: e.target.value }))} /></div>
                                </div>
                            </>
                        )}
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditDialog(null)}>Cancel</Button>
                        <Button onClick={handleSaveEdit} disabled={savingEdit}>
                            {savingEdit && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
