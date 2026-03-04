import * as rawDb from '@/lib/core/supabase/raw-db'
import * as rawAuth from '@/lib/core/supabase/raw-auth'
import {
  sanitizeEnumValue,
  sanitizeHttpUrl,
  sanitizeMultilineInput,
  sanitizeSingleLineInput,
  sanitizeUuid,
} from '@/lib/security/input-sanitization'

/**
 * Group Service
 * Handles all group-related operations
 */

export interface GroupData {
  id?: string
  name: string
  description?: string
  privacy: 'public' | 'private' | 'invite_only'
  maxMembers?: number
  currentMembers?: number
  avatar?: string
  bannerUrl?: string
  rules?: string
  creatorId?: string
  createdAt?: string
  updatedAt?: string
}

export interface GroupMember {
  groupId: string
  userId: string
  role: 'admin' | 'moderator' | 'member'
  joinedAt: string
  user?: {
    id: string
    anonymousId: string
    avatarUrl?: string
  }
}

export interface GroupInvite {
  id: string
  groupId: string
  code: string
  createdBy: string
  maxUses?: number
  currentUses: number
  expiresAt?: string
  createdAt: string
}

const GROUP_PRIVACY_VALUES = ['public', 'private', 'invite_only'] as const
const GROUP_ROLE_VALUES = ['admin', 'moderator', 'member'] as const

/**
 * Create a new group
 */
export const createGroup = async (
  groupData: Omit<GroupData, 'id' | 'creatorId' | 'createdAt' | 'updatedAt' | 'currentMembers'>
): Promise<{ data: GroupData | null; error: string | null }> => {
  try {
    const session = rawAuth.getSession()
    const user = session?.user

    if (!user) {
      return { data: null, error: 'User not authenticated' }
    }

    const safeName = sanitizeSingleLineInput(groupData.name, { maxLength: 80 })
    if (!safeName) {
      return { data: null, error: 'Group name is required' }
    }

    const safeDescription = groupData.description
      ? sanitizeMultilineInput(groupData.description, { maxLength: 2000 })
      : null
    const safePrivacy = sanitizeEnumValue(groupData.privacy, GROUP_PRIVACY_VALUES, 'public')
    const maxMembersRaw = Number(groupData.maxMembers)
    const safeMaxMembers =
      Number.isFinite(maxMembersRaw) && maxMembersRaw > 1
        ? Math.min(10000, Math.floor(maxMembersRaw))
        : 100
    const safeAvatar = groupData.avatar
      ? sanitizeHttpUrl(groupData.avatar, { maxLength: 2048 })
      : null
    const safeBannerUrl = groupData.bannerUrl
      ? sanitizeHttpUrl(groupData.bannerUrl, { maxLength: 2048 })
      : null
    const safeRules = groupData.rules
      ? sanitizeMultilineInput(groupData.rules, { maxLength: 5000 })
      : null

    // Create the group
    const { data: groupDataResult, error: groupError } = await rawDb.insert('groups', {
      name: safeName,
      description: safeDescription,
      privacy: safePrivacy,
      max_members: safeMaxMembers,
      avatar: safeAvatar,
      banner_url: safeBannerUrl,
      rules: safeRules,
      creator_id: user.id,
    }, { returning: true })

    if (groupError) {
      throw new Error(groupError.message)
    }

    const group = groupDataResult?.[0]
    if (!group) throw new Error('Group creation failed - no data returned')

    // Add creator as admin member
    const { error: memberError } = await rawDb.insert('group_members', {
      group_id: group.id,
      user_id: user.id,
      role: 'admin',
    }, { returning: false })

    if (memberError) {
      // Rollback: delete the group if member addition fails
      await rawDb.remove('groups', { 'id': rawDb.filter.eq(group.id) })
      throw new Error(memberError.message)
    }

    return { data: group, error: null }
  } catch (error: any) {
    console.error('Create group error:', error)
    return { data: null, error: error.message || 'Failed to create group' }
  }
}

/**
 * Fetch groups (with optional filters)
 */
