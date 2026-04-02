'use client'

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { mockUsers, type User } from './mock-data'

interface AuthContextType {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  signup: (data: { full_name: string; email: string; phone?: string; password: string }) => Promise<{ success: boolean; error?: string }>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const login = useCallback(async (email: string, _password: string) => {
    setIsLoading(true)
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 800))
    
    // Mock authentication - find user by email
    const foundUser = mockUsers.find(u => u.email.toLowerCase() === email.toLowerCase())
    
    if (foundUser) {
      setUser(foundUser)
      setIsLoading(false)
      return { success: true }
    }
    
    setIsLoading(false)
    return { success: false, error: 'Invalid email or password' }
  }, [])

  const signup = useCallback(async (data: { full_name: string; email: string; phone?: string; password: string }) => {
    setIsLoading(true)
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 800))
    
    // Check if email already exists
    const existingUser = mockUsers.find(u => u.email.toLowerCase() === data.email.toLowerCase())
    
    if (existingUser) {
      setIsLoading(false)
      return { success: false, error: 'Email already registered' }
    }
    
    // Create new mock user
    const newUser: User = {
      id: `user-${Date.now()}`,
      full_name: data.full_name,
      email: data.email,
      phone: data.phone,
      is_admin: false,
      is_active: true,
    }
    
    // Add to mock users (in real app, this would be an API call)
    mockUsers.push(newUser)
    setUser(newUser)
    setIsLoading(false)
    
    return { success: true }
  }, [])

  const logout = useCallback(() => {
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
