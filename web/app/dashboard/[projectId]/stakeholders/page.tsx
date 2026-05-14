'use client'

import { use, useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import {
    Building2,
    Package,
    Plus,
    Pencil,
    Trash2,
    Loader2,
    Mail,
    Phone,
    ShieldAlert,
} from 'lucide-react'
import {
    listClients,
    createClient,
    updateClient,
    deleteClient,
    listSuppliers,
    createSupplier,
    updateSupplier,
    deleteSupplier,
} from '@/lib/api'
import type { ClientListItem, SupplierItem } from '@/lib/api-types'
import { toast } from 'sonner'
import { useProjectRole } from '@/lib/project-role-context'

type StakeholderType = 'clients' | 'suppliers'

interface StakeholdersPageProps {
    params: Promise<{ projectId: string }>
}

export default function StakeholdersPage({ params }: StakeholdersPageProps) {
    const { projectId } = use(params)
    const userRole = useProjectRole()
    const [activeTab, setActiveTab] = useState<StakeholderType>('clients')
    const [loading, setLoading] = useState(true)

    // Data
    const [clients, setClients] = useState<ClientListItem[]>([])
    const [suppliers, setSuppliers] = useState<SupplierItem[]>([])

    // Dialog state
    const [dialogOpen, setDialogOpen] = useState(false)
    const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create')
    const [editingId, setEditingId] = useState<string | null>(null)
    const [saving, setSaving] = useState(false)

    // Form data
    const [formData, setFormData] = useState<Record<string, string>>({})

    const loadData = async () => {
        setLoading(true)
        try {
            const [clientsRes, suppliersRes] = await Promise.all([
                listClients(projectId),
                listSuppliers(projectId),
            ])
            setClients(clientsRes)
            setSuppliers(suppliersRes)
        } catch (error) {
            toast.error('Failed to load stakeholders')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadData()
    }, [projectId])

    const openCreateDialog = (type: StakeholderType) => {
        setActiveTab(type)
        setDialogMode('create')
        setEditingId(null)
        setFormData({})
        setDialogOpen(true)
    }

    const openEditDialog = (type: StakeholderType, item: ClientListItem | SupplierItem) => {
        setActiveTab(type)
        setDialogMode('edit')
        setEditingId(item.id)

        if (type === 'suppliers') {
            const supplier = item as SupplierItem
            setFormData({
                name: supplier.name,
                role: supplier.role || '',
                tin_number: supplier.tin_number || '',
                address: supplier.address || '',
                contact_email: supplier.contact_email || '',
                contact_phone: supplier.contact_phone || '',
            })
        } else {
            const client = item as ClientListItem
            setFormData({
                name: client.name,
                tin_number: client.tin_number || '',
                address: client.address || '',
                contact_email: client.contact_email || '',
                contact_phone: client.contact_phone || '',
            })
        }

        setDialogOpen(true)
    }

    const handleSave = async () => {
        if (!formData.name?.trim()) {
            toast.error('Name is required')
            return
        }

        setSaving(true)
        try {
            if (activeTab === 'clients') {
                const body = {
                    project_id: projectId,
                    name: formData.name.trim(),
                    tin_number: formData.tin_number?.trim() || undefined,
                    address: formData.address?.trim() || undefined,
                    contact_email: formData.contact_email?.trim() || undefined,
                    contact_phone: formData.contact_phone?.trim() || undefined,
                }
                if (dialogMode === 'create') {
                    await createClient(body)
                    toast.success('Client created')
                } else if (editingId) {
                    const updateBody = {
                        name: formData.name.trim(),
                        tin_number: formData.tin_number?.trim() || undefined,
                        address: formData.address?.trim() || undefined,
                        contact_email: formData.contact_email?.trim() || undefined,
                        contact_phone: formData.contact_phone?.trim() || undefined,
                    }
                    await updateClient(editingId, updateBody)
                    toast.success('Client updated')
                }
            } else if (activeTab === 'suppliers') {
                const body = {
                    project_id: projectId,
                    name: formData.name.trim(),
                    role: formData.role?.trim() || undefined,
                    tin_number: formData.tin_number?.trim() || undefined,
                    address: formData.address?.trim() || undefined,
                    contact_email: formData.contact_email?.trim() || undefined,
                    contact_phone: formData.contact_phone?.trim() || undefined,
                }
                if (dialogMode === 'create') {
                    await createSupplier(body)
                    toast.success('Supplier created')
                } else if (editingId) {
                    const updateBody = {
                        name: formData.name.trim(),
                        role: formData.role?.trim() || undefined,
                        tin_number: formData.tin_number?.trim() || undefined,
                        address: formData.address?.trim() || undefined,
                        contact_email: formData.contact_email?.trim() || undefined,
                        contact_phone: formData.contact_phone?.trim() || undefined,
                    }
                    await updateSupplier(editingId, updateBody)
                    toast.success('Supplier updated')
                }
            }

            setDialogOpen(false)
            await loadData()
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to save')
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async (type: StakeholderType, id: string, name: string) => {
        if (!confirm(`Are you sure you want to delete "${name}"?`)) return

        try {
            if (type === 'clients') {
                await deleteClient(id)
                toast.success('Client deleted')
            } else if (type === 'suppliers') {
                await deleteSupplier(id)
                toast.success('Supplier deleted')
            }
            await loadData()
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to delete')
        }
    }

    if (loading) {
        return (
            <div className="flex justify-center py-24">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    // Only Project Managers can access stakeholder management
    const isProjectManager = userRole === 'project_manager'

    if (!isProjectManager) {
        return (
            <div className="flex flex-col items-center justify-center py-24 space-y-4">
                <ShieldAlert className="h-16 w-16 text-muted-foreground" />
                <div className="text-center">
                    <h2 className="text-2xl font-bold mb-2">Access Restricted</h2>
                    <p className="text-muted-foreground">
                        Only Project Managers can manage stakeholders.
                    </p>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6 px-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Stakeholder Management</h1>
                    <p className="text-muted-foreground">Manage clients and suppliers for this project</p>
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as StakeholderType)}>
                <TabsList className="grid w-full max-w-md grid-cols-2">
                    <TabsTrigger value="clients" className="gap-2">
                        <Building2 className="h-4 w-4" />
                        Clients
                    </TabsTrigger>
                    <TabsTrigger value="suppliers" className="gap-2">
                        <Package className="h-4 w-4" />
                        Suppliers
                    </TabsTrigger>
                </TabsList>

                {/* Clients Tab */}
                <TabsContent value="clients" className="space-y-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>Clients ({clients.length})</CardTitle>
                            <Button onClick={() => openCreateDialog('clients')} className="gap-2">
                                <Plus className="h-4 w-4" />
                                Add Client
                            </Button>
                        </CardHeader>
                        <CardContent>
                            {clients.length === 0 ? (
                                <p className="text-center text-muted-foreground py-8">No clients yet. Add your first client.</p>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Name</TableHead>
                                            <TableHead>TIN Number</TableHead>
                                            <TableHead>Contact</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {clients.map((client) => (
                                            <TableRow key={client.id}>
                                                <TableCell className="font-medium">{client.name}</TableCell>
                                                <TableCell>
                                                    {client.tin_number || <span className="text-sm text-muted-foreground">—</span>}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="space-y-1">
                                                        {client.contact_email && (
                                                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                                <Mail className="h-3.5 w-3.5" />
                                                                {client.contact_email}
                                                            </div>
                                                        )}
                                                        {client.contact_phone && (
                                                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                                <Phone className="h-3.5 w-3.5" />
                                                                {client.contact_phone}
                                                            </div>
                                                        )}
                                                        {!client.contact_email && !client.contact_phone && (
                                                            <span className="text-sm text-muted-foreground">—</span>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex justify-end gap-2">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => openEditDialog('clients', client)}
                                                        >
                                                            <Pencil className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => handleDelete('clients', client.id, client.name)}
                                                        >
                                                            <Trash2 className="h-4 w-4 text-destructive" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Suppliers Tab */}
                <TabsContent value="suppliers" className="space-y-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>Suppliers ({suppliers.length})</CardTitle>
                            <Button onClick={() => openCreateDialog('suppliers')} className="gap-2">
                                <Plus className="h-4 w-4" />
                                Add Supplier
                            </Button>
                        </CardHeader>
                        <CardContent>
                            {suppliers.length === 0 ? (
                                <p className="text-center text-muted-foreground py-8">No suppliers yet. Add your first supplier.</p>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Name</TableHead>
                                            <TableHead>Role / TIN</TableHead>
                                            <TableHead>Contact</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {suppliers.map((supplier) => (
                                            <TableRow key={supplier.id}>
                                                <TableCell className="font-medium">{supplier.name}</TableCell>
                                                <TableCell>
                                                    <div className="space-y-1">
                                                        {supplier.role && (
                                                            <div className="flex items-center gap-2 text-sm">
                                                                <Package className="h-3.5 w-3.5 text-muted-foreground" />
                                                                {supplier.role}
                                                            </div>
                                                        )}
                                                        {supplier.tin_number && (
                                                            <div className="text-sm text-muted-foreground">
                                                                TIN: {supplier.tin_number}
                                                            </div>
                                                        )}
                                                        {!supplier.role && !supplier.tin_number && (
                                                            <span className="text-sm text-muted-foreground">—</span>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="space-y-1">
                                                        {supplier.contact_email && (
                                                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                                <Mail className="h-3.5 w-3.5" />
                                                                {supplier.contact_email}
                                                            </div>
                                                        )}
                                                        {supplier.contact_phone && (
                                                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                                <Phone className="h-3.5 w-3.5" />
                                                                {supplier.contact_phone}
                                                            </div>
                                                        )}
                                                        {!supplier.contact_email && !supplier.contact_phone && (
                                                            <span className="text-sm text-muted-foreground">—</span>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex justify-end gap-2">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => openEditDialog('suppliers', supplier)}
                                                        >
                                                            <Pencil className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => handleDelete('suppliers', supplier.id, supplier.name)}
                                                        >
                                                            <Trash2 className="h-4 w-4 text-destructive" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Create/Edit Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>
                            {dialogMode === 'create' ? 'Add' : 'Edit'}{' '}
                            {activeTab === 'clients' ? 'Client' : 'Supplier'}
                        </DialogTitle>
                        <DialogDescription>
                            {dialogMode === 'create' ? 'Create a new' : 'Update'}{' '}
                            {activeTab === 'clients' ? 'client' : 'supplier'} record.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
                        <div className="space-y-2">
                            <Label htmlFor="name">Name *</Label>
                            <Input
                                id="name"
                                placeholder="Enter name"
                                value={formData.name || ''}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            />
                        </div>

                        {activeTab === 'suppliers' && (
                            <div className="space-y-2">
                                <Label htmlFor="role">Role / Type of Supply</Label>
                                <Input
                                    id="role"
                                    placeholder="e.g., Cement, Steel, Aggregate, Equipment rental"
                                    value={formData.role || ''}
                                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                />
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label htmlFor="tin_number">TIN Number</Label>
                            <Input
                                id="tin_number"
                                placeholder="Ethiopian Tax Identification Number"
                                value={formData.tin_number || ''}
                                onChange={(e) => setFormData({ ...formData, tin_number: e.target.value })}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="address">Address</Label>
                            <Input
                                id="address"
                                placeholder="Physical address"
                                value={formData.address || ''}
                                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="contact_email">Email</Label>
                            <Input
                                id="contact_email"
                                type="email"
                                placeholder="email@example.com"
                                value={formData.contact_email || ''}
                                onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="contact_phone">Phone</Label>
                            <Input
                                id="contact_phone"
                                type="tel"
                                placeholder="+251 912 345 678"
                                value={formData.contact_phone || ''}
                                onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleSave} disabled={saving}>
                            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {dialogMode === 'create' ? 'Create' : 'Update'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}

