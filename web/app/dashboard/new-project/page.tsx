'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
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
import { Building2, ArrowLeft, Loader2, Plus } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { createProject, listClients } from '@/lib/api'
import type { ClientListItem } from '@/lib/api-types'

function dateInputToApiDateTime(date: string): string | undefined {
  if (!date) return undefined
  return `${date}T00:00:00`
}

export default function NewProjectPage() {
  const router = useRouter()
  const { isAuthenticated } = useAuth()
  const [isLoading, setIsLoading] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [clientsLoading, setClientsLoading] = useState(true)
  const [clients, setClients] = useState<ClientListItem[]>([])

  // Project form
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    location: '',
    planned_start_date: new Date().toISOString().split('T')[0],
    planned_end_date: new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0],
    total_budget: '',
  })

  // Client selection mode: 'existing' or 'new'
  const [clientMode, setClientMode] = useState<'existing' | 'new'>('existing')
  const [selectedClientId, setSelectedClientId] = useState('')
  const [newClientName, setNewClientName] = useState('')
  const [newClientEmail, setNewClientEmail] = useState('')

  useEffect(() => {
    if (!isAuthenticated) router.push('/login')
  }, [isAuthenticated, router])

  useEffect(() => {
    if (!isAuthenticated) return
    let cancelled = false
    ;(async () => {
      setClientsLoading(true)
      try {
        const { data } = await listClients({ limit: 100 })
        if (!cancelled) {
          setClients(data)
          if (data.length === 0) setClientMode('new')
        }
      } catch {
        if (!cancelled) {
          setClients([])
          setClientMode('new')
        }
      } finally {
        if (!cancelled) setClientsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isAuthenticated])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }))
  }

  const selectedClient = clients.find((c) => c.id === selectedClientId)

  const getClientFields = (): { client_name: string; client_email: string } | null => {
    if (clientMode === 'existing') {
      if (!selectedClient) return null
      return {
        client_name: selectedClient.name,
        client_email: selectedClient.contact_email || '',
      }
    }
    if (!newClientName.trim() || !newClientEmail.trim()) return null
    return {
      client_name: newClientName.trim(),
      client_email: newClientEmail.trim(),
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const clientFields = getClientFields()
    if (!clientFields) {
      setSubmitError('Please select an existing client or add a new one.')
      return
    }
    const totalBudget = Number.parseFloat(formData.total_budget)
    if (!Number.isFinite(totalBudget) || totalBudget < 0) {
      setSubmitError('Enter a valid total budget (0 or greater).')
      return
    }
    setSubmitError(null)
    setIsLoading(true)
    try {
      const created = await createProject({
        name: formData.name.trim(),
        total_budget: totalBudget,
        description: formData.description.trim() || null,
        location: formData.location.trim() || null,
        planned_start_date: dateInputToApiDateTime(formData.planned_start_date) ?? null,
        planned_end_date: dateInputToApiDateTime(formData.planned_end_date) ?? null,
        client_name: clientFields.client_name,
        client_email: clientFields.client_email,
      })

      // Show resolved client name if different from what was typed
      const response = created as unknown as { client?: { name: string } }
      if (
        clientMode === 'new' &&
        response.client?.name &&
        response.client.name !== clientFields.client_name
      ) {
        alert(`Project created. Linked to existing client: ${response.client.name}`)
      }

      router.push(`/dashboard/${created.id}`)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Could not create project.')
    } finally {
      setIsLoading(false)
    }
  }

  const isClientValid = clientMode === 'existing'
    ? !!selectedClientId
    : !!(newClientName.trim() && newClientEmail.trim())

  if (!isAuthenticated) {
    return null
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-primary text-primary-foreground">
        <div className="mx-auto max-w-4xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <Link href="/dashboard">
              <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-primary-foreground/10">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <Building2 className="h-6 w-6" />
              <span className="font-bold text-lg">ConstructPro</span>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Create New Project</CardTitle>
            <CardDescription>
              Set up a new construction project. Select an existing client or add a new one.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name">Project Name *</Label>
                <Input
                  id="name"
                  name="name"
                  placeholder="e.g., Commercial Building Phase 1"
                  value={formData.name}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  name="description"
                  placeholder="Brief description of the project..."
                  rows={3}
                  value={formData.description}
                  onChange={handleChange}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="location">Location *</Label>
                <Input
                  id="location"
                  name="location"
                  placeholder="e.g., Bole, Addis Ababa"
                  value={formData.location}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="total_budget">Total Budget (Contract Value) *</Label>
                <Input
                  id="total_budget"
                  name="total_budget"
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="e.g., 15000000"
                  value={formData.total_budget}
                  onChange={handleChange}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Numeric total budget in ETB.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="planned_start_date">Planned Start Date *</Label>
                  <Input
                    id="planned_start_date"
                    name="planned_start_date"
                    type="date"
                    value={formData.planned_start_date}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="planned_end_date">Planned End Date *</Label>
                  <Input
                    id="planned_end_date"
                    name="planned_end_date"
                    type="date"
                    value={formData.planned_end_date}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>

              {/* Client Section */}
              <div className="space-y-3">
                <Label className="text-base font-semibold">Client *</Label>

                {clientsLoading ? (
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading clients...
                  </p>
                ) : (
                  <>
                    <Select
                      value={clientMode === 'existing' ? selectedClientId : ''}
                      onValueChange={(v) => {
                        setSelectedClientId(v)
                        setClientMode('existing')
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={clients.length === 0 ? 'No clients yet — add one below' : 'Select a client'} />
                      </SelectTrigger>
                      <SelectContent>
                        <div className="max-h-48 overflow-y-auto">
                          {clients.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              <div className="flex flex-col">
                                <span>{c.name}</span>
                                {c.contact_email && (
                                  <span className="text-xs text-muted-foreground">{c.contact_email}</span>
                                )}
                              </div>
                            </SelectItem>
                          ))}
                        </div>
                      </SelectContent>
                    </Select>

                    {clientMode === 'existing' && selectedClient && (
                      <p className="text-xs text-muted-foreground">
                        Selected: <span className="font-medium">{selectedClient.name}</span>
                        {selectedClient.contact_email && <> — {selectedClient.contact_email}</>}
                      </p>
                    )}

                    {clientMode === 'new' ? (
                      <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-4">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium">New Client Details</p>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-xs"
                            onClick={() => {
                              setClientMode('existing')
                              setNewClientName('')
                              setNewClientEmail('')
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor="client_name">Client Name *</Label>
                            <Input
                              id="client_name"
                              placeholder="e.g., Acme Construction Co."
                              value={newClientName}
                              onChange={(e) => setNewClientName(e.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="client_email">Client Email *</Label>
                            <Input
                              id="client_email"
                              type="email"
                              placeholder="e.g., contact@acme.com"
                              value={newClientEmail}
                              onChange={(e) => setNewClientEmail(e.target.value)}
                            />
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          If a client with this email already exists, the project will be linked to them automatically.
                        </p>
                      </div>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-1.5 w-full border-dashed"
                        onClick={() => {
                          setClientMode('new')
                          setSelectedClientId('')
                        }}
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add New Client
                      </Button>
                    )}
                  </>
                )}
              </div>

              {submitError && (
                <p className="text-sm text-destructive" role="alert">
                  {submitError}
                </p>
              )}

              <div className="flex flex-wrap items-center justify-end gap-4 pt-4 border-t border-border">
                <Link href="/dashboard">
                  <Button type="button" variant="outline">
                    Cancel
                  </Button>
                </Link>
                <Button type="submit" disabled={isLoading || !isClientValid}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Project'
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
