'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/lib/auth-context'
import { Loader2, BarChart3, TrendingUp, FileText, Download, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function AdminReportsPage() {
    const router = useRouter()
    const { user, isAuthenticated, isLoading: authLoading } = useAuth()

    useEffect(() => {
        if (!authLoading && !isAuthenticated) {
            router.push('/login')
        }
        if (!authLoading && isAuthenticated && !user?.is_admin) {
            router.push('/dashboard')
        }
    }, [authLoading, isAuthenticated, user, router])

    if (authLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    if (!isAuthenticated || !user?.is_admin) return null

    return (
        <div className="p-8 space-y-8">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => router.push('/dashboard')}>
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">System Reports</h1>
                    <p className="text-muted-foreground mt-2">Generate and view system-wide reports</p>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Card className="cursor-pointer hover:shadow-lg transition-shadow">
                    <CardHeader>
                        <BarChart3 className="h-8 w-8 text-primary mb-2" />
                        <CardTitle>Platform Analytics</CardTitle>
                        <CardDescription>User activity, project metrics, and system usage</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-muted-foreground">Coming soon</p>
                    </CardContent>
                </Card>

                <Card className="cursor-pointer hover:shadow-lg transition-shadow">
                    <CardHeader>
                        <TrendingUp className="h-8 w-8 text-primary mb-2" />
                        <CardTitle>Performance Reports</CardTitle>
                        <CardDescription>Project completion rates, budget utilization, delays</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-muted-foreground">Coming soon</p>
                    </CardContent>
                </Card>

                <Card className="cursor-pointer hover:shadow-lg transition-shadow">
                    <CardHeader>
                        <FileText className="h-8 w-8 text-primary mb-2" />
                        <CardTitle>Financial Reports</CardTitle>
                        <CardDescription>Budget summaries, payments, and financial analytics</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-muted-foreground">Coming soon</p>
                    </CardContent>
                </Card>

                <Card className="cursor-pointer hover:shadow-lg transition-shadow">
                    <CardHeader>
                        <Download className="h-8 w-8 text-primary mb-2" />
                        <CardTitle>Export Data</CardTitle>
                        <CardDescription>Export system data in various formats (CSV, PDF, Excel)</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-muted-foreground">Coming soon</p>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Report Generation</CardTitle>
                    <CardDescription>
                        Advanced reporting features are under development. You can currently generate project-specific
                        reports from individual project pages.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground">
                        System-wide reporting capabilities will be available in a future update.
                    </p>
                </CardContent>
            </Card>
        </div>
    )
}
