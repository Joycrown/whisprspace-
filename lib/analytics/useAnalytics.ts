import { useState, useEffect, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import {
  trackPageView as trackPageViewService,
  fetchPlatformStats,
  fetchDailyMetrics,
  fetchUserActivitySummary,
  fetchActivityEvents,
  PlatformStats,
  DailyMetrics,
  UserActivitySummary,
  ActivityEvent,
} from './analytics-service'

/**
 * Hook to automatically track page views
 */
export const usePageTracking = () => {
  const pathname = usePathname()

  useEffect(() => {
    if (pathname) {
      trackPageViewService(pathname, {
        pageTitle: document.title,
        referrer: document.referrer,
      })
    }
  }, [pathname])
}

/**
 * Hook for platform statistics
 */
export const usePlatformStats = () => {
  const [stats, setStats] = useState<PlatformStats | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadStats = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    const { data, error: err } = await fetchPlatformStats()

    if (err) {
      setError(err)
    } else {
      setStats(data)
    }

    setIsLoading(false)
  }, [])

  useEffect(() => {
    loadStats()
  }, [loadStats])

  return {
    stats,
    isLoading,
    error,
    refreshStats: loadStats,
  }
}

/**
 * Hook for daily metrics
 */
export const useDailyMetrics = (days: number = 30) => {
  const [metrics, setMetrics] = useState<DailyMetrics[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadMetrics = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    const { data, error: err } = await fetchDailyMetrics(days)

    if (err) {
      setError(err)
    } else {
      setMetrics(data)
    }

    setIsLoading(false)
  }, [days])

  useEffect(() => {
    loadMetrics()
  }, [loadMetrics])

  return {
    metrics,
    isLoading,
    error,
    refreshMetrics: loadMetrics,
  }
}

/**
 * Hook for user activity summary
 */
export const useUserActivitySummary = (userId?: string) => {
  const [summary, setSummary] = useState<UserActivitySummary | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadSummary = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    const { data, error: err } = await fetchUserActivitySummary(userId)

    if (err) {
      setError(err)
    } else {
      setSummary(data)
    }

    setIsLoading(false)
  }, [userId])

  useEffect(() => {
    loadSummary()
  }, [loadSummary])

  return {
    summary,
    isLoading,
    error,
    refreshSummary: loadSummary,
  }
}

/**
 * Hook for activity events
 */
export const useActivityEvents = (
  options?: {
    userId?: string
    eventType?: string
    limit?: number
  }
) => {
  const [events, setEvents] = useState<ActivityEvent[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadEvents = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    const { data, error: err } = await fetchActivityEvents(options)

    if (err) {
      setError(err)
    } else {
      setEvents(data)
    }

    setIsLoading(false)
  }, [options])

  useEffect(() => {
    loadEvents()
  }, [loadEvents])

  return {
    events,
    isLoading,
    error,
    refreshEvents: loadEvents,
  }
}
