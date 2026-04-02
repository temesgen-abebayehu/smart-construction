import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ClipboardList, Users, BarChart3, Shield, Clock, Zap } from 'lucide-react'

const features = [
  {
    icon: ClipboardList,
    title: 'Daily Log Management',
    description: 'Submit and track daily work logs with multi-level approval workflow from site engineers to project managers.',
  },
  {
    icon: Users,
    title: 'Role-Based Access',
    description: 'Granular permissions for Project Managers, Office Engineers, Consultants, and Site Engineers.',
  },
  {
    icon: BarChart3,
    title: 'Real-Time Analytics',
    description: 'Monitor project progress, budget utilization, and resource allocation with interactive dashboards.',
  },
  {
    icon: Shield,
    title: 'Risk Prediction',
    description: 'AI-powered risk assessment to identify potential delays and budget overruns before they happen.',
  },
  {
    icon: Clock,
    title: 'Weather Integration',
    description: 'Automatic weather data capture for each shift to track environmental impacts on productivity.',
  },
  {
    icon: Zap,
    title: 'Instant Notifications',
    description: 'Stay informed with real-time alerts for log approvals, task assignments, and project updates.',
  },
]

export function FeaturesSection() {
  return (
    <section className="py-20 bg-background">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl text-foreground">
            Everything You Need to Manage Construction Projects
          </h2>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            From daily logs to budget tracking, our platform provides all the tools you need for efficient project management.
          </p>
        </div>
        
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, index) => (
            <Card key={index} className="border-border hover:border-accent/50 transition-colors">
              <CardHeader>
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <feature.icon className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-lg">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-muted-foreground leading-relaxed">
                  {feature.description}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
