import { useState, useEffect } from 'react'
import {
  fetchGroups,
  fetchGroupById,
  createGroup,
  updateGroup,
  deleteGroup,
  joinGroup,
  leaveGroup,
  fetchGroupMembers,
  updateMemberRole,
  removeMember,
  generateInviteCode,
  fetchGroupInvites,
  deleteInviteCode,
  isGroupMember,
  fetchUserGroups,
  GroupData,
  GroupMember,
  GroupInvite,
} from './group-service'

/**
 * Hook for managing groups
 */
export const useGroups = () => {
  const [groups, setGroups] = useState<GroupData[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadGroups = async (filters?: {
    privacy?: 'public' | 'private' | 'invite_only'
    searchTerm?: string
    limit?: number
    offset?: number
  }) => {
    setIsLoading(true)
    setError(null)

    const { data, error: err } = await fetchGroups(filters)

    if (err) {
      setError(err)
    } else {
      setGroups(data)
    }

    setIsLoading(false)
  }

  const createNewGroup = async (groupData: Omit<GroupData, 'id' | 'creatorId' | 'createdAt' | 'updatedAt' | 'currentMembers'>) => {
    setIsLoading(true)
    setError(null)

    const { data, error: err } = await createGroup(groupData)

    if (err) {
      setError(err)
    } else if (data) {
      setGroups((prev) => [data, ...prev])
    }

    setIsLoading(false)
    return { data, error: err }
  }

  return {
    groups,
    isLoading,
    error,
    loadGroups,
    createNewGroup,
  }
}

/**
 * Hook for managing a single group
 */
export const useGroup = (groupId: string) => {
  const [group, setGroup] = useState<GroupData | null>(null)
  const [members, setMembers] = useState<GroupMember[]>([])
  const [invites, setInvites] = useState<GroupInvite[]>([])
  const [isMember, setIsMember] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load group details
  const loadGroup = async () => {
    setIsLoading(true)
    setError(null)

    const { data, error: err } = await fetchGroupById(groupId)

    if (err) {
      setError(err)
    } else {
      setGroup(data)
    }

    setIsLoading(false)
  }

  // Load group members
  const loadMembers = async () => {
    const { data, error: err } = await fetchGroupMembers(groupId)

    if (err) {
      setError(err)
    } else {
      setMembers(data)
    }
  }

  // Load group invites
  const loadInvites = async () => {
    const { data, error: err } = await fetchGroupInvites(groupId)

    if (err) {
      setError(err)
    } else {
      setInvites(data)
    }
  }

  // Check membership status
  const checkMembership = async () => {
    const status = await isGroupMember(groupId)
    setIsMember(status)
  }

  // Update group
  const updateGroupDetails = async (updates: Partial<GroupData>) => {
    setIsLoading(true)
    setError(null)

    const { data, error: err } = await updateGroup(groupId, updates)

    if (err) {
      setError(err)
    } else if (data) {
      setGroup(data)
    }

    setIsLoading(false)
    return { data, error: err }
  }

  // Delete group
  const removeGroup = async () => {
    setIsLoading(true)
    setError(null)

    const { success, error: err } = await deleteGroup(groupId)

    if (err) {
      setError(err)
    }

    setIsLoading(false)
    return { success, error: err }
  }

  // Join group
  const join = async (inviteCode?: string) => {
    setIsLoading(true)
    setError(null)

    const { success, error: err } = await joinGroup(groupId, inviteCode)

    if (err) {
      setError(err)
    } else if (success) {
      setIsMember(true)
      await loadGroup()
      await loadMembers()
    }

    setIsLoading(false)
    return { success, error: err }
  }

  // Leave group
  const leave = async () => {
    setIsLoading(true)
    setError(null)

    const { success, error: err } = await leaveGroup(groupId)

    if (err) {
      setError(err)
    } else if (success) {
      setIsMember(false)
      await loadGroup()
      await loadMembers()
    }

    setIsLoading(false)
    return { success, error: err }
  }

  // Update member role
  const changeMemberRole = async (userId: string, newRole: 'admin' | 'moderator' | 'member') => {
    setError(null)

    const { success, error: err } = await updateMemberRole(groupId, userId, newRole)

    if (err) {
      setError(err)
    } else if (success) {
      await loadMembers()
    }

    return { success, error: err }
  }

  // Remove member
  const kickMember = async (userId: string) => {
    setError(null)

    const { success, error: err } = await removeMember(groupId, userId)

    if (err) {
      setError(err)
    } else if (success) {
      await loadMembers()
      await loadGroup()
    }

    return { success, error: err }
  }

  // Generate invite
  const createInvite = async (options?: { maxUses?: number; expiresInDays?: number }) => {
    setError(null)

    const { data, error: err } = await generateInviteCode(groupId, options)

    if (err) {
      setError(err)
    } else if (data) {
      setInvites((prev) => [data, ...prev])
    }

    return { data, error: err }
  }

  // Delete invite
  const removeInvite = async (inviteId: string) => {
    setError(null)

    const { success, error: err } = await deleteInviteCode(inviteId)

    if (err) {
      setError(err)
    } else if (success) {
      setInvites((prev) => prev.filter((inv) => inv.id !== inviteId))
    }

    return { success, error: err }
  }

  // Load all data on mount
  useEffect(() => {
    if (groupId) {
      loadGroup()
      checkMembership()
    }
  }, [groupId])

  return {
    group,
    members,
    invites,
    isMember,
    isLoading,
    error,
    loadGroup,
    loadMembers,
    loadInvites,
    updateGroupDetails,
    removeGroup,
    join,
    leave,
    changeMemberRole,
    kickMember,
    createInvite,
    removeInvite,
  }
}

/**
 * Hook for user's groups
 */
export const useUserGroups = () => {
  const [userGroups, setUserGroups] = useState<GroupData[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadUserGroups = async () => {
    setIsLoading(true)
    setError(null)

    const { data, error: err } = await fetchUserGroups()

    if (err) {
      setError(err)
    } else {
      setUserGroups(data)
    }

    setIsLoading(false)
  }

  useEffect(() => {
    loadUserGroups()
  }, [])

  return {
    userGroups,
    isLoading,
    error,
    refreshGroups: loadUserGroups,
  }
}
