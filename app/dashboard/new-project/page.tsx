'use client'

import { useState } from 'react'
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

export default function NewProjectPage() {
  const router = useRouter()
  const { isAuthenticated } = useAuth()
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    location: '',
    planned_start_date: '',
    planned_end_date: '',
    client_name: '',
  })

  // Redirect if not authenticated
  if (!isAuthenticated) {
    router.push('/login')
    return null
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // In a real app, this would create the project and return the new ID
    // For now, redirect to the first mock project
    router.push('/dashboard/proj-1?role=project_manager')
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
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

      {/* Main Content */}
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Create New Project</CardTitle>
            <CardDescription>
              Set up a new construction project. You can add team members and tasks after creation.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Project Name */}
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

              {/* Description */}
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

              {/* Location */}
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

              {/* Dates */}
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

              {/* Client */}
              <div className="space-y-2">
                <Label htmlFor="client_name">Client *</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a client" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="client-1">Ethiopian Development Corporation</SelectItem>
                    <SelectItem value="client-2">Ethiopian Roads Authority</SelectItem>
                    <SelectItem value="client-3">Ministry of Urban Development</SelectItem>
                    <SelectItem value="client-4">Industrial Parks Development Corporation</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Contract Budget */}
              <div className="space-y-2">
                <Label htmlFor="budget">Contract Budget (ETB)</Label>
                <Input
                  id="budget"
                  name="budget"
                  type="number"
                  placeholder="e.g., 50000000"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-4 pt-4 border-t border-border">
                <Link href="/">
                  <Button type="button" variant="outline">
                    Cancel
                  </Button>
                </Link>
                <Button type="submit" disabled={isLoading}>
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
