'use client'

import { use, useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/lib/auth-context'
import { getProject } from '@/lib/api'
import type { ProjectDetail } from '@/lib/api-types'
import { BellRing, BrainCircuit, KeyRound, Palette, ShieldCheck, SquareTerminal, UserCog, Loader2 } from 'lucide-react'

interface SettingsPageProps {
  params: Promise<{ projectId: string }>
}

function SectionTitle({ icon: Icon, title, description }: { icon: typeof UserCog; title: string; description: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="rounded-lg bg-blue-50 p-2 text-blue-700">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}

export default function SettingsPage({ params }: SettingsPageProps) {
  const { projectId } = use(params)
  const { user } = useAuth()
  const [project, setProject] = useState<ProjectDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const p = await getProject(projectId)
        if (!cancelled) setProject(p)
      } catch {
        if (!cancelled) setProject(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [projectId])

  if (loading) {
    return (
      <div className="flex justify-center py-24 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!project) return null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage your architectural workspace preferences and security configurations. Project: {project.name}
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="shadow-sm">
          <CardHeader className="pb-4">
            <SectionTitle icon={UserCog} title="Account Information" description="Email, password, and profile preferences." />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
              <div className="space-y-2">
                <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Email Address</Label>
                <Input defaultValue={user?.email || ''} readOnly />
              </div>
              <div className="flex items-end">
                <Button variant="secondary" type="button">Change</Button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
              <div className="rounded-xl border bg-muted/50 p-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <KeyRound className="h-4 w-4 text-muted-foreground" />
                  Password Management
                </div>
                <p className="mt-1 text-sm text-muted-foreground">Update via profile when connected to the API.</p>
                <p className="text-xs text-muted-foreground">Secure your account with a strong password.</p>
              </div>
              <div className="flex items-end">
                <Button className="bg-blue-700 hover:bg-blue-800" type="button">Update</Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-4">
            <SectionTitle icon={Palette} title="Visual Identity" description="Choose your interface theme and language." />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3 rounded-2xl border bg-muted/50 p-3">
              <Button variant="default" className="h-12 justify-start gap-2" type="button">
                <Palette className="h-4 w-4" />
                Light
              </Button>
              <Button variant="secondary" className="h-12 justify-start gap-2" type="button">
                <SquareTerminal className="h-4 w-4" />
                Dark
              </Button>
            </div>

            <div className="space-y-2">
              <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Regional Language</Label>
              <Select defaultValue="en-uk">
                <SelectTrigger>
                  <SelectValue placeholder="Select language" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en-uk">English (United Kingdom)</SelectItem>
                  <SelectItem value="en-us">English (United States)</SelectItem>
                  <SelectItem value="am-et">Amharic (Ethiopia)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm">
        <CardHeader className="pb-4">
          <SectionTitle icon={BellRing} title="Intelligence Alerts" description="Control automated project alerts and summaries." />
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          {[
            { title: 'Daily Log Summaries', description: 'Receive automated project digests every morning.' },
            { title: 'Critical System Status', description: 'Real-time alerts for infrastructure maintenance.' },
            { title: 'Budget Variance Alerts', description: 'Notify when cost exceeds ±5% of predicted risk.' },
          ].map((item, index) => (
            <div key={item.title} className="rounded-2xl border bg-muted/50 p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{item.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                </div>
                <Switch defaultChecked={index !== 2} />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="shadow-sm">
          <CardHeader className="pb-4">
            <SectionTitle icon={ShieldCheck} title="Security Audit" description="Review recent access sessions and login history." />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-xl border bg-card p-4">
              <div>
                <p className="font-medium">London HQ - Desktop Chrome</p>
                <p className="text-sm text-muted-foreground">Active Now</p>
              </div>
              <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Active Now</Badge>
            </div>
            <div className="flex items-center justify-between rounded-xl border bg-card p-4">
              <div>
                <p className="font-medium">Dubai Site Office - Tablet</p>
                <p className="text-sm text-muted-foreground">3 hours ago</p>
              </div>
              <Badge variant="secondary">3 hours ago</Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-4">
            <SectionTitle icon={BrainCircuit} title="Platform Integration" description="Sync with third-party CAD and BIM software." />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3 rounded-xl border bg-muted/50 p-4">
              <div className="rounded-lg bg-card p-2 shadow-sm">
                <SquareTerminal className="h-4 w-4 text-blue-700" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium">CAD Synchronization</p>
                <p className="text-sm text-muted-foreground">Connected to Revit and AutoCAD pipelines.</p>
              </div>
              <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Online</Badge>
            </div>
            <div className="flex justify-end">
              <Button variant="outline" type="button">Manage API Keys</Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end gap-3">
        <Button variant="secondary" type="button">Reset Defaults</Button>
        <Button type="button">Save Settings</Button>
      </div>
    </div>
  )
}
