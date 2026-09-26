'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useUserStore } from '@/store/userStore'
import { StoriesApiError, storiesApi } from '@/lib/stories/api-client'
import type { ReactionCounts, StoryReaction, StoryViewerState } from '@/lib/stories/types'
import AccountRequiredSheet, { type AccountReason } from './AccountRequiredSheet'

export const COMMENTS_HASH = '#comments'

interface StoryViewerContextValue {
  storyId: string
  viewer: StoryViewerState
  isRegistered: boolean
  sessionReady: boolean
  setFollowing: (following: boolean) => void
  requireAccount: (reason: AccountReason, preview?: string | null) => void
  reactionCounts: ReactionCounts
  myReaction: StoryReaction | null
  react: (reaction: StoryReaction) => void
  commentsOpen: boolean
  setCommentsOpen: (open: boolean) => void
}

const DEFAULT_VIEWER: StoryViewerState = { isAuthor: false, isFollowing: false, canParticipate: false, featureConsent: null }

const StoryViewerContext = createContext<StoryViewerContextValue | null>(null)

interface StoryViewerProviderProps {
  storyId: string
  initialReactionCounts?: ReactionCounts
  children: React.ReactNode
}

export function StoryViewerProvider({ storyId, initialReactionCounts, children }: StoryViewerProviderProps) {
  const pathname = usePathname()
  const session = useUserStore((state) => state.session)
  const sessionValidated = useUserStore((state) => state.sessionValidated)
  const userId = session.user?.id ?? null
  const isRegistered = Boolean(sessionValidated && session.isAuthenticated && session.user && !session.user.isAnonymous)
  const [viewer, setViewer] = useState<StoryViewerState>(DEFAULT_VIEWER)
  const [account, setAccount] = useState<{ reason: AccountReason; preview: string | null } | null>(null)
  const [reactionCounts, setReactionCounts] = useState<ReactionCounts>(initialReactionCounts ?? {})
  const [myReaction, setMyReaction] = useState<StoryReaction | null>(null)
  const [commentsOpen, setCommentsOpen] = useState(false)
  const reactingRef = useRef(false)

  useEffect(() => {
    if (!sessionValidated || !userId) {
      setViewer(DEFAULT_VIEWER)
      setMyReaction(null)
      return
    }
    let cancelled = false
    storiesApi<StoryViewerState>(`/api/stories/${storyId}/viewer`)
      .then((state) => {
        if (cancelled) return
        setViewer(state)
        setMyReaction(state.myReaction ?? null)
        if (state.reactionCounts) setReactionCounts(state.reactionCounts)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [storyId, userId, sessionValidated])

  useEffect(() => {
    if (window.location.hash === COMMENTS_HASH) setCommentsOpen(true)
  }, [])

  const setFollowing = useCallback((following: boolean) => setViewer((current) => ({ ...current, isFollowing: following })), [])
  const requireAccount = useCallback((reason: AccountReason, preview?: string | null) => setAccount({ reason, preview: preview ?? null }), [])

  const react = useCallback((reaction: StoryReaction) => {
    if (!isRegistered) {
      requireAccount('react')
      return
    }
    if (reactingRef.current) return
    reactingRef.current = true
    const previousMine = myReaction
    const previousCounts = reactionCounts
    const nextMine = previousMine === reaction ? null : reaction
    const optimistic: ReactionCounts = { ...previousCounts }
    if (previousMine) optimistic[previousMine] = Math.max((optimistic[previousMine] ?? 1) - 1, 0)
    if (nextMine) optimistic[nextMine] = (optimistic[nextMine] ?? 0) + 1
    setMyReaction(nextMine)
    setReactionCounts(optimistic)
    storiesApi<{ counts: ReactionCounts; mine: StoryReaction | null }>(`/api/stories/${storyId}/reactions`, {
      method: 'POST',
      body: JSON.stringify({ reaction }),
    })
      .then((result) => {
        setReactionCounts(result.counts ?? {})
        setMyReaction(result.mine ?? null)
        if (result.mine) import('posthog-js').then(({ default: posthog }) => posthog.capture('story_reacted', { story_id: storyId, reaction: result.mine })).catch(() => {})
      })
      .catch((cause) => {
        setMyReaction(previousMine)
        setReactionCounts(previousCounts)
        if (cause instanceof StoriesApiError && cause.code === 'account_required') requireAccount('react')
      })
      .finally(() => { reactingRef.current = false })
  }, [isRegistered, myReaction, reactionCounts, requireAccount, storyId])

  const value = useMemo(
    () => ({
      storyId,
      viewer,
      isRegistered,
      sessionReady: sessionValidated,
      setFollowing,
      requireAccount,
      reactionCounts,
      myReaction,
      react,
      commentsOpen,
      setCommentsOpen,
    }),
    [storyId, viewer, isRegistered, sessionValidated, setFollowing, requireAccount, reactionCounts, myReaction, react, commentsOpen]
  )

  const returnTo = `${pathname || '/'}${account && (account.reason === 'comment' || account.reason === 'report') ? COMMENTS_HASH : ''}`

  return (
    <StoryViewerContext.Provider value={value}>
      {children}
      {account && <AccountRequiredSheet reason={account.reason} preview={account.preview} returnTo={returnTo} onClose={() => setAccount(null)} />}
    </StoryViewerContext.Provider>
  )
}

export function useStoryViewer() {
  const context = useContext(StoryViewerContext)
  if (!context) throw new Error('useStoryViewer must be used inside StoryViewerProvider')
  return context
}
