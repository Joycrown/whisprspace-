import { useEffect } from 'react'
import * as rawAuth from '@/lib/core/supabase/raw-auth'
import { useUserStore } from '@/store/userStore'
import { getCurrentSession } from './auth-service'

/**
 * Auth hook that syncs Supabase auth state with Zustand store
 */
export const useAuth = () => {
  const {
    session,
    sessionInfo,
    isLoading,
    error,
    loginAnonymously,
    login,
    signup,
    logout,
    canCreateThread,
    canInteract,
  } = useUserStore()

  useEffect(() => {
    // Check current session on mount
    getCurrentSession().then((user) => {
      if (user) {
        useUserStore.setState({
          session: {
            user,
            isAuthenticated: !user.isAnonymous,
            sessionExpiry: null,
          },
          sessionInfo: user.isAnonymous
            ? {
                anonymousId: user.anonymousId,
                sessionToken: '',
                isAnonymous: true,
                createdAt: user.joinedAt,
              }
            : null,
        })
      }
    })

    // Listen for auth changes
    // Listen for auth changes
    const unsubscribe = rawAuth.onAuthStateChange(async (event, session) => {


      if (event === 'SIGNED_IN' && session?.user) {
        const user = await getCurrentSession()
        if (user) {
          useUserStore.setState({
            session: {
              user,
              isAuthenticated: !user.isAnonymous,
              sessionExpiry: session.expires_at
                ? new Date(session.expires_at * 1000).toISOString()
                : null,
            },
            sessionInfo: user.isAnonymous
              ? {
                  anonymousId: user.anonymousId,
                  sessionToken: '',
                  isAnonymous: true,
                  createdAt: user.joinedAt,
                }
              : null,
          })
        }
      } else if (event === 'SIGNED_OUT') {
        useUserStore.setState({
          session: {
            user: null,
            isAuthenticated: false,
            sessionExpiry: null,
          },
          sessionInfo: null,
        })
      } else if (event === 'TOKEN_REFRESHED') {
        // Update session expiry
        if (session?.expires_at) {
          useUserStore.setState((state) => ({
            session: {
              ...state.session,
              sessionExpiry: new Date(session.expires_at! * 1000).toISOString(),
            },
          }))
        }
      }
    })

    return () => {
      unsubscribe()
    }
  }, [])

  return {
    user: session.user,
    anonymousSession: sessionInfo,
    isAuthenticated: session.isAuthenticated,
    isAnonymous: sessionInfo !== null,
    isLoading,
    error,
    loginAnonymously,
    login,
    signup,
    logout,
    canCreateThread,
    canInteract,
  }
}