export const fetchGroups = async (
  filters?: {
    privacy?: 'public' | 'private' | 'invite_only'
    searchTerm?: string
    limit?: number
    offset?: number
  }
): Promise<{ data: GroupData[]; error: string | null }> => {
  try {
    const rawFilters: Record<string, string> = {}
    
    // Apply filters
    if (filters?.privacy) {
      const safePrivacy = sanitizeEnumValue(filters.privacy, GROUP_PRIVACY_VALUES, 'public')
      rawFilters['privacy'] = `eq.${safePrivacy}`
    }

    if (filters?.searchTerm) {
      const safeSearch = sanitizeSingleLineInput(filters.searchTerm, { maxLength: 120 })
        .replace(/[^a-zA-Z0-9\s_-]/g, '')
        .trim()
      if (safeSearch) {
        rawFilters['or'] = `(name.ilike.*${safeSearch}*,description.ilike.*${safeSearch}*)`
      }
    }

    const { data, error } = await rawDb.select<any>('groups', {
      select: '*',
      filters: rawFilters,
      order: { column: 'created_at', ascending: false },
      limit: filters?.limit || 20,
      offset: filters?.offset || 0,
    })

    if (error) {
      throw new Error(error.message)
    }

    return { data: (data as any) || [], error: null }
  } catch (error: any) {
    console.error('Fetch groups error:', error)
    return { data: [], error: error.message || 'Failed to fetch groups' }
  }
}

/**
 * Fetch a single group by ID
 */
export const fetchGroupById = async (
  groupId: string
): Promise<{ data: GroupData | null; error: string | null }> => {
  try {
    const safeGroupId = sanitizeUuid(groupId)
    if (!safeGroupId) {
      return { data: null, error: 'Invalid group reference' }
    }

    const { data, error } = await rawDb.select<any>('groups', {
      select: '*',
      filters: { 'id': rawDb.filter.eq(safeGroupId) },
      single: true,
    })

    if (error) {
      throw new Error(error.message)
    }

    return { data: (data as any) || null, error: null }
  } catch (error: any) {
    console.error('Fetch group error:', error)
    return { data: null, error: error.message || 'Failed to fetch group' }
  }
}

/**
 * Update group details
 */
export const updateGroup = async (
  groupId: string,
  updates: Partial<Omit<GroupData, 'id' | 'creatorId' | 'createdAt' | 'updatedAt'>>
): Promise<{ data: GroupData | null; error: string | null }> => {
  try {
    const safeGroupId = sanitizeUuid(groupId)
    if (!safeGroupId) {
      return { data: null, error: 'Invalid group reference' }
    }

    const dbUpdates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    if (updates.name !== undefined) {
      const safeName = sanitizeSingleLineInput(updates.name, { maxLength: 80 })
      if (!safeName) {
        return { data: null, error: 'Group name is required' }
      }
      dbUpdates.name = safeName
    }

    if (updates.description !== undefined) {
      dbUpdates.description = updates.description
        ? sanitizeMultilineInput(updates.description, { maxLength: 2000 })
        : null
    }

    if (updates.privacy !== undefined) {
      dbUpdates.privacy = sanitizeEnumValue(updates.privacy, GROUP_PRIVACY_VALUES, 'public')
    }

    if (updates.maxMembers !== undefined) {
      const maxMembersRaw = Number(updates.maxMembers)
      dbUpdates.max_members =
        Number.isFinite(maxMembersRaw) && maxMembersRaw > 1
          ? Math.min(10000, Math.floor(maxMembersRaw))
          : null
    }

    if (updates.avatar !== undefined) {
      dbUpdates.avatar = updates.avatar
        ? sanitizeHttpUrl(updates.avatar, { maxLength: 2048 })
        : null
    }

    if (updates.bannerUrl !== undefined) {
      dbUpdates.banner_url = updates.bannerUrl
        ? sanitizeHttpUrl(updates.bannerUrl, { maxLength: 2048 })
        : null
    }

    if (updates.rules !== undefined) {
      dbUpdates.rules = updates.rules
        ? sanitizeMultilineInput(updates.rules, { maxLength: 5000 })
        : null
    }

    const { data: updated, error } = await rawDb.update<GroupData>('groups', {
      ...dbUpdates,
    }, {
      'id': rawDb.filter.eq(safeGroupId)
    }, { returning: true })

    if (error) {
      throw new Error(error.message)
    }

    const group = updated?.[0] || null
    return { data: group, error: null }
  } catch (error: any) {
    console.error('Update group error:', error)
    return { data: null, error: error.message || 'Failed to update group' }
  }
}

