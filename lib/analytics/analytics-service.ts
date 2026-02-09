import { supabase } from '@/lib/core/supabase/client'

/**
 * Analytics Service
 * Track page views, user activities, and platform metrics
 */

export interface PageView {
  id: string
  userId?: string
  sessionId: string
  pagePath: string
  pageTitle?: string
  referrer?: string
  userAgent?: string
  ipAddress?: string
  createdAt: string
}

export interface ActivityEvent {
  id: string
  userId?: string
  eventType: string
  eventData?: Record<string, any>
  ipAddress?: string
  createdAt: string
}

export interface DailyMetrics {
  metricDate: string
  totalUsers: number
  newUsers: number
  activeUsers: number
  returningUsers: number
  totalThreads: number
  totalMessages: number
  totalLikes: number
  totalGroups: number
  totalDirectMessages: number
  totalRevenue: number
  totalPurchases: number
  totalPageViews: number
  uniqueVisitors: number
  avgSessionDuration: number
}

export interface PlatformStats {
  totalUsers: number
  activeToday: number
  totalThreads: number
  totalMessages: number
  totalGroups: number
  totalPageViewsToday: number
}

export interface UserActivitySummary {
  totalThreads: number
  totalMessages: number
  totalLikesGiven: number
  totalLikesReceived: number
  groupsJoined: number
  lastActive: string
}

/**
 * Track page view
 */
export const trackPageView = async (
  pagePath: string,
  options?: {
    pageTitle?: string
    referrer?: string
    sessionId?: string
  }
): Promise<{ success: boolean; error: string | null }> => {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    
    // Generate session ID if not provided
    const sessionId = options?.sessionId || getOrCreateSessionId()

    const { error } = await supabase.rpc('track_page_view', {
      p_user_id: user?.id || null,
      p_session_id: sessionId,
      p_page_path: pagePath,
      p_page_title: options?.pageTitle,
      p_referrer: options?.referrer,
      p_user_agent: navigator.userAgent,
      p_ip_address: null, // IP will be captured server-side
    })

    if (error) throw error

    return { success: true, error: null }
  } catch (error: any) {
    console.error('Track page view error:', error)
    return { success: false, error: error.message || 'Failed to track page view' }
  }
}

/**
 * Track activity event
 */
export const trackActivity = async (
  eventType: string,
  eventData?: Record<string, any>
): Promise<{ success: boolean; error: string | null }> => {
  try {
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'User not authenticated' }
    }

    const { error } = await supabase.rpc('track_activity', {
      p_user_id: user.id,
      p_event_type: eventType,
      p_event_data: eventData || {},
      p_ip_address: null,
    })

    if (error) throw error

    return { success: true, error: null }
  } catch (error: any) {
    console.error('Track activity error:', error)
    return { success: false, error: error.message || 'Failed to track activity' }
  }
}

/**
 * Get platform stats
 */
export const fetchPlatformStats = async (): Promise<{
  data: PlatformStats | null
  error: string | null
}> => {
  try {
    const { data, error } = await supabase
      .rpc('get_platform_stats')
      .single()

    if (error) throw error

    return { data: data as unknown as PlatformStats, error: null }
  } catch (error: any) {
    console.error('Fetch platform stats error:', error)
    return { data: null, error: error.message || 'Failed to fetch stats' }
  }
}

/**
 * Get daily metrics
 */
export const fetchDailyMetrics = async (
  days: number = 30
): Promise<{
  data: DailyMetrics[]
  error: string | null
}> => {
  try {
    const { data, error } = await supabase
      .from('daily_metrics')
      .select('*')
      .order('metric_date', { ascending: false })
      .limit(days)

    if (error) throw error

    return { data: data || [], error: null }
  } catch (error: any) {
    console.error('Fetch daily metrics error:', error)
    return { data: [], error: error.message || 'Failed to fetch metrics' }
  }
}

/**
 * Get user activity summary
 */
export const fetchUserActivitySummary = async (
  userId?: string
): Promise<{
  data: UserActivitySummary | null
  error: string | null
}> => {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    const targetUserId = userId || user?.id

    if (!targetUserId) {
      return { data: null, error: 'User not authenticated' }
    }

    const { data, error } = await supabase
      .rpc('get_user_activity_summary', { p_user_id: targetUserId })
      .single()

    if (error) throw error

    return { data: data as unknown as UserActivitySummary, error: null }
  } catch (error: any) {
    console.error('Fetch user activity summary error:', error)
    return { data: null, error: error.message || 'Failed to fetch summary' }
  }
}

