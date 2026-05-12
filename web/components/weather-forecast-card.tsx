'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
    CloudSun,
    Droplets,
    Wind,
    Thermometer,
    ChevronDown,
    ChevronUp,
    Cloud,
    CloudRain,
    CloudSnow,
    Sun,
    CloudDrizzle,
} from 'lucide-react'
import type { WeatherResponse } from '@/lib/api-types'

interface WeatherForecastCardProps {
    weather: WeatherResponse
    projectLocation: string
}

// WMO Weather interpretation codes
// https://open-meteo.com/en/docs
const getWeatherIcon = (code: number | null) => {
    if (code === null) return <Cloud className="h-5 w-5" />

    if (code === 0) return <Sun className="h-5 w-5 text-yellow-500" />
    if (code <= 3) return <Cloud className="h-5 w-5 text-gray-500" />
    if (code <= 48) return <CloudDrizzle className="h-5 w-5 text-blue-400" />
    if (code <= 67) return <CloudRain className="h-5 w-5 text-blue-600" />
    if (code <= 77) return <CloudSnow className="h-5 w-5 text-blue-300" />
    if (code <= 99) return <CloudRain className="h-5 w-5 text-blue-700" />

    return <Cloud className="h-5 w-5" />
}

const getWeatherDescription = (code: number | null): string => {
    if (code === null) return 'Unknown'

    if (code === 0) return 'Clear sky'
    if (code === 1) return 'Mainly clear'
    if (code === 2) return 'Partly cloudy'
    if (code === 3) return 'Overcast'
    if (code <= 48) return 'Foggy'
    if (code <= 57) return 'Drizzle'
    if (code <= 67) return 'Rain'
    if (code <= 77) return 'Snow'
    if (code <= 82) return 'Rain showers'
    if (code <= 86) return 'Snow showers'
    if (code <= 99) return 'Thunderstorm'

    return 'Unknown'
}

export function WeatherForecastCard({ weather, projectLocation }: WeatherForecastCardProps) {
    const [expanded, setExpanded] = useState(false)

    const hasForecast = weather.forecast && weather.forecast.length > 0
    const displayForecast = hasForecast ? weather.forecast.slice(0, 7) : []

    return (
        <Card className="shadow-sm">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-base flex items-center gap-2">
                            <CloudSun className="h-5 w-5 text-sky-600" />
                            Site Weather
                        </CardTitle>
                        <CardDescription className="mt-1">
                            {weather.resolved_location || weather.location || projectLocation}
                        </CardDescription>
                    </div>
                    {hasForecast && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setExpanded(!expanded)}
                            className="gap-1"
                        >
                            {expanded ? (
                                <>
                                    Hide Forecast <ChevronUp className="h-4 w-4" />
                                </>
                            ) : (
                                <>
                                    7-Day Forecast <ChevronDown className="h-4 w-4" />
                                </>
                            )}
                        </Button>
                    )}
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Current Weather */}
                <div className="flex items-center justify-between rounded-lg border bg-gradient-to-br from-sky-50 to-blue-50 dark:from-sky-950/30 dark:to-blue-950/30 p-4">
                    <div className="flex items-center gap-4">
                        <div className="rounded-lg bg-white/80 dark:bg-gray-800/80 p-3">
                            <CloudSun className="h-8 w-8 text-sky-600" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-muted-foreground">Current Conditions</p>
                            <p className="text-2xl font-bold">
                                {weather.temperature != null ? `${weather.temperature.toFixed(1)}°C` : 'N/A'}
                            </p>
                        </div>
                    </div>
                    <div className="space-y-2 text-right">
                        {weather.humidity != null && (
                            <div className="flex items-center gap-2 text-sm">
                                <Droplets className="h-4 w-4 text-blue-500" />
                                <span className="font-medium">{weather.humidity.toFixed(0)}% Humidity</span>
                            </div>
                        )}
                        {weather.fetched_at && (
                            <p className="text-xs text-muted-foreground">
                                Updated {new Date(weather.fetched_at).toLocaleTimeString()}
                            </p>
                        )}
                    </div>
                </div>

                {/* 7-Day Forecast */}
                {expanded && hasForecast && (
                    <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                        <p className="text-sm font-medium text-muted-foreground">7-Day Forecast</p>
                        <div className="grid gap-2">
                            {displayForecast.map((day, index) => {
                                const date = new Date(day.date)
                                const dayName = index === 0
                                    ? 'Today'
                                    : index === 1
                                        ? 'Tomorrow'
                                        : date.toLocaleDateString('en-US', { weekday: 'short' })
                                const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

                                return (
                                    <div
                                        key={day.date}
                                        className="flex items-center justify-between rounded-lg border bg-card p-3 hover:bg-muted/50 transition-colors"
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="shrink-0">
                                                {getWeatherIcon(day.weather_code)}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="font-medium text-sm">{dayName}</p>
                                                <p className="text-xs text-muted-foreground">{dateStr}</p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-4 shrink-0">
                                            <div className="text-right">
                                                <div className="flex items-center gap-1 text-sm">
                                                    <Thermometer className="h-3.5 w-3.5 text-orange-500" />
                                                    <span className="font-medium">
                                                        {day.temperature_max != null ? `${day.temperature_max.toFixed(0)}°` : 'N/A'}
                                                    </span>
                                                    <span className="text-muted-foreground">/</span>
                                                    <span className="text-muted-foreground">
                                                        {day.temperature_min != null ? `${day.temperature_min.toFixed(0)}°` : 'N/A'}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-muted-foreground">
                                                    {getWeatherDescription(day.weather_code)}
                                                </p>
                                            </div>

                                            {(day.precipitation_sum != null && day.precipitation_sum > 0) && (
                                                <div className="flex items-center gap-1 text-xs text-blue-600">
                                                    <Droplets className="h-3.5 w-3.5" />
                                                    <span>{day.precipitation_sum.toFixed(1)}mm</span>
                                                </div>
                                            )}

                                            {day.wind_speed_max != null && (
                                                <div className="flex items-center gap-1 text-xs text-gray-600">
                                                    <Wind className="h-3.5 w-3.5" />
                                                    <span>{day.wind_speed_max.toFixed(0)} km/h</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}

                {!hasForecast && (
                    <p className="text-sm text-muted-foreground text-center py-2">
                        Forecast data not available
                    </p>
                )}
            </CardContent>
        </Card>
    )
}
