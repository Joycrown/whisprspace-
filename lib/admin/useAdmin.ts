import { useState, useEffect, useCallback } from 'react'
import {
  isAdmin as checkIsAdmin,
  getAdminRole,
  fetchAllUsers,
  fetchContentReports,
  fetchBannedUsers,
  fetchModerationActions,
  ContentReport,
  ModerationAction,
  BannedUser,
} from './admin-service'

/**
 * Hook to check if user is admin
 */
export const useIsAdmin = () => {
  const [isAdmin, setIsAdmin] = useState(false)
  const [role, setRole] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const checkAdmin = async () => {
      const adminStatus = await checkIsAdmin()
      setIsAdmin(adminStatus)

      if (adminStatus) {
        const { role: userRole } = await getAdminRole()
        setRole(userRole)
      }

      setIsLoading(false)
    }

    checkAdmin()
  }, [])

  return { isAdmin, role, isLoading }
}

/**
 * Hook for managing users
 */
export const useUsers = (options?: {
  limit?: number
  search?: string
}) => {
  const [users, setUsers] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadUsers = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    const { data, error: err } = await fetchAllUsers(options)

    if (err) {
      setError(err)
    } else {
      setUsers(data)
    }

    setIsLoading(false)
  }, [options])

  useEffect(() => {
    loadUsers()
  }, [loadUsers])

  return {
    users,
    isLoading,
    error,
    refreshUsers: loadUsers,
  }
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
  }, [options])

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
