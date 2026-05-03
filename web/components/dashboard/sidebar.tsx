'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  Building2,
  LayoutDashboard,
  ListTodo,
  ClipboardList,
  Users,
  FileText,
  DollarSign,
  Settings,
  Bell,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { useAuth } from '@/lib/auth-context'
import { roleLabels, type ProjectRole } from '@/lib/domain'
import { useState } from 'react'

interface SidebarProps {
  projectId: string
  projectName: string
  userRole: ProjectRole
}

// Navigation items based on role
const getNavItems = (projectId: string, role: ProjectRole) => {
  const baseItems = [
    {
      label: 'Dashboard',
      href: `/dashboard/${projectId}`,
      icon: LayoutDashboard,
      roles: ['owner', 'project_manager', 'office_engineer', 'consultant', 'site_engineer'] as ProjectRole[],
    },
    {
      label: 'Tasks',
      href: `/dashboard/${projectId}/tasks`,
      icon: ListTodo,
      roles: ['owner', 'project_manager', 'office_engineer', 'consultant', 'site_engineer'] as ProjectRole[],
    },
    {
      label: 'Daily Logs',
      href: `/dashboard/${projectId}/logs`,
      icon: ClipboardList,
      roles: ['owner', 'project_manager', 'office_engineer', 'consultant', 'site_engineer'] as ProjectRole[],
    },
    {
      label: 'Team',
      href: `/dashboard/${projectId}/team`,
      icon: Users,
      roles: ['owner', 'project_manager', 'office_engineer'] as ProjectRole[],
    },
    {
      label: 'Reports',
      href: `/dashboard/${projectId}/reports`,
      icon: FileText,
      roles: ['owner', 'project_manager'] as ProjectRole[],
    },
    {
      label: 'Settings',
      href: `/dashboard/${projectId}/settings`,
      icon: Settings,
      roles: ['owner', 'project_manager'] as ProjectRole[],
    },
  ]

  return baseItems.filter(item => item.roles.includes(role))
}

export function DashboardSidebar({ projectId, projectName, userRole }: SidebarProps) {
  const pathname = usePathname()
  const { user, logout } = useAuth()
  const [collapsed, setCollapsed] = useState(false)
  
  const navItems = getNavItems(projectId, userRole)
  
  const initials = user?.full_name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase() || 'U'

  return (
    <aside 
      className={cn(
        "flex flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border/60 transition-all duration-300",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-sidebar-border/60">
        {!collapsed && (
          <Link href="/" className="flex items-center gap-2">
            <Building2 className="h-6 w-6 text-sidebar-primary" />
            <span className="font-bold text-lg">ConstructPro</span>
          </Link>
        )}
        {collapsed && (
          <Building2 className="h-6 w-6 text-sidebar-primary mx-auto" />
        )}
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "text-sidebar-foreground hover:bg-sidebar-accent h-8 w-8",
            collapsed && "mx-auto"
          )}
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      {/* Project Info */}
      {!collapsed && (
        <div className="p-4 border-b border-sidebar-border/60">
          <p className="text-xs text-sidebar-foreground/60 uppercase tracking-wider mb-1">
            Current Project
          </p>
          <h2 className="font-semibold text-sm truncate">{projectName}</h2>
          <Badge 
            variant="outline" 
            className="mt-2 text-xs border-sidebar-border/80 text-sidebar-foreground/90 bg-sidebar-accent/40"
          >
            {roleLabels[userRole]}
          </Badge>
        </div>
      )}

      {/* Navigation */}
      <ScrollArea className="flex-1 py-4">
        <nav className="space-y-1 px-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href || 
              (item.href !== `/dashboard/${projectId}` && pathname.startsWith(item.href))
            
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group relative flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                  isActive 
                    ? "bg-card/14 text-sidebar-primary shadow-sm" 
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                )}
                title={collapsed ? item.label : undefined}
              >
                {isActive && !collapsed && (
                  <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-sidebar-primary" />
                )}
                <item.icon className={cn("h-5 w-5 shrink-0", collapsed && "mx-auto")} />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            )
          })}
        </nav>
      </ScrollArea>

      {/* Bottom Section */}
      <div className="mt-auto border-t border-sidebar-border/60">
        <Separator className="bg-sidebar-border/70" />

        {/* User Profile */}
        <div className={cn(
          "p-4 flex items-center gap-3",
          collapsed && "justify-center p-2"
        )}>
          <Link href={`/dashboard/${projectId}/profile`} className={cn("flex min-w-0 flex-1 items-center gap-3", collapsed && "justify-center") }>
            <Avatar className="h-9 w-9">
              <AvatarFallback className="bg-sidebar-accent text-sidebar-accent-foreground text-xs">
                {initials}
              </AvatarFallback>
            </Avatar>
            {!collapsed && (
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{user?.full_name}</p>
                <p className="text-xs text-sidebar-foreground/60 truncate">{user?.email}</p>
              </div>
            )}
          </Link>
          {!collapsed && (
            <Button
              variant="ghost"
              size="icon"
              className="text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent h-8 w-8"
              onClick={() => void logout()}
              aria-label="Logout"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </aside>
  )
}
