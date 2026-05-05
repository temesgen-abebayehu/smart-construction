'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { ThemeProvider } from 'next-themes'
import { useAuth } from '@/lib/auth-context'

export function UserThemeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [storageKey, setStorageKey] = useState('theme')

  useEffect(() => {
    if (user?.id) {
      setStorageKey(`theme-${user.id}`)
    } else {
      setStorageKey('theme')
    }
  }, [user?.id])

  return (
    <ThemeProvider
      key={storageKey}
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      storageKey={storageKey}
    >
      {children}
    </ThemeProvider>
  )
}
