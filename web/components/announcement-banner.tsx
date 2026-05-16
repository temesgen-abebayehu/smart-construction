'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { listAnnouncements } from '@/lib/api'
import type { AnnouncementItem } from '@/lib/api-types'

export function AnnouncementBanner() {
    const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([])
    const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set())
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        let cancelled = false
            ; (async () => {
                try {
                    const data = await listAnnouncements()
                    if (!cancelled) setAnnouncements(data)
                } catch {
                    // silent
                } finally {
                    if (!cancelled) setLoading(false)
                }
            })()
        return () => { cancelled = true }
    }, [])

    const visibleAnnouncements = announcements.filter((a) => !dismissedIds.has(a.id))

    if (loading || visibleAnnouncements.length === 0) return null

    const accentColor = (priority: string) => {
        switch (priority) {
            case 'urgent': return 'border-l-red-500 bg-red-50 text-red-900 dark:bg-red-950/30 dark:text-red-100'
            case 'high': return 'border-l-orange-500 bg-orange-50 text-orange-900 dark:bg-orange-950/30 dark:text-orange-100'
            case 'low': return 'border-l-slate-400 bg-slate-50 text-slate-700 dark:bg-slate-900/40 dark:text-slate-300'
            default: return 'border-l-blue-500 bg-blue-50 text-blue-900 dark:bg-blue-950/30 dark:text-blue-100'
        }
    }

    return (
        <div className="w-full space-y-px">
            {visibleAnnouncements.map((a) => (
                <div key={a.id} className={`flex items-center justify-between border-l-4 px-4 py-1.5 text-sm ${accentColor(a.priority)}`}>
                    <p className="font-semibold leading-snug">{a.content}</p>
                    <button
                        type="button"
                        aria-label="Dismiss"
                        className="ml-4 shrink-0 opacity-60 hover:opacity-100 transition-opacity"
                        onClick={() => setDismissedIds((prev) => new Set([...prev, a.id]))}
                    >
                        <X className="h-3.5 w-3.5" />
                    </button>
                </div>
            ))}
        </div>
    )
}
