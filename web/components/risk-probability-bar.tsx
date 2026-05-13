'use client'

interface RiskProbabilityBarProps {
    probabilities: {
        low: number
        medium: number
        high: number
        critical: number
    }
}

export function RiskProbabilityBar({ probabilities }: RiskProbabilityBarProps) {
    const total = probabilities.low + probabilities.medium + probabilities.high + probabilities.critical

    // Normalize to percentages
    const lowPct = (probabilities.low / total) * 100
    const mediumPct = (probabilities.medium / total) * 100
    const highPct = (probabilities.high / total) * 100
    const criticalPct = (probabilities.critical / total) * 100

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Risk Probability Distribution</span>
                <span className="text-xs text-muted-foreground">How close to each risk level</span>
            </div>

            {/* Stacked Bar */}
            <div className="flex h-8 w-full overflow-hidden rounded-lg border">
                {lowPct > 0 && (
                    <div
                        className="flex items-center justify-center bg-green-500 text-xs font-medium text-white transition-all hover:opacity-90"
                        style={{ width: `${lowPct}%` }}
                        title={`Low: ${lowPct.toFixed(1)}%`}
                    >
                        {lowPct > 8 && `${lowPct.toFixed(0)}%`}
                    </div>
                )}
                {mediumPct > 0 && (
                    <div
                        className="flex items-center justify-center bg-yellow-500 text-xs font-medium text-white transition-all hover:opacity-90"
                        style={{ width: `${mediumPct}%` }}
                        title={`Medium: ${mediumPct.toFixed(1)}%`}
                    >
                        {mediumPct > 8 && `${mediumPct.toFixed(0)}%`}
                    </div>
                )}
                {highPct > 0 && (
                    <div
                        className="flex items-center justify-center bg-orange-500 text-xs font-medium text-white transition-all hover:opacity-90"
                        style={{ width: `${highPct}%` }}
                        title={`High: ${highPct.toFixed(1)}%`}
                    >
                        {highPct > 8 && `${highPct.toFixed(0)}%`}
                    </div>
                )}
                {criticalPct > 0 && (
                    <div
                        className="flex items-center justify-center bg-red-600 text-xs font-medium text-white transition-all hover:opacity-90"
                        style={{ width: `${criticalPct}%` }}
                        title={`Critical: ${criticalPct.toFixed(1)}%`}
                    >
                        {criticalPct > 8 && `${criticalPct.toFixed(0)}%`}
                    </div>
                )}
            </div>

            {/* Legend */}
            <div className="grid grid-cols-4 gap-2 text-xs">
                <div className="flex items-center gap-1.5">
                    <div className="h-3 w-3 rounded-sm bg-green-500" />
                    <span className="text-muted-foreground">Low {lowPct.toFixed(0)}%</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="h-3 w-3 rounded-sm bg-yellow-500" />
                    <span className="text-muted-foreground">Med {mediumPct.toFixed(0)}%</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="h-3 w-3 rounded-sm bg-orange-500" />
                    <span className="text-muted-foreground">High {highPct.toFixed(0)}%</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="h-3 w-3 rounded-sm bg-red-600" />
                    <span className="text-muted-foreground">Crit {criticalPct.toFixed(0)}%</span>
                </div>
            </div>
        </div>
    )
}
