'use client'

import { useCallback, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import * as rawAuth from '@/lib/core/supabase/raw-auth'
import { useUserStore } from '@/store/userStore'
import { getCurrentSession } from '@/lib/auth/auth-service'
import { initializeStorage } from '@/lib/utils/storage-migration'
import { getAnonymousSessionExpiry, getRegisteredSessionExpiry } from '@/lib/utils/session-expiry'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()

  // Helper function to check if session is expired
  const isSessionExpired = useCallback((sessionExpiry: string | null): boolean => {
    if (!sessionExpiry) return false
    return new Date() >= new Date(sessionExpiry)
  }, [])

  const isPublicRoute = (path: string) => {
    return (
      path === '/' ||
      path === '/auth' ||
      path.startsWith('/auth') ||
      path === '/privacy-policy' ||
      path === '/community-guidelines' ||
      path.startsWith('/profile') ||
      path.startsWith('/invite') ||
      path.startsWith('/message')
    )
  }

  const redirectToAuth = useCallback(() => {
    const safePath = pathname && pathname.startsWith('/') ? pathname : '/threads'
    if (safePath.startsWith('/auth')) {
      router.replace('/auth')
      return
    }
    router.replace(`/auth?redirect=${encodeURIComponent(safePath)}`)
  }, [pathname, router])

  useEffect(() => {
    // Initialize storage and cleanup old mock data BEFORE checking session
    initializeStorage()

    // IMPORTANT: Always validate against backend, not localStorage
    // localStorage is only a cache, backend is source of truth

    const validateSessionFromBackend = async (retryCount = 0) => {
      try {
        const storedSession = rawAuth.getStoredSession()
        if (storedSession && rawAuth.isSessionExpired(storedSession)) {
          const refreshed = await rawAuth.refreshToken()
          if (!refreshed.session) {
            useUserStore.setState({
              session: {
                user: null,
                isAuthenticated: false,
                sessionExpiry: null,
              },
              sessionInfo: null,
              sessionValidated: true,
            })

            if (!isPublicRoute(pathname)) {
              redirectToAuth()
            }
            return
          }
        }


        // Get session from raw auth (source of truth)
        const user = await getCurrentSession()

        if (!user) {
          // Check if we actually have a session token but just failed to fetch the profile
          const session = rawAuth.getSession()

          if (session) {
            console.warn('[AuthProvider] Session token exists but profile fetch failed.')

            // Retry logic: if token exists but user profile fetch failed, it might be a race condition (e.g. trigger delay)
            if (retryCount < 3) {

              setTimeout(() => validateSessionFromBackend(retryCount + 1), 500)
              return
            }

            console.warn('[AuthProvider] Max retries reached. NOT redirecting to landing page to avoid loop.')
            // Valid token exists, so don't kick the user. 
            // They might be a new user where the trigger is still running.
            useUserStore.setState({ sessionValidated: true })
            return
          }

          // No backend session AND no local token - clear localStorage cache

          useUserStore.setState({
            session: {
              user: null,
              isAuthenticated: false,
              sessionExpiry: null,
            },
            sessionInfo: null,
            sessionValidated: true,
          })

          // Redirect to auth page if not already on public routes
          if (!isPublicRoute(pathname)) {
            redirectToAuth()
          }
          return
        }

        // Backend session exists - validate expiry from localStorage
        const storedState = useUserStore.getState()
        const sessionExpiry = storedState.session.sessionExpiry
        const expired = sessionExpiry && isSessionExpired(sessionExpiry);

        if (expired) {
          // Session expired - sign out silently and redirect to landing page


          await rawAuth.signOut()

          useUserStore.setState({
            session: {
              user: null,
              isAuthenticated: false,
              sessionExpiry: null,
            },
            sessionInfo: null,
            sessionValidated: true,
          })

          if (!isPublicRoute(pathname)) {
            redirectToAuth()
          }
          return
        }

        // Valid backend session - update state


        // Calculate session expiry if not already set
        let validSessionExpiry = sessionExpiry
        if (!validSessionExpiry) {
          // Session exists but no expiry set - calculate one based on user type
          if (user.isAnonymous) {
            // Anonymous users: 24 hours
            validSessionExpiry = getAnonymousSessionExpiry()

          } else {
            // Registered users: 72 hours (or remember me duration)
            const { rememberMe } = useUserStore.getState()
            validSessionExpiry = getRegisteredSessionExpiry(rememberMe)

          }
        }

        useUserStore.setState({
          session: {
            user,
            isAuthenticated: !user.isAnonymous,
            sessionExpiry: validSessionExpiry,
          },
          sessionInfo: user.isAnonymous
            ? {
              anonymousId: user.anonymousId,
              sessionToken: '',
              isAnonymous: true,
              createdAt: user.joinedAt,
            }
            : null,
          sessionValidated: true,
        })

        // Handle landing page redirect
        if (pathname === '/') {

          router.push('/threads')
        }

      } catch (error) {
        console.error('Backend session validation error:', error)
        // Backend validation failed - clear localStorage cache
        useUserStore.setState({
          session: {
            user: null,
            isAuthenticated: false,
            sessionExpiry: null,
          },
          sessionInfo: null,
          sessionValidated: true,
        })

        if (!isPublicRoute(pathname)) {
          const session = rawAuth.getSession()
          if (!session) {
            redirectToAuth()
          } else {
            console.error('[AuthProvider] Backend validation error, but session token exists. Staying on page.')
          }
        }
      }
    }

    // Skip backend validation on auth page ONLY if no session exists
    // If user just logged in, we need to validate to prevent redirect loops
    if (pathname === '/auth' || pathname.startsWith('/auth/reset-password')) {
      const currentSession = rawAuth.getSession()
      if (!currentSession) {
        // No session yet - user is about to login, skip validation

        useUserStore.setState({ sessionValidated: true })
        return
      }
      // Session exists on auth page - validate it before any redirect happens

    }

    // Always validate against backend on all other routes (or auth page with session)
    validateSessionFromBackend()


    // Listen for auth changes using raw-auth
    const unsubscribe = rawAuth.onAuthStateChange(async (event, session) => {


      if (event === 'SIGNED_IN' && session) {
        // Proactively update cached token
        const { setAccessToken } = await import('@/lib/utils/auth-token-cache')
        if (session?.access_token) {
          setAccessToken(session.access_token)
        }

        const user = await getCurrentSession()
        if (user) {
          const { rememberMe } = useUserStore.getState()
          const sessionExpiry = user.isAnonymous
            ? getAnonymousSessionExpiry()
            : getRegisteredSessionExpiry(rememberMe)
          useUserStore.setState({
            session: {
              user,
              isAuthenticated: !user.isAnonymous,
              sessionExpiry,
            },
            sessionInfo: user.isAnonymous
              ? {
                anonymousId: user.anonymousId,
                sessionToken: '',
                isAnonymous: true,
                createdAt: user.joinedAt,
              }
              : null,
            sessionValidated: true,
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
        // Redirect to auth page on sign out
        if (!isPublicRoute(pathname)) {
          redirectToAuth()
        }
      } else if (event === 'TOKEN_REFRESHED') {
        // Proactively update cached token when it refreshes
        const { setAccessToken } = await import('@/lib/utils/auth-token-cache')
        if (session?.access_token) {
          setAccessToken(session.access_token)

        }

        // Only refresh for registered users, not anonymous
        const { session: currentSession } = useUserStore.getState()

        if (currentSession.isAuthenticated && !currentSession.user?.isAnonymous) {
          // Registered user - extend session by configured duration
          const { rememberMe } = useUserStore.getState()
          const newExpiry = getRegisteredSessionExpiry(rememberMe)

          useUserStore.setState((state) => ({
            session: {
              ...state.session,
              sessionExpiry: newExpiry,
            },
          }))


        }
        // Anonymous users don't get token refresh - they expire after 24h
      }
    })

    return () => {
      unsubscribe()
    }
  }, [pathname, router, redirectToAuth, isSessionExpired])

  // Periodic session validation (every 5 minutes)
  useEffect(() => {
    const validateSession = async () => {
      const { session, sessionValidated } = useUserStore.getState()

      // Don't do periodic checks until initial validation is complete
      if (!sessionValidated) {

        return
      }

      // Check if session has expired
      if (session.sessionExpiry && isSessionExpired(session.sessionExpiry)) {
        // Session expired - sign out silently and redirect to landing page


        await rawAuth.signOut()

        useUserStore.setState({
          session: {
            user: null,
            isAuthenticated: false,
            sessionExpiry: null,
          },
          sessionInfo: null,
        })

        if (!isPublicRoute(pathname)) {
          redirectToAuth()
        }
      }
    }

    // Check immediately
    validateSession()

    // Then check every 5 minutes
    const interval = setInterval(validateSession, 5 * 60 * 1000)

    return () => clearInterval(interval)
  }, [pathname, router, isSessionExpired, redirectToAuth])

  return <>{children}</>
}
