'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Header } from '@/components/landing/header'
import { HeroSection } from '@/components/landing/hero-section'
import { FeaturesSection } from '@/components/landing/features-section'
import { Footer } from '@/components/landing/footer'
import { ProjectSelectionModal } from '@/components/project-selection-modal'
import { useAuth } from '@/lib/auth-context'

export default function HomePage() {
  const router = useRouter()
  const { isAuthenticated } = useAuth()
  const [projectModalOpen, setProjectModalOpen] = useState(false)

  const handleOpenDashboard = () => {
    if (isAuthenticated) {
      router.push('/dashboard')
    } else {
      router.push('/login')
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header onOpenDashboard={handleOpenDashboard} />
      <main className="flex-1">
        <HeroSection 
          onOpenDashboard={handleOpenDashboard} 
          isAuthenticated={isAuthenticated} 
        />
        <FeaturesSection />
      </main>
      <Footer />
      
      {/* Project Selection Modal */}
      <ProjectSelectionModal 
        open={projectModalOpen} 
        onOpenChange={setProjectModalOpen} 
      />
    </div>
  )
}