/**
 * Get activity events
 */
export const fetchActivityEvents = async (
  options?: {
    userId?: string
    eventType?: string
    limit?: number
    offset?: number
  }
): Promise<{
  data: ActivityEvent[]
  error: string | null
}> => {
  try {
    let query = supabase
      .from('activity_events')
      .select('*')
      .order('created_at', { ascending: false })

    if (options?.userId) {
      query = query.eq('user_id', options.userId)
    }

    if (options?.eventType) {
      query = query.eq('event_type', options.eventType)
    }

    if (options?.limit) {
      query = query.limit(options.limit)
    }

    if (options?.offset) {
      query = query.range(
        options.offset,
        options.offset + (options.limit || 50) - 1
      )
    }

    const { data, error } = await query

    if (error) throw error

    return { data: data || [], error: null }
  } catch (error: any) {
    console.error('Fetch activity events error:', error)
    return { data: [], error: error.message || 'Failed to fetch events' }
  }
}

/**
 * Get page views
 */
export const fetchPageViews = async (
  options?: {
    userId?: string
    pagePath?: string
    sessionId?: string
    limit?: number
    offset?: number
  }
): Promise<{
  data: PageView[]
  error: string | null
}> => {
  try {
    let query = supabase
      .from('page_views')
      .select('*')
      .order('created_at', { ascending: false })

    if (options?.userId) {
      query = query.eq('user_id', options.userId)
    }

    if (options?.pagePath) {
      query = query.eq('page_path', options.pagePath)
    }

    if (options?.sessionId) {
      query = query.eq('session_id', options.sessionId)
    }

    if (options?.limit) {
      query = query.limit(options.limit)
    }

    if (options?.offset) {
      query = query.range(
        options.offset,
        options.offset + (options.limit || 50) - 1
      )
    }

    const { data, error } = await query

    if (error) throw error

    return { data: data || [], error: null }
  } catch (error: any) {
    console.error('Fetch page views error:', error)
    return { data: [], error: error.message || 'Failed to fetch page views' }
  }
}

/**
 * Get top pages
 */
export const fetchTopPages = async (
  days: number = 7,
  limit: number = 10
): Promise<{
  data: Array<{ page_path: string; view_count: number }>
  error: string | null
}> => {
  try {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - days)

    const { data, error } = await supabase
      .from('page_views')
      .select('page_path')
      .gte('created_at', cutoffDate.toISOString())

    if (error) throw error

    // Count page views
    const pageCounts: Record<string, number> = {}
    data?.forEach((view) => {
      pageCounts[view.page_path] = (pageCounts[view.page_path] || 0) + 1
    })

    // Sort and limit
    const topPages = Object.entries(pageCounts)
      .map(([page_path, view_count]) => ({ page_path, view_count }))
      .sort((a, b) => b.view_count - a.view_count)
      .slice(0, limit)

    return { data: topPages, error: null }
  } catch (error: any) {
    console.error('Fetch top pages error:', error)
    return { data: [], error: error.message || 'Failed to fetch top pages' }
  }
}

/**
 * Session ID management
 */
const SESSION_ID_KEY = 'whisprspace_session_id'

export const getOrCreateSessionId = (): string => {
  if (typeof window === 'undefined') return 'server'

  let sessionId = sessionStorage.getItem(SESSION_ID_KEY)
  
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    sessionStorage.setItem(SESSION_ID_KEY, sessionId)
  }

  return sessionId
}

/**
 * Update daily metrics (typically run server-side)
 */
export const updateDailyMetrics = async (
  date?: string
): Promise<{ success: boolean; error: string | null }> => {
  try {
    const { error } = await supabase.rpc('update_daily_metrics', {
      p_date: date || new Date().toISOString().split('T')[0],
    })

    if (error) throw error

    return { success: true, error: null }
  } catch (error: any) {
    console.error('Update daily metrics error:', error)
    return { success: false, error: error.message || 'Failed to update metrics' }
  }
}
