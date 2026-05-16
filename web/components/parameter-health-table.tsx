'use client'

import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'

interface ParameterHealthTableProps {
    features: {
        temperature?: number | null
        humidity?: number | null
        material_usage?: number | null
        machinery_status?: number | null
        worker_count?: number | null
        task_progress?: number | null
        cost_deviation?: number | null
        time_deviation?: number | null
        equipment_utilization_rate?: number | null
    }
}

interface ParameterRow {
    name: string
    current: string
    healthy: string
    status: 'ok' | 'warning' | 'critical'
    deviation?: string
}

function getStatusIcon(status: 'ok' | 'warning' | 'critical') {
    switch (status) {
        case 'ok':
            return <CheckCircle2 className="h-4 w-4 text-green-600" />
        case 'warning':
            return <AlertTriangle className="h-4 w-4 text-amber-600" />
        case 'critical':
            return <XCircle className="h-4 w-4 text-red-600" />
    }
}

function getStatusBadge(status: 'ok' | 'warning' | 'critical') {
    switch (status) {
        case 'ok':
            return 'bg-green-100 text-green-700'
        case 'warning':
            return 'bg-amber-100 text-amber-700'
        case 'critical':
            return 'bg-red-100 text-red-700'
    }
}

export function ParameterHealthTable({ features }: ParameterHealthTableProps) {
    const parameters: ParameterRow[] = []
    const taskProgress = features.task_progress || 0
    let criticalCount = 0
    let warningCount = 0

    // Only show relevant parameters based on project stage

    // 1. Task Progress - context-aware thresholds
    if (features.task_progress != null) {
        const val = features.task_progress
        let status: 'ok' | 'warning' | 'critical'
        let healthy: string
        let deviation: string

        if (val < 10) {
            // Early stage - don't judge harshly
            status = 'ok'
            healthy = 'Early stage'
            deviation = 'Project starting'
        } else if (val < 30) {
            status = val >= 15 ? 'ok' : 'warning'
            healthy = '≥15% expected'
            deviation = val >= 15 ? 'On track' : 'Slow start'
        } else {
            status = val >= 50 ? 'ok' : val >= 30 ? 'warning' : 'critical'
            healthy = '≥50% expected'
            deviation = val >= 50 ? 'On track' : 'Behind'
        }

        parameters.push({
            name: 'Task Progress',
            current: `${val.toFixed(1)}%`,
            healthy,
            status,
            deviation,
        })
    }

    // 2. Cost Deviation - always relevant
    if (features.cost_deviation != null) {
        const val = features.cost_deviation
        const status = Math.abs(val) <= 10 ? 'ok' : Math.abs(val) <= 20 ? 'warning' : 'critical'
        parameters.push({
            name: 'Budget Performance',
            current: `${val.toFixed(1)}%`,
            healthy: '±10%',
            status,
            deviation: val > 0 ? 'Over budget' : val < -5 ? 'Under budget' : 'On budget',
        })
    }

    // 3. Schedule Deviation - always relevant
    if (features.time_deviation != null) {
        const val = features.time_deviation * 100
        const status = val <= 5 ? 'ok' : val <= 15 ? 'warning' : 'critical'
        parameters.push({
            name: 'Schedule Performance',
            current: `${val.toFixed(1)}%`,
            healthy: '≤5%',
            status,
            deviation: val > 5 ? 'Behind schedule' : 'On schedule',
        })
    }

    // 4. Equipment Utilization - only if equipment is in use
    if (features.equipment_utilization_rate != null && features.equipment_utilization_rate > 0) {
        const val = features.equipment_utilization_rate
        const status = val >= 65 ? 'ok' : val >= 45 ? 'warning' : 'critical'
        parameters.push({
            name: 'Equipment Utilization',
            current: `${val.toFixed(0)}%`,
            healthy: '≥65%',
            status,
            deviation: val >= 65 ? 'Efficient' : 'High idle time',
        })
    }

    // 5. Worker Count - only if project is active (>10% progress)
    if (features.worker_count != null && taskProgress > 10) {
        const val = features.worker_count
        const status = val >= 5 ? 'ok' : val >= 2 ? 'warning' : 'critical'
        parameters.push({
            name: 'Labor Force',
            current: `${val.toFixed(0)} workers`,
            healthy: '≥5 workers',
            status,
            deviation: val >= 5 ? 'Adequate' : 'Understaffed',
        })
    }

    // 6. Material Consumption - stage-aware consumption signal
    if (features.material_usage != null) {
        const val = features.material_usage
        const status = val < 20 ? 'warning' : val <= 150 ? 'ok' : 'critical'
        parameters.push({
            name: 'Material Consumption',
            current: `${val.toFixed(0)} units/log`,
            healthy: '20-150 units/log',
            status,
            deviation: val < 20 ? 'Low material flow' : val > 150 ? 'Heavy consumption' : 'Normal',
        })
    }

    // 7. Machinery Status - execution-stage readiness
    if (features.machinery_status != null) {
        const val = features.machinery_status
        const active = val === 1
        const status = active ? 'ok' : taskProgress > 15 ? 'critical' : 'warning'
        parameters.push({
            name: 'Machinery Availability',
            current: active ? 'Active' : 'Idle / unavailable',
            healthy: 'Active during execution',
            status,
            deviation: active ? 'Ready for work' : 'May slow production',
        })
    }

    // 8. Weather - informational only, never critical
    if (features.temperature != null) {
        const val = features.temperature
        const tooHot = val > 35
        const tooCold = val < 10
        const status = (tooHot || tooCold) ? 'warning' : 'ok'
        parameters.push({
            name: 'Temperature',
            current: `${val.toFixed(1)}°C`,
            healthy: '10-35°C',
            status,
            deviation: tooHot ? 'Hot conditions' : tooCold ? 'Cold conditions' : 'Normal',
        })
    }

    if (features.humidity != null) {
        const val = features.humidity
        const tooHigh = val > 85
        const tooLow = val < 20
        const status = (tooHigh || tooLow) ? 'warning' : 'ok'
        parameters.push({
            name: 'Humidity',
            current: `${val.toFixed(0)}%`,
            healthy: '20-85%',
            status,
            deviation: tooHigh ? 'High humidity' : tooLow ? 'Low humidity' : 'Normal',
        })
    }

    for (const param of parameters) {
        if (param.status === 'critical') criticalCount += 1
        if (param.status === 'warning') warningCount += 1
    }

    if (parameters.length === 0) {
        return (
            <div className="rounded-lg border bg-muted/30 p-8 text-center">
                <p className="text-sm text-muted-foreground">
                    Insufficient data for analysis. Submit daily logs to see parameter health.
                </p>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            <div className="rounded-lg border bg-card p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <p className="text-sm font-semibold">Parameter Health Summary</p>
                        <p className="text-xs text-muted-foreground">
                            Derived from the current ML feature set and adjusted for the project stage.
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs">
                        <span className="rounded-full bg-green-100 px-3 py-1 font-medium text-green-700">
                            {parameters.length - warningCount - criticalCount} Healthy
                        </span>
                        <span className="rounded-full bg-amber-100 px-3 py-1 font-medium text-amber-700">
                            {warningCount} Watch
                        </span>
                        <span className="rounded-full bg-red-100 px-3 py-1 font-medium text-red-700">
                            {criticalCount} Critical
                        </span>
                    </div>
                </div>
            </div>

            <div className="rounded-lg border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Parameter</TableHead>
                        <TableHead>Current Value</TableHead>
                        <TableHead>Healthy Range</TableHead>
                        <TableHead>Assessment</TableHead>
                        <TableHead className="text-center">Status</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {parameters.map((param) => (
                        <TableRow key={param.name}>
                            <TableCell className="font-medium">{param.name}</TableCell>
                            <TableCell>{param.current}</TableCell>
                            <TableCell className="text-muted-foreground">{param.healthy}</TableCell>
                            <TableCell className="text-muted-foreground">{param.deviation || '—'}</TableCell>
                            <TableCell className="text-center">
                                <div className="flex items-center justify-center gap-2">
                                    {getStatusIcon(param.status)}
                                    <span className={`text-xs font-medium px-2 py-1 rounded ${getStatusBadge(param.status)}`}>
                                        {param.status.toUpperCase()}
                                    </span>
                                </div>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
            </div>
        </div>
    )
}