/**
 * Delete a group (only creator/admin)
 */
export const deleteGroup = async (
  groupId: string
): Promise<{ success: boolean; error: string | null }> => {
  try {
    const safeGroupId = sanitizeUuid(groupId)
    if (!safeGroupId) {
      return { success: false, error: 'Invalid group reference' }
    }

    const { error } = await rawDb.remove('groups', {
      'id': rawDb.filter.eq(safeGroupId)
    })

    if (error) {
      throw new Error(error.message)
    }

    return { success: true, error: null }
  } catch (error: any) {
    console.error('Delete group error:', error)
    return { success: false, error: error.message || 'Failed to delete group' }
  }
}

/**
 * Join a group
 */
export const joinGroup = async (
  groupId: string,
  inviteCode?: string
): Promise<{ success: boolean; error: string | null }> => {
  try {
    const safeGroupId = sanitizeUuid(groupId)
    if (!safeGroupId) {
      return { success: false, error: 'Invalid group reference' }
    }

    const session = rawAuth.getSession()
    const user = session?.user

    if (!user) {
      return { success: false, error: 'User not authenticated' }
    }

    // Fetch group to check privacy
    const { data, error: groupError } = await rawDb.select<any>('groups', {
      select: '*, invites:group_invites(*)',
      filters: { 'id': rawDb.filter.eq(safeGroupId) },
      single: true,
    })

    const group = data as any

    if (groupError || !group) {
      return { success: false, error: 'Group not found' }
    }

    // Check if group is full
    if (group.current_members >= group.max_members) {
      return { success: false, error: 'Group is full' }
    }

    // Verify invite code for private/invite-only groups
    if (group.privacy === 'private' || group.privacy === 'invite_only') {
      if (!inviteCode) {
        return { success: false, error: 'Invite code required' }
      }

      const safeInviteCode = sanitizeSingleLineInput(inviteCode, { maxLength: 64 }).toUpperCase()
      // Note: invites might be array or null depending on join
      const invites = Array.isArray(group.invites) ? group.invites : []
      const validInvite = invites.find((inv: any) => {
        const notExpired = !inv.expires_at || new Date(inv.expires_at) > new Date()
        const hasUses = !inv.max_uses || inv.current_uses < inv.max_uses
        return inv.code === safeInviteCode && notExpired && hasUses
      })

      if (!validInvite) {
        return { success: false, error: 'Invalid or expired invite code' }
      }

      // Increment invite usage
      await rawDb.update('group_invites', {
        current_uses: validInvite.current_uses + 1
      }, {
        'id': rawDb.filter.eq(validInvite.id)
      }, { returning: false })
    }

    // Add member
    const { error: memberError } = await rawDb.insert('group_members', {
      group_id: safeGroupId,
      user_id: user.id,
      role: 'member',
    }, { returning: false })

    if (memberError) {
      throw new Error(memberError.message)
    }

    // Increment group member count
    await rawDb.rpc('increment_group_members', { group_id: safeGroupId })

    return { success: true, error: null }
  } catch (error: any) {
    console.error('Join group error:', error)
    return { success: false, error: error.message || 'Failed to join group' }
  }
}

/**
 * Leave a group
 */
