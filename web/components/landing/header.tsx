'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Building2, Menu, X } from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '@/lib/auth-context'

interface HeaderProps {
  onOpenDashboard: () => void
}

export function Header({ onOpenDashboard }: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { isAuthenticated, user, logout } = useAuth()

  return (
    <header className="bg-primary text-primary-foreground sticky top-0 z-50">
      <nav className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <Building2 className="h-8 w-8" />
            <span className="font-bold text-xl">ConstructPro</span>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            <Link href="#features" className="text-sm text-primary-foreground/80 hover:text-primary-foreground transition-colors">
              Features
            </Link>
            <Link href="#about" className="text-sm text-primary-foreground/80 hover:text-primary-foreground transition-colors">
              About
            </Link>
            <Link href="#contact" className="text-sm text-primary-foreground/80 hover:text-primary-foreground transition-colors">
              Contact
            </Link>
          </div>

          {/* Auth Buttons */}
          <div className="hidden md:flex items-center gap-4">
            {isAuthenticated ? (
              <>
                <span className="text-sm text-primary-foreground/80 max-w-[180px] truncate inline-block">
                  Welcome, {user?.full_name}
                </span>
                <Button 
                  variant="secondary" 
                  size="sm"
                  onClick={onOpenDashboard}
                >
                  Open Dashboard
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
                  onClick={logout}
                >
                  Logout
                </Button>
              </>
            ) : (
              <>
                <Link href="/login">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
                  >
                    Login
                  </Button>
                </Link>
                <Link href="/signup">
                  <Button variant="secondary" size="sm">
                    Sign Up
                  </Button>
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-primary-foreground/20">
            <div className="flex flex-col gap-4">
              <Link 
                href="#features" 
                className="text-sm text-primary-foreground/80 hover:text-primary-foreground"
                onClick={() => setMobileMenuOpen(false)}
              >
                Features
              </Link>
              <Link 
                href="#about" 
                className="text-sm text-primary-foreground/80 hover:text-primary-foreground"
                onClick={() => setMobileMenuOpen(false)}
              >
                About
              </Link>
              <Link 
                href="#contact" 
                className="text-sm text-primary-foreground/80 hover:text-primary-foreground"
                onClick={() => setMobileMenuOpen(false)}
              >
                Contact
              </Link>
              <div className="flex gap-2 pt-4 border-t border-primary-foreground/20">
                {isAuthenticated ? (
                  <>
                    <Button 
                      variant="secondary" 
                      size="sm"
                      className="flex-1"
                      onClick={() => {
                        onOpenDashboard()
                        setMobileMenuOpen(false)
                      }}
                    >
                      Open Dashboard
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      className="text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
                      onClick={() => {
                        logout()
                        setMobileMenuOpen(false)
                      }}
                    >
                      Logout
                    </Button>
                  </>
                ) : (
                  <>
                    <Link href="/login" className="flex-1">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        className="w-full text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
                      >
                        Login
                      </Button>
                    </Link>
                    <Link href="/signup" className="flex-1">
                      <Button variant="secondary" size="sm" className="w-full">
                        Sign Up
                      </Button>
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </nav>
    </header>
  )
}
