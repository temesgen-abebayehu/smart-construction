'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { 
  Search, 
  Bell, 
  ChevronDown,
  Settings,
  User,
  LogOut,
  Building2,
} from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { useRouter } from 'next/navigation'
import { type ProjectRole, roleLabels } from '@/lib/mock-data'
import { ProjectSelectionModal } from '@/components/project-selection-modal'

interface DashboardHeaderProps {
  projectId: string
  projectName: string
  userRole: ProjectRole
}

export function DashboardHeader({ projectId, projectName, userRole }: DashboardHeaderProps) {
  const { user, logout } = useAuth()
  const router = useRouter()
  const [projectPickerOpen, setProjectPickerOpen] = useState(false)
  
  const initials = user?.full_name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase() || 'U'

  const handleLogout = () => {
    logout()
    router.push('/')
  }

  return (
    <header className="h-16 border-b border-border bg-card px-6 flex items-center justify-between gap-4">
      {/* Left - Breadcrumb / Project Name */}
      
      {/* <div className="flex items-center gap-2 min-w-0">
        <Building2 className="h-5 w-5 text-muted-foreground shrink-0" />
        <span className="text-muted-foreground">/</span>
        <h1 className="font-semibold truncate">{projectName}</h1>
      </div> */}

      {/* Center - Search */}
      <div className="flex-1 hidden md:flex justify-center px-4">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tasks, logs, team members..."
            className="rounded-full pl-10 bg-background shadow-sm"
          />
        </div>
      </div>

      {/* Right - Actions */}
      <div className="flex items-center gap-2">
        {/* Notifications */}
        <Button variant="ghost" size="icon" className="relative" asChild>
          <Link href={`/dashboard/${projectId}/notifications?role=${userRole}`} aria-label="Notifications">
            <Bell className="h-5 w-5" />
            <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-destructive" />
            <span className="sr-only">Notifications</span>
          </Link>
        </Button>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="gap-2 pl-2 pr-3">
              <Avatar className="h-8 w-8">
                <AvatarImage src={user?.profile_photo_url} />
                <AvatarFallback className="text-xs">{initials}</AvatarFallback>
              </Avatar>
              <div className="hidden lg:block text-left">
                <p className="text-sm font-medium leading-none">{user?.full_name}</p>
                <p className="text-xs text-muted-foreground">{roleLabels[userRole]}</p>
              </div>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div>
                <p className="font-medium">{user?.full_name}</p>
                <p className="text-xs text-muted-foreground font-normal">{user?.email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <User className="mr-2 h-4 w-4" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setProjectPickerOpen(true)}>
              <Building2 className="mr-2 h-4 w-4" />
              Projects
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ProjectSelectionModal open={projectPickerOpen} onOpenChange={setProjectPickerOpen} />
    </header>
  )
}
