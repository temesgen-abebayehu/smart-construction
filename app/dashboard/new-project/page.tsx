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
import { Building2, ArrowLeft, Loader2 } from 'lucide-react'
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
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    location: '',
    planned_start_date: '',
    planned_end_date: '',
    total_budget: '',
    contract_number: '',
  })
  const [clientId, setClientId] = useState('')

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
        if (!cancelled) setClients(data)
      } catch {
        if (!cancelled) setClients([])
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!clientId) return
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
        client_id: clientId,
      })
      router.push(`/dashboard/${created.id}`)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Could not create project.')
    } finally {
      setIsLoading(false)
    }
  }

  if (!isAuthenticated) {
    return null
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-primary text-primary-foreground">
        <div className="mx-auto max-w-4xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <Link href="/">
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
              Set up a new construction project.               Choose a client (from <code className="text-xs">GET /clients</code>) and a total budget. Create a client
              first if the list is empty.
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
                <Label htmlFor="total_budget">Total budget (contract value) *</Label>
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
                  Numeric total budget in your reporting currency (e.g. ETB). Required by the API.
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

              <div className="space-y-2">
                <Label>Client *</Label>
                {clientsLoading ? (
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading clients…
                  </p>
                ) : clients.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No clients found. Create one with <code className="text-xs">POST /clients</code>, then refresh.
                  </p>
                ) : (
                  <Select value={clientId} onValueChange={setClientId} required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a client" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="contract_number">Contract reference (local note)</Label>
                <Input
                  id="contract_number"
                  name="contract_number"
                  placeholder="Optional — not sent to the API yet"
                  value={formData.contract_number}
                  onChange={handleChange}
                />
              </div>

              {submitError && (
                <p className="text-sm text-destructive" role="alert">
                  {submitError}
                </p>
              )}

              <div className="flex flex-wrap items-center justify-end gap-4 pt-4 border-t border-border">
                <Link href="/">
                  <Button type="button" variant="outline">
                    Cancel
                  </Button>
                </Link>
                <Button type="submit" disabled={isLoading || !clientId || clients.length === 0}>
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
