import { supabase } from '@/lib/core/supabase/client'

/**
 * Admin Service
 * Manage users, content, moderation, and platform settings
 */

export interface AdminUser {
  userId: string
  role: 'super_admin' | 'admin' | 'moderator'
  permissions: Record<string, any>
  assignedBy?: string
  assignedAt: string
}

export interface ContentReport {
  id: string
  reporterId?: string
  reportedUserId?: string
  contentType: 'thread' | 'message' | 'user' | 'group'
  contentId: string
  reason: string
  description?: string
  status: 'pending' | 'reviewing' | 'resolved' | 'dismissed'
  reviewedBy?: string
  reviewedAt?: string
  actionTaken?: string
  createdAt: string
}

export interface ModerationAction {
  id: string
  moderatorId?: string
  targetUserId?: string
  action: 'warning' | 'content_delete' | 'user_suspend' | 'user_ban' | 'content_restore'
  reason: string
  contentType?: string
  contentId?: string
  durationDays?: number
  expiresAt?: string
  createdAt: string
}

export interface BannedUser {
  userId: string
  bannedBy?: string
  reason: string
  isPermanent: boolean
  expiresAt?: string
  createdAt: string
}

/**
 * Check if current user is admin
 */
export const isAdmin = async (): Promise<boolean> => {
  try {
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return false

    const { data, error } = await supabase
      .from('admin_users')
      .select('role')
      .eq('user_id', user.id)
      .single()

    return !error && data !== null
  } catch {
    return false
  }
}

/**
 * Get current user's admin role
 */
export const getAdminRole = async (): Promise<{
  role: string | null
  error: string | null
}> => {
  try {
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return { role: null, error: 'User not authenticated' }
    }

    const { data, error } = await supabase
      .from('admin_users')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (error) throw error

    return { role: data.role, error: null }
  } catch (error: any) {
    return { role: null, error: error.message || 'Failed to get admin role' }
  }
}

/**
 * Get all users (admin only)
 */
export const fetchAllUsers = async (
  options?: {
    limit?: number
    offset?: number
    search?: string
  }
): Promise<{
  data: any[]
  error: string | null
}> => {
  try {
    let query = supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false })

    if (options?.search) {
      query = query.or(`anonymous_id.ilike.%${options.search}%,email.ilike.%${options.search}%`)
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
    console.error('Fetch all users error:', error)
    return { data: [], error: error.message || 'Failed to fetch users' }
  }
}

/**
 * Get content reports
 */
export const fetchContentReports = async (
  options?: {
    status?: string
    contentType?: string
    limit?: number
    offset?: number
  }
): Promise<{
  data: ContentReport[]
  error: string | null
}> => {
  try {
    let query = supabase
      .from('content_reports')
      .select('*')
      .order('created_at', { ascending: false })

    if (options?.status) {
      query = query.eq('status', options.status)
    }

    if (options?.contentType) {
      query = query.eq('content_type', options.contentType)
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
    console.error('Fetch content reports error:', error)
    return { data: [], error: error.message || 'Failed to fetch reports' }
  }
}

/**
 * Create content report
 */
export const createContentReport = async (
  contentType: 'thread' | 'message' | 'user' | 'group',
  contentId: string,
  reportedUserId: string,
  reason: string,
  description?: string
): Promise<{ success: boolean; error: string | null }> => {
  try {
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'User not authenticated' }
    }

    const { error } = await supabase
      .from('content_reports')
      .insert({
        reporter_id: user.id,
        reported_user_id: reportedUserId,
        content_type: contentType,
        content_id: contentId,
        reason,
        description,
      })

    if (error) throw error

    return { success: true, error: null }
  } catch (error: any) {
    console.error('Create content report error:', error)
    return { success: false, error: error.message || 'Failed to create report' }
  }
}

/**
 * Update content report status
 */
export const updateReportStatus = async (
  reportId: string,
  status: 'reviewing' | 'resolved' | 'dismissed',
  actionTaken?: string
): Promise<{ success: boolean; error: string | null }> => {
  try {
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'User not authenticated' }
    }

    const { error } = await supabase
      .from('content_reports')
      .update({
        status,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        action_taken: actionTaken,
      })
      .eq('id', reportId)

    if (error) throw error

    return { success: true, error: null }
  } catch (error: any) {
    console.error('Update report status error:', error)
    return { success: false, error: error.message || 'Failed to update report' }
  }
}

/**
 * Create moderation action
 */
export const createModerationAction = async (
  targetUserId: string,
  action: 'warning' | 'content_delete' | 'user_suspend' | 'user_ban' | 'content_restore',
  reason: string,
  options?: {
    contentType?: string
    contentId?: string
    durationDays?: number
  }
): Promise<{ success: boolean; error: string | null }> => {
  try {
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'User not authenticated' }
    }

    const expiresAt = options?.durationDays
      ? new Date(Date.now() + options.durationDays * 24 * 60 * 60 * 1000).toISOString()
      : null

    const { error } = await supabase
      .from('moderation_actions')
      .insert({
        moderator_id: user.id,
        target_user_id: targetUserId,
        action,
        reason,
        content_type: options?.contentType,
        content_id: options?.contentId,
        duration_days: options?.durationDays,
        expires_at: expiresAt,
      })

    if (error) throw error

    return { success: true, error: null }
  } catch (error: any) {
    console.error('Create moderation action error:', error)
    return { success: false, error: error.message || 'Failed to create action' }
  }
}

/**
 * Ban user
 */
