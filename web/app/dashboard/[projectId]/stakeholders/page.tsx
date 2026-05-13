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
    HardHat,
    Package,
    Plus,
    Pencil,
    Trash2,
    Loader2,
    Mail,
    Phone,
    Briefcase,
    ShieldAlert,
} from 'lucide-react'
import {
    listClients,
    createClient,
    updateClient,
    deleteClient,
    listContractors,
    createContractor,
    updateContractor,
    deleteContractor,
    listSuppliers,
    createSupplier,
    updateSupplier,
    deleteSupplier,
    getProject,
} from '@/lib/api'
import type { ClientListItem, ContractorItem, SupplierItem } from '@/lib/api-types'
import { toast } from 'sonner'
import { useProjectRole } from '@/lib/project-role-context'

type StakeholderType = 'clients' | 'contractors' | 'suppliers'

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
    const [contractors, setContractors] = useState<ContractorItem[]>([])
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
            const [clientsRes, contractorsRes, suppliersRes] = await Promise.all([
                listClients(),
                listContractors(),
                listSuppliers(),
            ])
            setClients(clientsRes.data)
            setContractors(contractorsRes)
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

    const openEditDialog = (type: StakeholderType, item: ClientListItem | ContractorItem | SupplierItem) => {
        setActiveTab(type)
        setDialogMode('edit')
        setEditingId(item.id)
        setFormData({
            name: item.name,
            contact_email: item.contact_email || '',
            contact_phone: 'contact_phone' in item ? item.contact_phone || '' : '',
            specialization: 'specialization' in item ? item.specialization || '' : '',
        })
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
                    name: formData.name.trim(),
                    contact_email: formData.contact_email?.trim() || undefined,
                }
                if (dialogMode === 'create') {
                    await createClient(body)
                    toast.success('Client created')
                } else if (editingId) {
                    await updateClient(editingId, body)
                    toast.success('Client updated')
                }
            } else if (activeTab === 'contractors') {
                const body = {
                    name: formData.name.trim(),
                    specialization: formData.specialization?.trim() || undefined,
                    contact_email: formData.contact_email?.trim() || undefined,
                    contact_phone: formData.contact_phone?.trim() || undefined,
                }
                if (dialogMode === 'create') {
                    await createContractor(body)
                    toast.success('Contractor created')
                } else if (editingId) {
                    await updateContractor(editingId, body)
                    toast.success('Contractor updated')
                }
            } else if (activeTab === 'suppliers') {
                const body = {
                    name: formData.name.trim(),
                    contact_email: formData.contact_email?.trim() || undefined,
                    contact_phone: formData.contact_phone?.trim() || undefined,
                }
                if (dialogMode === 'create') {
                    await createSupplier(body)
                    toast.success('Supplier created')
                } else if (editingId) {
                    await updateSupplier(editingId, body)
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
            } else if (type === 'contractors') {
                await deleteContractor(id)
                toast.success('Contractor deleted')
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
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Stakeholder Management</h1>
                    <p className="text-muted-foreground">Manage clients, contractors, and suppliers for this project</p>
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as StakeholderType)}>
                <TabsList className="grid w-full max-w-md grid-cols-3">
                    <TabsTrigger value="clients" className="gap-2">
                        <Building2 className="h-4 w-4" />
                        Clients
                    </TabsTrigger>
                    <TabsTrigger value="contractors" className="gap-2">
                        <HardHat className="h-4 w-4" />
                        Contractors
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
                                            <TableHead>Email</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {clients.map((client) => (
                                            <TableRow key={client.id}>
                                                <TableCell className="font-medium">{client.name}</TableCell>
                                                <TableCell>
                                                    {client.contact_email ? (
                                                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                            <Mail className="h-3.5 w-3.5" />
                                                            {client.contact_email}
                                                        </div>
                                                    ) : (
                                                        <span className="text-sm text-muted-foreground">—</span>
                                                    )}
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

                {/* Contractors Tab */}
                <TabsContent value="contractors" className="space-y-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>Contractors ({contractors.length})</CardTitle>
                            <Button onClick={() => openCreateDialog('contractors')} className="gap-2">
                                <Plus className="h-4 w-4" />
                                Add Contractor
                            </Button>
                        </CardHeader>
                        <CardContent>
                            {contractors.length === 0 ? (
                                <p className="text-center text-muted-foreground py-8">No contractors yet. Add your first contractor.</p>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Name</TableHead>
                                            <TableHead>Specialization</TableHead>
                                            <TableHead>Contact</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {contractors.map((contractor) => (
                                            <TableRow key={contractor.id}>
                                                <TableCell className="font-medium">{contractor.name}</TableCell>
                                                <TableCell>
                                                    {contractor.specialization ? (
                                                        <div className="flex items-center gap-2 text-sm">
                                                            <Briefcase className="h-3.5 w-3.5 text-muted-foreground" />
                                                            {contractor.specialization}
                                                        </div>
                                                    ) : (
                                                        <span className="text-sm text-muted-foreground">—</span>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="space-y-1">
                                                        {contractor.contact_email && (
                                                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                                <Mail className="h-3.5 w-3.5" />
                                                                {contractor.contact_email}
                                                            </div>
                                                        )}
                                                        {contractor.contact_phone && (
                                                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                                <Phone className="h-3.5 w-3.5" />
                                                                {contractor.contact_phone}
                                                            </div>
                                                        )}
                                                        {!contractor.contact_email && !contractor.contact_phone && (
                                                            <span className="text-sm text-muted-foreground">—</span>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex justify-end gap-2">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => openEditDialog('contractors', contractor)}
                                                        >
                                                            <Pencil className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => handleDelete('contractors', contractor.id, contractor.name)}
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
                            {activeTab === 'clients' ? 'Client' : activeTab === 'contractors' ? 'Contractor' : 'Supplier'}
                        </DialogTitle>
                        <DialogDescription>
                            {dialogMode === 'create' ? 'Create a new' : 'Update'}{' '}
                            {activeTab === 'clients' ? 'client' : activeTab === 'contractors' ? 'contractor' : 'supplier'} record.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Name *</Label>
                            <Input
                                id="name"
                                placeholder="Enter name"
                                value={formData.name || ''}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            />
                        </div>

                        {activeTab === 'contractors' && (
                            <div className="space-y-2">
                                <Label htmlFor="specialization">Specialization</Label>
                                <Input
                                    id="specialization"
                                    placeholder="e.g., Electrical, Plumbing, HVAC"
                                    value={formData.specialization || ''}
                                    onChange={(e) => setFormData({ ...formData, specialization: e.target.value })}
                                />
                            </div>
                        )}

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

                        {activeTab !== 'clients' && (
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
                        )}
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

