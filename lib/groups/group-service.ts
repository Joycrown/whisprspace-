import * as rawDb from '@/lib/core/supabase/raw-db'
import * as rawAuth from '@/lib/core/supabase/raw-auth'

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

    // Create the group
    const { data: groupDataResult, error: groupError } = await rawDb.insert('groups', {
      name: groupData.name,
      description: groupData.description,
      privacy: groupData.privacy,
      max_members: groupData.maxMembers || 100,
      avatar: groupData.avatar,
      banner_url: groupData.bannerUrl,
      rules: groupData.rules,
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
      rawFilters['privacy'] = `eq.${filters.privacy}`
    }

    if (filters?.searchTerm) {
      rawFilters['or'] = `(name.ilike.*${filters.searchTerm}*,description.ilike.*${filters.searchTerm}*)`
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
    const { data, error } = await rawDb.select<any>('groups', {
      select: '*',
      filters: { 'id': rawDb.filter.eq(groupId) },
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
    const { data: updated, error } = await rawDb.update<GroupData>('groups', {
      ...updates,
      updated_at: new Date().toISOString(),
    }, {
      'id': rawDb.filter.eq(groupId)
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
    const { error } = await rawDb.remove('groups', {
      'id': rawDb.filter.eq(groupId)
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
    const session = rawAuth.getSession()
    const user = session?.user

    if (!user) {
      return { success: false, error: 'User not authenticated' }
    }

    // Fetch group to check privacy
    const { data, error: groupError } = await rawDb.select<any>('groups', {
      select: '*, invites:group_invites(*)',
      filters: { 'id': rawDb.filter.eq(groupId) },
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

      // Note: invites might be array or null depending on join
      const invites = Array.isArray(group.invites) ? group.invites : []
      const validInvite = invites.find((inv: any) => {
        const notExpired = !inv.expires_at || new Date(inv.expires_at) > new Date()
        const hasUses = !inv.max_uses || inv.current_uses < inv.max_uses
        return inv.code === inviteCode && notExpired && hasUses
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
      group_id: groupId,
      user_id: user.id,
      role: 'member',
    }, { returning: false })

    if (memberError) {
      throw new Error(memberError.message)
    }

    // Increment group member count
    await rawDb.rpc('increment_group_members', { group_id: groupId })

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
    const session = rawAuth.getSession()
    const user = session?.user

    if (!user) {
      return { success: false, error: 'User not authenticated' }
    }

    // Check if user is the creator
    const { data } = await rawDb.select<any>('groups', {
      select: 'creator_id',
      filters: { 'id': rawDb.filter.eq(groupId) },
      single: true,
    })

    const group = data as any

    if (group?.creator_id === user.id) {
      return { success: false, error: 'Group creator cannot leave. Transfer ownership or delete the group.' }
    }

    const { error } = await rawDb.remove('group_members', {
      'group_id': rawDb.filter.eq(groupId),
      'user_id': rawDb.filter.eq(user.id)
    })

    if (error) {
      throw new Error(error.message)
    }

    // Decrement group member count
    await rawDb.rpc('decrement_group_members', { group_id: groupId })

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
    const { data, error } = await rawDb.select<any>('group_members', {
      select: '*, user:users(id, anonymous_id, avatar_url)',
      filters: { 'group_id': rawDb.filter.eq(groupId) },
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
    const { error } = await rawDb.update('group_members', { role: newRole }, {
      'group_id': rawDb.filter.eq(groupId),
      'user_id': rawDb.filter.eq(userId)
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
    const { error } = await rawDb.remove('group_members', {
      'group_id': rawDb.filter.eq(groupId),
      'user_id': rawDb.filter.eq(userId)
    })

    if (error) {
      throw new Error(error.message)
    }

    // Decrement member count
    await rawDb.rpc('decrement_group_members', { group_id: groupId })

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
    const session = rawAuth.getSession()
    const user = session?.user

    if (!user) {
      return { data: null, error: 'User not authenticated' }
    }

    // Generate random code
    const code = Math.random().toString(36).substring(2, 10).toUpperCase()

    const expiresAt = options?.expiresInDays
      ? new Date(Date.now() + options.expiresInDays * 24 * 60 * 60 * 1000).toISOString()
      : null

    const { data, error } = await rawDb.insert('group_invites', {
      group_id: groupId,
      code,
      created_by: user.id,
      max_uses: options?.maxUses,
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
    const { data, error } = await rawDb.select<any>('group_invites', {
      select: '*',
      filters: { 'group_id': rawDb.filter.eq(groupId) },
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
    const { error } = await rawDb.remove('group_invites', {
      'id': rawDb.filter.eq(inviteId)
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
    if (!userId) {
      const session = rawAuth.getSession()
      if (!session?.user) return false
      userId = session.user.id
    }

    const { data, error } = await rawDb.select<any>('group_members', {
      select: 'group_id',
      filters: {
        'group_id': rawDb.filter.eq(groupId),
        'user_id': rawDb.filter.eq(userId)
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
