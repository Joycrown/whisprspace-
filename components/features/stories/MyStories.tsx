'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Loader2, PenLine } from 'lucide-react'
import BackButton from '@/components/navigation/BackButton'
import { useUserStore } from '@/store/userStore'
import { authRedirectPath, storiesApi } from '@/lib/stories/api-client'
import { MY_STORIES_PATH, STORIES_FEED_PATH } from '@/lib/stories/config'
import { buildStoryPath } from '@/lib/stories/story-url'
import type { MyStoriesPage, MyStoryItem } from '@/lib/stories/types'
import RelativeTime from './RelativeTime'
import StoryTags from './StoryTags'

const card = 'rounded-2xl border border-[#23232E] bg-[#12121A] p-4'
const primaryButton = 'inline-flex h-9 items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#F97316] px-3.5 text-xs font-medium text-white active:scale-[0.97] disabled:opacity-50'
const secondaryButton = 'inline-flex h-9 items-center rounded-xl border border-[#2A2A38] px-3.5 text-xs text-[#F2F2F6] hover:border-[#8B5CF6]/50'

const MODERATION_NOTE: Record<'hidden' | 'removed', string> = {
  hidden: 'Hidden while our team reviews reports',
  removed: 'Removed for breaking our guidelines',
}

function StoryRow({ story, children }: { story: MyStoryItem; children: React.ReactNode }) {
  const path = buildStoryPath(story)
  const isVisible = story.moderation_status === 'visible'
  return (
    <li className={card}>
      <StoryTags story={story} />
      {isVisible ? (
        <Link href={path} prefetch={false} className="mt-2 block text-base font-medium text-[#F2F2F6] hover:text-white">
          {story.title}
        </Link>
      ) : (
        <p className="mt-2 text-base font-medium text-[#F2F2F6]">{story.title}</p>
      )}
      {story.moderation_status !== 'visible' && (
        <p className="mt-2 inline-block rounded-lg border border-[#E24B4A]/30 bg-[#E24B4A]/[0.07] px-2.5 py-1 text-[11px] text-[#F09595]">
          {MODERATION_NOTE[story.moderation_status]}
        </p>
      )}
      <p className="mt-2 text-xs text-[#5C5C6E]">
        {story.is_episodic && `${story.episode_count} ${story.episode_count === 1 ? 'episode' : 'episodes'} · `}
        {story.reply_count} {story.reply_count === 1 ? 'comment' : 'comments'} · <RelativeTime iso={story.created_at} prefix="Posted " />
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">{children}</div>
    </li>
  )
}

