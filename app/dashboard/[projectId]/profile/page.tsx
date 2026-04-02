'use client'

import { use, type ReactNode } from 'react'
import { useSearchParams } from 'next/navigation'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/lib/auth-context'
import { mockProjects, type ProjectRole, roleLabels } from '@/lib/mock-data'
import { CalendarClock, MapPin, PencilLine, ShieldCheck, UserCircle2 } from 'lucide-react'

interface ProfilePageProps {
  params: Promise<{ projectId: string }>
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-2">
      <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</Label>
      <Input value={value} readOnly className="bg-muted/40" />
    </div>
  )
}

function StatRow({ label, value, accent }: { label: string; value: ReactNode; accent?: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border bg-white px-4 py-3 text-sm shadow-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={accent}>{value}</span>
    </div>
  )
}

export default function ProfilePage({ params }: ProfilePageProps) {
  const { projectId } = use(params)
  const searchParams = useSearchParams()
  const { user } = useAuth()
  const role = (searchParams.get('role') as ProjectRole) || 'site_engineer'
  const project = mockProjects.find((item) => item.id === projectId)

  if (!project) return null

  const initials = user?.full_name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'U'

  return (
    <div className="grid gap-6 xl:grid-cols-[280px_1fr]">
      <Card className="overflow-hidden border-0 shadow-sm">
        <CardContent className="space-y-5 p-5">
          <div className="overflow-hidden rounded-2xl bg-linear-to-br from-slate-100 to-slate-300 p-3 shadow-inner">
            <Avatar className="h-56 w-full rounded-2xl object-cover">
              <AvatarImage src={user?.profile_photo_url} className="object-cover" />
              <AvatarFallback className="text-4xl">{initials}</AvatarFallback>
            </Avatar>
          </div>

          <div className="space-y-3 rounded-2xl border bg-slate-50 p-4">
            <StatRow label="Account Status" value={<Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Active</Badge>} />
            <StatRow label="Last Login" value="2 hours ago" />
            <StatRow label="Access Level" value="Administrator" accent="font-medium text-blue-700" />
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardHeader className="flex flex-row items-start justify-between gap-4 border-b bg-white/60 pb-4">
          <div>
            <CardTitle className="text-xl">Personal Information</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">Manage your corporate identity and contact preferences.</p>
          </div>
          <Button variant="outline" className="gap-2 shadow-sm">
            <PencilLine className="h-4 w-4" />
            Edit Profile
          </Button>
        </CardHeader>

        <CardContent className="space-y-6 p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Full Name" value={user?.full_name || 'Marcus Thorne'} />
            <Field label="Role" value={roleLabels[role]} />
            <Field label="Employee ID" value={user?.id.toUpperCase() || 'AC-99284-MT'} />
            <Field label="Contact Number" value={user?.phone || '+1 (555) 029-4412'} />
          </div>

          <Field label="Office Location" value={project.location || 'HQ North Wing, Floor 14 - Chicago, IL'} />

          <div className="grid gap-3 sm:grid-cols-2">
            <StatRow label="Project" value={project.name} />
            <StatRow label="Current Role" value={roleLabels[role]} />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-slate-50 p-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <UserCircle2 className="h-4 w-4" />
              <span>ETHIO-CONSTRUCT DATA</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              <span>{project.location}</span>
              <CalendarClock className="ml-2 h-4 w-4" />
              <span>Updated today</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
            <Button variant="secondary">Cancel Changes</Button>
            <Button className="shadow-sm">Save Changes</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}