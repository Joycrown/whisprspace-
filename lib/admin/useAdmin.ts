import { useState, useEffect, useCallback } from 'react'
import {
  isAdmin as checkIsAdmin,
  getAdminRole,
  fetchAllUsers,
  fetchUserDetails,
  fetchContentReports,
  fetchBannedUsers,
  fetchModerationActions,
  fetchPayoutRequests,
  ContentReport,
  ModerationAction,
  BannedUser,
} from './admin-service'

import { useUserStore } from '@/store/userStore'

/**
 * Hook to check if user is admin
 */
export const useIsAdmin = () => {
  const { session, isLoading: sessionLoading } = useUserStore()
  const [role, setRole] = useState<string | null>(null)
  const [isRoleLoading, setIsRoleLoading] = useState(false)

  const isAdmin = session.isAuthenticated && session.user?.isAdmin === true

  useEffect(() => {
    const fetchRole = async () => {
      if (isAdmin && !role) {
        setIsRoleLoading(true)
        try {
          const { role: userRole } = await getAdminRole()
          setRole(userRole)
        } catch (error) {
          console.error('Failed to fetch admin role:', error)
        } finally {
          setIsRoleLoading(false)
        }
      }
    }

    fetchRole()
  }, [isAdmin, role])

  return { 
    isAdmin, 
    role: role || (isAdmin ? 'Admin' : null), 
    isLoading: sessionLoading || (isAdmin && isRoleLoading && !role) 
  }
}

/**
 * Hook for managing users
 */
export const useUsers = (options?: {
  limit?: number
  offset?: number
  search?: string
}) => {
  const [users, setUsers] = useState<any[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadUsers = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    const { data, count, error: err } = await fetchAllUsers(options)

    if (err) {
      setError(err)
    } else {
      setUsers(data)
      setTotalCount(count)
    }

    setIsLoading(false)
  }, [JSON.stringify(options)])

  useEffect(() => {
    loadUsers()
  }, [loadUsers])

  return {
    users,
    totalCount,
    isLoading,
    error,
    refreshUsers: loadUsers,
  }
}

/**
 * Hook for single user details
 */
export const useUserDetails = (userId?: string) => {
  const [user, setUser] = useState<any | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!userId) return

    const loadUser = async () => {
      setIsLoading(true)
      setError(null)
      const { data, error: err } = await fetchUserDetails(userId)
      if (err) setError(err)
      else setUser(data)
      setIsLoading(false)
    }

    loadUser()
  }, [userId])

  return { user, isLoading, error }
}

/**
 * Hook for content reports
 */
export const useContentReports = (options?: {
  status?: string
  contentType?: string
  limit?: number
}) => {
  const [reports, setReports] = useState<ContentReport[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadReports = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    const { data, error: err } = await fetchContentReports(options)

    if (err) {
      setError(err)
    } else {
      setReports(data)
    }

    setIsLoading(false)
  }, [JSON.stringify(options)])

  useEffect(() => {
    loadReports()
  }, [loadReports])

  return {
    reports,
    isLoading,
    error,
    refreshReports: loadReports,
  }
}

/**
 * Hook for banned users
 */
export const useBannedUsers = () => {
  const [bannedUsers, setBannedUsers] = useState<BannedUser[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadBannedUsers = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    const { data, error: err } = await fetchBannedUsers()

    if (err) {
      setError(err)
    } else {
      setBannedUsers(data)
    }

    setIsLoading(false)
  }, [])

  useEffect(() => {
    loadBannedUsers()
  }, [loadBannedUsers])

  return {
    bannedUsers,
    isLoading,
    error,
    refreshBannedUsers: loadBannedUsers,
  }
}

/**
 * Hook for moderation actions
 */
export const useModerationActions = (targetUserId?: string) => {
  const [actions, setActions] = useState<ModerationAction[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadActions = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    const { data, error: err } = await fetchModerationActions({
      targetUserId,
      limit: 50,
    })

    if (err) {
      setError(err)
    } else {
      setActions(data)
    }

    setIsLoading(false)
  }, [targetUserId])

  useEffect(() => {
    loadActions()
  }, [loadActions])

  return {
    actions,
    isLoading,
    error,
    refreshActions: loadActions,
  }
}

/**
 * Hook for payout requests
 */
export const usePayoutRequests = () => {
  const [requests, setRequests] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadRequests = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    const { data, error: err } = await fetchPayoutRequests()

    if (err) {
      setError(err)
    } else {
      setRequests(data)
    }

    setIsLoading(false)
  }, [])

  useEffect(() => {
    loadRequests()
  }, [loadRequests])

  return {
    requests,
    isLoading,
    error,
    refreshRequests: loadRequests,
  }
}