export const leaveGroup = async (
  groupId: string
): Promise<{ success: boolean; error: string | null }> => {
  try {
    const safeGroupId = sanitizeUuid(groupId)
    if (!safeGroupId) {
      return { success: false, error: 'Invalid group reference' }
    }

    const session = rawAuth.getSession()
    const user = session?.user

    if (!user) {
      return { success: false, error: 'User not authenticated' }
    }

    // Check if user is the creator
    const { data } = await rawDb.select<any>('groups', {
      select: 'creator_id',
      filters: { 'id': rawDb.filter.eq(safeGroupId) },
      single: true,
    })

    const group = data as any

    if (group?.creator_id === user.id) {
      return { success: false, error: 'Group creator cannot leave. Transfer ownership or delete the group.' }
    }

    const { error } = await rawDb.remove('group_members', {
      'group_id': rawDb.filter.eq(safeGroupId),
      'user_id': rawDb.filter.eq(user.id)
    })

    if (error) {
      throw new Error(error.message)
    }

    // Decrement group member count
    await rawDb.rpc('decrement_group_members', { group_id: safeGroupId })

    return { success: true, error: null }
  } catch (error: any) {
    console.error('Leave group error:', error)
    return { success: false, error: error.message || 'Failed to leave group' }
  }
}

/**
 * Fetch group members
 */
export const fetchGroupMembers = async (
  groupId: string
): Promise<{ data: GroupMember[]; error: string | null }> => {
  try {
    const safeGroupId = sanitizeUuid(groupId)
    if (!safeGroupId) {
      return { data: [], error: 'Invalid group reference' }
    }

    const { data, error } = await rawDb.select<any>('group_members', {
      select: '*, user:users(id, anonymous_id, avatar_url)',
      filters: { 'group_id': rawDb.filter.eq(safeGroupId) },
      order: { column: 'joined_at', ascending: false }
    })

    if (error) {
      throw new Error(error.message)
    }

    return { data: (data as any) || [], error: null }
  } catch (error: any) {
    console.error('Fetch group members error:', error)
    return { data: [], error: error.message || 'Failed to fetch members' }
  }
}

/**
 * Update member role (admin/moderator only)
 */
export const updateMemberRole = async (
  groupId: string,
  userId: string,
  newRole: 'admin' | 'moderator' | 'member'
): Promise<{ success: boolean; error: string | null }> => {
  try {
    const safeGroupId = sanitizeUuid(groupId)
    const safeUserId = sanitizeUuid(userId)
    if (!safeGroupId || !safeUserId) {
      return { success: false, error: 'Invalid group or user reference' }
    }

    const safeRole = sanitizeEnumValue(newRole, GROUP_ROLE_VALUES, 'member')

    const { error } = await rawDb.update('group_members', { role: safeRole }, {
      'group_id': rawDb.filter.eq(safeGroupId),
      'user_id': rawDb.filter.eq(safeUserId)
    }, { returning: false })

    if (error) {
      throw new Error(error.message)
    }

    return { success: true, error: null }
  } catch (error: any) {
    console.error('Update member role error:', error)
    return { success: false, error: error.message || 'Failed to update role' }
  }
}

/**
 * Remove member from group (admin/moderator only)
 */
export const removeMember = async (
  groupId: string,
  userId: string
): Promise<{ success: boolean; error: string | null }> => {
  try {
    const safeGroupId = sanitizeUuid(groupId)
    const safeUserId = sanitizeUuid(userId)
    if (!safeGroupId || !safeUserId) {
      return { success: false, error: 'Invalid group or user reference' }
    }

    const { error } = await rawDb.remove('group_members', {
      'group_id': rawDb.filter.eq(safeGroupId),
      'user_id': rawDb.filter.eq(safeUserId)
    })

    if (error) {
      throw new Error(error.message)
    }

    // Decrement member count
    await rawDb.rpc('decrement_group_members', { group_id: safeGroupId })

    return { success: true, error: null }
  } catch (error: any) {
    console.error('Remove member error:', error)
    return { success: false, error: error.message || 'Failed to remove member' }
  }
}

/**
 * Generate invite code
 */