export const banUser = async (
  targetUserId: string,
  reason: string,
  isPermanent: boolean = false,
  durationDays?: number
): Promise<{ success: boolean; error: string | null }> => {
  try {
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'User not authenticated' }
    }

    const expiresAt = !isPermanent && durationDays
      ? new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString()
      : null

    // Insert ban record
    const { error: banError } = await supabase
      .from('banned_users')
      .insert({
        user_id: targetUserId,
        banned_by: user.id,
        reason,
        is_permanent: isPermanent,
        expires_at: expiresAt,
      })

    if (banError) throw banError

    // Create moderation action record
    await createModerationAction(
      targetUserId,
      'user_ban',
      reason,
      { durationDays }
    )

    return { success: true, error: null }
  } catch (error: any) {
    console.error('Ban user error:', error)
    return { success: false, error: error.message || 'Failed to ban user' }
  }
}

/**
 * Unban user
 */
export const unbanUser = async (
  userId: string
): Promise<{ success: boolean; error: string | null }> => {
  try {
    const { error } = await supabase
      .from('banned_users')
      .delete()
      .eq('user_id', userId)

    if (error) throw error

    return { success: true, error: null }
  } catch (error: any) {
    console.error('Unban user error:', error)
    return { success: false, error: error.message || 'Failed to unban user' }
  }
}

/**
 * Check if user is banned
 */
export const checkUserBanned = async (
  userId: string
): Promise<{ isBanned: boolean; error: string | null }> => {
  try {
    const { data, error } = await supabase
      .rpc('is_user_banned', { p_user_id: userId })

    if (error) throw error

    return { isBanned: data === true, error: null }
  } catch (error: any) {
    console.error('Check user banned error:', error)
    return { isBanned: false, error: error.message || 'Failed to check ban status' }
  }
}

/**
 * Get banned users
 */
export const fetchBannedUsers = async (): Promise<{
  data: BannedUser[]
  error: string | null
}> => {
  try {
    const { data, error } = await supabase
      .from('banned_users')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error

    return { data: data || [], error: null }
  } catch (error: any) {
    console.error('Fetch banned users error:', error)
    return { data: [], error: error.message || 'Failed to fetch banned users' }
  }
}

/**
 * Get moderation actions
 */
export const fetchModerationActions = async (
  options?: {
    targetUserId?: string
    limit?: number
    offset?: number
  }
): Promise<{
  data: ModerationAction[]
  error: string | null
}> => {
  try {
    let query = supabase
      .from('moderation_actions')
      .select('*')
      .order('created_at', { ascending: false })

    if (options?.targetUserId) {
      query = query.eq('target_user_id', options.targetUserId)
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
    console.error('Fetch moderation actions error:', error)
    return { data: [], error: error.message || 'Failed to fetch actions' }
  }
}

/**
 * Delete content
 */
export const deleteContent = async (
  contentType: 'thread' | 'message',
  contentId: string,
  reason: string
): Promise<{ success: boolean; error: string | null }> => {
  try {
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'User not authenticated' }
    }

    const table = contentType === 'thread' ? 'threads' : 'messages'

    // Soft delete
    const { error } = await supabase
      .from(table)
      .update({ is_deleted: true })
      .eq('id', contentId)

    if (error) throw error

    // Get content owner
    const { data: content } = await supabase
      .from(table)
      .select('creator_id, sender_id')
      .eq('id', contentId)
      .single()

    const targetUserId = content?.creator_id || content?.sender_id

    if (targetUserId) {
      await createModerationAction(
        targetUserId,
        'content_delete',
        reason,
        { contentType, contentId }
      )
    }

    return { success: true, error: null }
  } catch (error: any) {
    console.error('Delete content error:', error)
    return { success: false, error: error.message || 'Failed to delete content' }
  }
}

/**
 * Check content for bad words
 */
export const checkContentBadWords = async (
  content: string
): Promise<{
  hasBadWords: boolean
  matchedWords: string[]
  error: string | null
}> => {
  try {
    const { data, error } = await supabase
      .rpc('check_bad_words', { p_content: content })
      .single()

    if (error) throw error

    return {
      hasBadWords: data.has_bad_words,
      matchedWords: data.matched_words || [],
      error: null,
    }
  } catch (error: any) {
    console.error('Check bad words error:', error)
    return {
      hasBadWords: false,
      matchedWords: [],
      error: error.message || 'Failed to check bad words',
    }
  }
}

/**
 * Add bad word
 */
export const addBadWord = async (
  word: string,
  severity: string = 'medium'
): Promise<{ success: boolean; error: string | null }> => {
  try {
    const { error } = await supabase
      .from('bad_words')
      .insert({ word: word.toLowerCase(), severity })

    if (error) throw error

    return { success: true, error: null }
  } catch (error: any) {
    console.error('Add bad word error:', error)
    return { success: false, error: error.message || 'Failed to add bad word' }
  }
}

/**
 * Remove bad word
 */
export const removeBadWord = async (
  wordId: string
): Promise<{ success: boolean; error: string | null }> => {
  try {
    const { error } = await supabase
      .from('bad_words')
      .delete()
      .eq('id', wordId)

    if (error) throw error

    return { success: true, error: null }
  } catch (error: any) {
    console.error('Remove bad word error:', error)
    return { success: false, error: error.message || 'Failed to remove bad word' }
  }
}

/**
 * Get bad words list
 */
export const fetchBadWords = async (): Promise<{
  data: Array<{ id: string; word: string; severity: string; isActive: boolean }>
  error: string | null
}> => {
  try {
    const { data, error } = await supabase
      .from('bad_words')
      .select('*')
      .order('word', { ascending: true })

    if (error) throw error

    return { data: data || [], error: null }
  } catch (error: any) {
    console.error('Fetch bad words error:', error)
    return { data: [], error: error.message || 'Failed to fetch bad words' }
  }
}
