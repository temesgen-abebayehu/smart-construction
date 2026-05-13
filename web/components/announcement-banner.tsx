'use client'

import { useEffect, useState } from 'react'
import { X, Megaphone, AlertTriangle, Info } from 'lucide-react'
import { listAnnouncements } from '@/lib/api'
import type { AnnouncementItem } from '@/lib/api-types'
import { Button } from '@/components/ui/button'

export function AnnouncementBanner() {
    const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([])
    const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set())
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        let cancelled = false

            ; (async () => {
                try {
                    const data = await listAnnouncements()
                    if (!cancelled) {
                        setAnnouncements(data)
                    }
                } catch (error) {
                    console.error('Failed to load announcements:', error)
                } finally {
                    if (!cancelled) {
                        setLoading(false)
                    }
                }
            })()

        return () => {
            cancelled = true
        }
    }, [])

    const handleDismiss = (id: string) => {
        setDismissedIds((prev) => new Set([...prev, id]))
    }

    const visibleAnnouncements = announcements.filter((a) => !dismissedIds.has(a.id))

    if (loading || visibleAnnouncements.length === 0) {
        return null
    }

    const getPriorityStyles = (priority: string) => {
        switch (priority) {
            case 'urgent':
                return {
                    className: 'border-red-500 bg-red-50 dark:bg-red-950/20 text-red-900 dark:text-red-100',
                    icon: <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />,
                }
            case 'high':
                return {
                    className: 'border-orange-500 bg-orange-50 dark:bg-orange-950/20 text-orange-900 dark:text-orange-100',
                    icon: <Megaphone className="h-5 w-5 text-orange-600 dark:text-orange-400" />,
                }
            case 'normal':
                return {
                    className: 'border-blue-500 bg-blue-50 dark:bg-blue-950/20 text-blue-900 dark:text-blue-100',
                    icon: <Info className="h-5 w-5 text-blue-600 dark:text-blue-400" />,
                }
            case 'low':
                return {
                    className: 'border-gray-500 bg-gray-50 dark:bg-gray-950/20 text-gray-900 dark:text-gray-100',
                    icon: <Info className="h-5 w-5 text-gray-600 dark:text-gray-400" />,
                }
            default:
                return {
                    className: 'border-blue-500 bg-blue-50 dark:bg-blue-950/20 text-blue-900 dark:text-blue-100',
                    icon: <Info className="h-5 w-5 text-blue-600 dark:text-blue-400" />,
                }
        }
    }

    return (
        <div className="w-full px-4 py-2 space-y-2">
            {visibleAnnouncements.map((announcement) => {
                const { className, icon } = getPriorityStyles(announcement.priority)

                return (
                    <div key={announcement.id} className={`relative ${className} rounded-lg border p-4`}>
                        <div className="flex items-start gap-3">
                            <div className="shrink-0 mt-0.5">{icon}</div>
                            <div className="flex-1">
                                <div className="font-semibold text-base mb-1">{announcement.title}</div>
                                <div className="text-sm">{announcement.content}</div>
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 shrink-0"
                                onClick={() => handleDismiss(announcement.id)}
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                )
            })}
        </div>
    )
}