export default function MyStories() {
  const session = useUserStore((state) => state.session)
  const sessionValidated = useUserStore((state) => state.sessionValidated)
  const isRegistered = Boolean(sessionValidated && session.isAuthenticated && session.user && !session.user.isAnonymous)
  const userId = session.user?.id ?? null

  const [items, setItems] = useState<MyStoryItem[]>([])
  const [unsaved, setUnsaved] = useState<MyStoryItem[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [reloadKey, setReloadKey] = useState(0)
  const [loadingMore, setLoadingMore] = useState(false)
  const [moreError, setMoreError] = useState(false)
  const [claiming, setClaiming] = useState<string | null>(null)
  const [claimErrors, setClaimErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!isRegistered) return
    let cancelled = false
    setStatus('loading')
    storiesApi<MyStoriesPage>('/api/stories/mine')
      .then((page) => {
        if (cancelled) return
        setItems(page.items)
        setUnsaved(page.unsaved)
        setCursor(page.nextCursor)
        setStatus('ready')
      })
      .catch(() => {
        if (!cancelled) setStatus('error')
      })
    return () => { cancelled = true }
  }, [isRegistered, userId, reloadKey])

  const loadMore = async () => {
    if (!cursor || loadingMore) return
    setLoadingMore(true)
    setMoreError(false)
    try {
      const page = await storiesApi<MyStoriesPage>(`/api/stories/mine?cursor=${encodeURIComponent(cursor)}`)
      setItems((current) => {
        const seen = new Set(current.map((story) => story.id))
        return [...current, ...page.items.filter((story) => !seen.has(story.id))]
      })
      setCursor(page.nextCursor)
    } catch {
      setMoreError(true)
    } finally {
      setLoadingMore(false)
    }
  }

  const claim = async (story: MyStoryItem) => {
    setClaiming(story.id)
    setClaimErrors((current) => {
      const next = { ...current }
      delete next[story.id]
      return next
    })
    try {
      await storiesApi(`/api/stories/${story.id}/claim`, { method: 'POST' })
      setUnsaved((current) => current.filter((item) => item.id !== story.id))
      setItems((current) => [story, ...current].sort((a, b) => (a.created_at < b.created_at ? 1 : -1)))
      import('posthog-js').then(({ default: posthog }) => posthog.capture('story_claimed', { story_id: story.id, source: 'my_stories' })).catch(() => {})
    } catch (cause) {
      setClaimErrors((current) => ({ ...current, [story.id]: cause instanceof Error ? cause.message : 'Unable to save this story.' }))
    } finally {
      setClaiming(null)
    }
  }

  return (
    <div className="mx-auto w-full max-w-xl px-4 pb-16 pt-5">
      <BackButton fallbackHref={STORIES_FEED_PATH} className="inline-flex items-center gap-1 text-xs text-[#8F8FA3] hover:text-[#F2F2F6]" />
      <div className="mt-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.4px]">My stories</h1>
          <p className="mt-1 text-xs text-[#5C5C6E]">Only you can see this page.</p>
        </div>
        {isRegistered && (
          <Link href="/stories/new" prefetch={false} className={primaryButton}>
            <PenLine className="h-3.5 w-3.5" />
            Tell your story
          </Link>
        )}
      </div>

      {!sessionValidated && (
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-[#5C5C6E]" />
        </div>
      )}

      {sessionValidated && !isRegistered && (
        <div className={`${card} mt-6 p-5 text-center`}>
          <p className="text-base font-medium text-[#F2F2F6]">Sign in to see your stories</p>
          <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-[#8F8FA3]">
            Every story you share with your account shows up here, ready to edit, continue or share.
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <Link href={authRedirectPath('login', MY_STORIES_PATH)} prefetch={false} className={primaryButton}>Sign in</Link>
            <Link href={authRedirectPath('signup', MY_STORIES_PATH)} prefetch={false} className={secondaryButton}>Create an account</Link>
          </div>
        </div>
      )}

      {isRegistered && status === 'loading' && (
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-[#5C5C6E]" />
        </div>
      )}

      {isRegistered && status === 'error' && (
        <p className="mt-10 text-center text-sm text-[#F09595]">
          We couldn’t load your stories.{' '}
          <button onClick={() => setReloadKey((key) => key + 1)} className="underline">Try again</button>
        </p>
      )}

      {isRegistered && status === 'ready' && (
        <>
          {unsaved.length > 0 && (
            <section className="mt-6">
              <h2 className="text-sm font-medium text-[#F2F2F6]">Not saved to your account yet</h2>
              <p className="mt-1 text-xs leading-5 text-[#8F8FA3]">
                You shared these from this device without signing in. Save them to manage them from anywhere.
              </p>
              <ul className="mt-3 space-y-3">
                {unsaved.map((story) => (
                  <StoryRow key={story.id} story={story}>
                    <button onClick={() => claim(story)} disabled={claiming !== null} className={primaryButton}>
                      {claiming === story.id && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      Save to my account
                    </button>
                    {claimErrors[story.id] && <p className="w-full text-xs text-[#F09595]">{claimErrors[story.id]}</p>}
                  </StoryRow>
                ))}
              </ul>
            </section>
          )}

          {items.length === 0 && unsaved.length === 0 ? (
            <div className={`${card} mt-6 p-5 text-center`}>
              <p className="text-base font-medium text-[#F2F2F6]">You haven’t shared a story yet</p>
              <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-[#8F8FA3]">When you do, it’ll show up here so you can edit it, add episodes or share it.</p>
              <Link href="/stories/new" prefetch={false} className={`${primaryButton} mt-4`}>
                <PenLine className="h-3.5 w-3.5" />
                Tell your story
              </Link>
            </div>
          ) : (
            items.length > 0 && (
              <section className="mt-6">
                {unsaved.length > 0 && <h2 className="mb-3 text-sm font-medium text-[#F2F2F6]">Saved to your account</h2>}
                <ul className="space-y-3">
                  {items.map((story) => {
                    const path = buildStoryPath(story)
                    return (
                      <StoryRow key={story.id} story={story}>
                        <Link href={`${path}/manage`} prefetch={false} className={primaryButton}>Manage</Link>
                        {story.moderation_status === 'visible' && (
                          <Link href={path} prefetch={false} className={secondaryButton}>View</Link>
                        )}
                      </StoryRow>
                    )
                  })}
                </ul>
                {cursor && (
                  <button
                    onClick={loadMore}
                    disabled={loadingMore}
                    className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-[#23232E] text-xs text-[#8F8FA3] hover:text-[#F2F2F6] disabled:opacity-50"
                  >
                    {loadingMore && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    Show more stories
                  </button>
                )}
                {moreError && <p className="mt-2 text-center text-xs text-[#F09595]">Couldn’t load more stories. Please try again.</p>}
              </section>
            )
          )}
        </>
      )}
    </div>
  )
}
