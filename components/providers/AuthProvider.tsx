'use client'

import { useEffect, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import * as rawAuth from '@/lib/core/supabase/raw-auth'
import { useUserStore } from '@/store/userStore'
import { getCurrentSession } from '@/lib/auth/auth-service'
import { initializeStorage } from '@/lib/utils/storage-migration'
import { getAnonymousSessionExpiry, getRegisteredSessionExpiry } from '@/lib/utils/session-expiry'
import { setAccessToken } from '@/lib/utils/auth-token-cache'

// Stable outside component — never recreated
const PUBLIC_PREFIXES = ['/auth', '/privacy-policy', '/community-guidelines', '/getting-started', '/profile', '/invite', '/message', '/claim']

function isPublicRoute(path: string): boolean {
  return path === '/' || PUBLIC_PREFIXES.some(p => path.startsWith(p))
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()

  // Mutable ref so mount-only callbacks always read the current pathname without
  // needing to be re-registered on every navigation.
  const pathnameRef = useRef(pathname)
  useEffect(() => { pathnameRef.current = pathname }, [pathname])

  // ── Effect 1: mount-only ──────────────────────────────────────────────────
  // Validates the session once on load and registers the auth-state listener
  // for the entire lifetime of the app. Never re-runs on navigation.
  useEffect(() => {
    initializeStorage()

    let cancelled = false
    let retryTimer: ReturnType<typeof setTimeout> | null = null

    const redirectToAuth = () => {
      const current = pathnameRef.current
      if (current.startsWith('/auth')) {
        router.replace('/auth')
        return
      }
      router.replace(`/auth?redirect=${encodeURIComponent(current)}`)
    }

    const validateSessionFromBackend = async (retryCount = 0) => {
      if (cancelled) return

      try {
        // If the stored token is already expired, try refreshing before anything else
        const storedSession = rawAuth.getStoredSession()
        if (storedSession && rawAuth.isSessionExpired(storedSession)) {
          const refreshed = await rawAuth.refreshToken()
          if (!refreshed.session) {
            useUserStore.setState({
              session: { user: null, isAuthenticated: false, sessionExpiry: null },
              sessionInfo: null,
              sessionValidated: true,
            })
            if (!isPublicRoute(pathnameRef.current)) redirectToAuth()
            return
          }
        }

        const user = await getCurrentSession()

        if (!user) {
          // Token exists but profile fetch failed — could be a DB trigger race
          if (rawAuth.getSession()) {
            if (retryCount < 3) {
              retryTimer = setTimeout(() => validateSessionFromBackend(retryCount + 1), 500)
              return
            }
            // Max retries with a valid token: leave the user on the page
            useUserStore.setState({ sessionValidated: true })
            return
          }

          useUserStore.setState({
            session: { user: null, isAuthenticated: false, sessionExpiry: null },
            sessionInfo: null,
            sessionValidated: true,
          })
          if (!isPublicRoute(pathnameRef.current)) redirectToAuth()
          return
        }

        // Check our app-level session expiry (separate from JWT expiry)
        const { session: storedState, rememberMe } = useUserStore.getState()
        const appExpiry = storedState.sessionExpiry

        if (appExpiry && new Date() >= new Date(appExpiry)) {
          if (!user.isAnonymous) {
            // Registered users: full sign-out — revoke the session on the backend
            await rawAuth.signOut()
          }
          // Anonymous users: don't revoke the Supabase session. The refresh token
          // stays intact in localStorage so the same anonymous account can be
          // restored next time the user clicks "Join Anonymously".
          useUserStore.setState({
            session: { user: null, isAuthenticated: false, sessionExpiry: null },
            sessionInfo: null,
            sessionValidated: true,
          })
          if (!isPublicRoute(pathnameRef.current)) redirectToAuth()
          return
        }

        const sessionExpiry = appExpiry ?? (
          user.isAnonymous ? getAnonymousSessionExpiry() : getRegisteredSessionExpiry(rememberMe)
        )

        useUserStore.setState({
          session: {
            user,
            isAuthenticated: !user.isAnonymous,
            sessionExpiry,
          },
          sessionInfo: user.isAnonymous
            ? { anonymousId: user.anonymousId, sessionToken: '', isAnonymous: true, createdAt: user.joinedAt }
            : null,
          sessionValidated: true,
        })

        if (pathnameRef.current === '/') router.push('/threads')
      } catch (error) {
        if (cancelled) return
        console.error('[AuthProvider] Session validation error:', error)
        useUserStore.setState({
          session: { user: null, isAuthenticated: false, sessionExpiry: null },
          sessionInfo: null,
          sessionValidated: true,
        })
        // Only redirect if there is genuinely no token — backend errors shouldn't kick users
        if (!isPublicRoute(pathnameRef.current) && !rawAuth.getSession()) {
          redirectToAuth()
        }
      }
    }

    // On the auth page with no session, skip backend validation entirely
    if (pathname.startsWith('/auth') && !rawAuth.getSession()) {
      useUserStore.setState({ sessionValidated: true })
    } else {
      validateSessionFromBackend()
    }

    // Stable listener — registered once, never torn down on navigation.
    // Guard: if sessionValidated is still false, the immediate SIGNED_IN callback
    // from onAuthStateChange would race with validateSessionFromBackend — skip it.
    const unsubscribe = rawAuth.onAuthStateChange(async (event, session) => {
      if (!useUserStore.getState().sessionValidated) return

      if (event === 'SIGNED_IN' && session) {
        setAccessToken(session.access_token)
        const user = await getCurrentSession()
        if (!user) return
        const { rememberMe } = useUserStore.getState()
        const sessionExpiry = user.isAnonymous
          ? getAnonymousSessionExpiry()
          : getRegisteredSessionExpiry(rememberMe)
        useUserStore.setState({
          session: { user, isAuthenticated: !user.isAnonymous, sessionExpiry },
          sessionInfo: user.isAnonymous
            ? { anonymousId: user.anonymousId, sessionToken: '', isAnonymous: true, createdAt: user.joinedAt }
            : null,
          sessionValidated: true,
        })
      } else if (event === 'SIGNED_OUT') {
        useUserStore.setState({
          session: { user: null, isAuthenticated: false, sessionExpiry: null },
          sessionInfo: null,
        })
        if (!isPublicRoute(pathnameRef.current)) redirectToAuth()
      } else if (event === 'TOKEN_REFRESHED' && session) {
        setAccessToken(session.access_token)
        const { session: current, rememberMe } = useUserStore.getState()
        // Only extend expiry for registered users — anonymous sessions have a fixed 24h lifetime
        if (current.isAuthenticated && !current.user?.isAnonymous) {
          useUserStore.setState((state) => ({
            session: { ...state.session, sessionExpiry: getRegisteredSessionExpiry(rememberMe) },
          }))
        }
      }
    })

    return () => {
      cancelled = true
      if (retryTimer) clearTimeout(retryTimer)
      unsubscribe()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps — mount-only, router is stable

  // ── Effect 2: periodic expiry check ──────────────────────────────────────
  // Runs on a 5-minute timer independently of navigation. Uses pathnameRef
  // so it always checks against the current route without re-registering.
  useEffect(() => {
    const checkExpiry = async () => {
      const { session, sessionValidated } = useUserStore.getState()
      if (!sessionValidated || !session.sessionExpiry) return
      if (new Date() < new Date(session.sessionExpiry)) return

      if (!session.user?.isAnonymous) {
        // Only revoke on the backend for registered users
        await rawAuth.signOut()
      }
      // Anonymous users: leave the raw session intact for restoration on next visit
      useUserStore.setState({
        session: { user: null, isAuthenticated: false, sessionExpiry: null },
        sessionInfo: null,
      })
      if (!isPublicRoute(pathnameRef.current)) {
        router.replace(`/auth?redirect=${encodeURIComponent(pathnameRef.current)}`)
      }
    }

    const interval = setInterval(checkExpiry, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [router])

  return <>{children}</>
}