export const generateInviteCode = async (
  groupId: string,
  options?: {
    maxUses?: number
    expiresInDays?: number
  }
): Promise<{ data: GroupInvite | null; error: string | null }> => {
  try {
    const safeGroupId = sanitizeUuid(groupId)
    if (!safeGroupId) {
      return { data: null, error: 'Invalid group reference' }
    }

    const session = rawAuth.getSession()
    const user = session?.user

    if (!user) {
      return { data: null, error: 'User not authenticated' }
    }

    // Generate random code
    const code = Math.random().toString(36).substring(2, 10).toUpperCase()

    const expiresInDaysRaw = Number(options?.expiresInDays)
    const safeExpiresInDays =
      Number.isFinite(expiresInDaysRaw) && expiresInDaysRaw > 0
        ? Math.min(365, Math.floor(expiresInDaysRaw))
        : null
    const maxUsesRaw = Number(options?.maxUses)
    const safeMaxUses =
      Number.isFinite(maxUsesRaw) && maxUsesRaw > 0
        ? Math.min(10000, Math.floor(maxUsesRaw))
        : null

    const expiresAt = safeExpiresInDays
      ? new Date(Date.now() + safeExpiresInDays * 24 * 60 * 60 * 1000).toISOString()
      : null

    const { data, error } = await rawDb.insert('group_invites', {
      group_id: safeGroupId,
      code,
      created_by: user.id,
      max_uses: safeMaxUses,
      expires_at: expiresAt,
    }, { returning: true })

    if (error) {
      throw new Error(error.message)
    }

    const invite = data?.[0] || null
    return { data: invite, error: null }
  } catch (error: any) {
    console.error('Generate invite code error:', error)
    return { data: null, error: error.message || 'Failed to generate invite code' }
  }
}

/**
 * Fetch group invites
 */
export const fetchGroupInvites = async (
  groupId: string
): Promise<{ data: GroupInvite[]; error: string | null }> => {
  try {
    const safeGroupId = sanitizeUuid(groupId)
    if (!safeGroupId) {
      return { data: [], error: 'Invalid group reference' }
    }

    const { data, error } = await rawDb.select<any>('group_invites', {
      select: '*',
      filters: { 'group_id': rawDb.filter.eq(safeGroupId) },
      order: { column: 'created_at', ascending: false }
    })

    if (error) {
      throw new Error(error.message)
    }

    return { data: (data as any) || [], error: null }
  } catch (error: any) {
    console.error('Fetch group invites error:', error)
    return { data: [], error: error.message || 'Failed to fetch invites' }
  }
}

/**
 * Delete invite code
 */
export const deleteInviteCode = async (
  inviteId: string
): Promise<{ success: boolean; error: string | null }> => {
  try {
    const safeInviteId = sanitizeUuid(inviteId)
    if (!safeInviteId) {
      return { success: false, error: 'Invalid invite reference' }
    }

    const { error } = await rawDb.remove('group_invites', {
      'id': rawDb.filter.eq(safeInviteId)
    })

    if (error) {
      throw new Error(error.message)
    }

    return { success: true, error: null }
  } catch (error: any) {
    console.error('Delete invite code error:', error)
    return { success: false, error: error.message || 'Failed to delete invite code' }
  }
}

/**
 * Check if user is member of group
 */
export const isGroupMember = async (
  groupId: string,
  userId?: string
): Promise<boolean> => {
  try {
    const safeGroupId = sanitizeUuid(groupId)
    if (!safeGroupId) return false

    if (!userId) {
      const session = rawAuth.getSession()
      if (!session?.user) return false
      userId = session.user.id
    }

    const safeUserId = sanitizeUuid(userId)
    if (!safeUserId) return false

    const { data, error } = await rawDb.select<any>('group_members', {
      select: 'group_id',
      filters: {
        'group_id': rawDb.filter.eq(safeGroupId),
        'user_id': rawDb.filter.eq(safeUserId)
      },
      single: true
    })

    return !error && !!data
  } catch (error) {
    return false
  }
}

/**
 * Get user's groups
 */
export const fetchUserGroups = async (): Promise<{ data: GroupData[]; error: string | null }> => {
  try {
    const session = rawAuth.getSession()
    const user = session?.user

    if (!user) {
      return { data: [], error: 'User not authenticated' }
    }

    const { data, error } = await rawDb.select<any[]>('group_members', {
      select: 'group:groups(*)',
      filters: { 'user_id': rawDb.filter.eq(user.id) }
    })

    if (error) {
      throw new Error(error.message)
    }

    const groups = data?.map((item: any) => item.group).filter(Boolean) || []

    return { data: groups, error: null }
  } catch (error: any) {
    console.error('Fetch user groups error:', error)
    return { data: [], error: error.message || 'Failed to fetch user groups' }
  }
}
