'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import type { AuthUser } from './domain'
import { clearTokens, setTokens, getAccessToken } from './auth-storage'
import {
  fetchCurrentUser,
  loginRequest,
  logoutRequest,
  registerRequest,
} from './api-client'

interface AuthContextType {
  user: AuthUser | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  signup: (data: {
    full_name: string
    email: string
    phone_number?: string
    password: string
  }) => Promise<{ success: boolean; error?: string }>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

function mapUser(me: {
  id: string
  full_name: string
  email: string
  phone_number?: string | null
  is_admin: boolean
  is_active: boolean
  created_at?: string | null
  updated_at?: string | null
}): AuthUser {
  return {
    id: me.id,
    full_name: me.full_name,
    email: me.email,
    phone_number: me.phone_number ?? undefined,
    is_admin: me.is_admin,
    is_active: me.is_active,
    created_at: me.created_at ?? undefined,
    updated_at: me.updated_at ?? undefined,
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const refreshUser = useCallback(async () => {
    const token = getAccessToken()
    if (!token) {
      setUser(null)
      return
    }
    try {
      const me = await fetchCurrentUser()
      setUser(mapUser(me))
    } catch {
      clearTokens()
      setUser(null)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setIsLoading(true)
      try {
        const token = getAccessToken()
        if (!token) {
          if (!cancelled) setUser(null)
          return
        }
        const me = await fetchCurrentUser()
        if (!cancelled) setUser(mapUser(me))
      } catch {
        clearTokens()
        if (!cancelled) setUser(null)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true)
    try {
      const tokens = await loginRequest(email, password)
      setTokens(tokens.access_token, tokens.refresh_token)
      const me = await fetchCurrentUser()
      setUser(mapUser(me))
      return { success: true as const }
    } catch (e) {
      clearTokens()
      setUser(null)
      return {
        success: false as const,
        error: e instanceof Error ? e.message : 'Login failed',
      }
    } finally {
      setIsLoading(false)
    }
  }, [])

  const signup = useCallback(
    async (data: {
      full_name: string
      email: string
      phone?: string
      password: string
    }) => {
      setIsLoading(true)
      try {
        await registerRequest(data)
        return { success: true as const }
      } catch (e) {
        return {
          success: false as const,
          error: e instanceof Error ? e.message : 'Registration failed',
        }
      } finally {
        setIsLoading(false)
      }
    },
    [],
  )

  const logout = useCallback(async () => {
    await logoutRequest()
    clearTokens()
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        signup,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
