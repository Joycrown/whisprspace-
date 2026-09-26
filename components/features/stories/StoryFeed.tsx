'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Loader2, SlidersHorizontal, X } from 'lucide-react'
import {
  CATEGORY_META,
  FAMILY_LABELS,
  STORY_FAMILIES,
  categoriesForFamily,
  type StoryCategory,
  type StoryFamily,
  type StoryFeedItem,
  type StoryFeedPage,
  type StorySort,
} from '@/lib/stories/types'
import StoryCard from './StoryCard'
import { useUserStore } from '@/store/userStore'
import { useStoriesFeedRealtime } from '@/lib/core/realtime/hooks/useStoriesFeedRealtime'

interface FeedState {
  items: StoryFeedItem[]
  nextCursor: string | null
}

const keyOf = (family: StoryFamily | null, category: StoryCategory | null, sort: StorySort) =>
  `${family ?? 'all'}|${category ?? 'all'}|${sort}`

async function fetchPage(family: StoryFamily | null, category: StoryCategory | null, sort: StorySort, cursor: string | null) {
  const params = new URLSearchParams({ sort })
  if (category) params.set('category', category)
  else if (family) params.set('family', family)
  if (cursor) params.set('cursor', cursor)
  const response = await fetch(`/api/public/stories?${params.toString()}`)
  if (!response.ok) throw new Error('Unable to load stories.')
  return (await response.json()) as StoryFeedPage
}

const chip = (active: boolean) =>
  `shrink-0 rounded-full border px-3 py-1.5 text-xs transition-colors ${
    active ? 'border-[#8B5CF6]/60 bg-[#8B5CF6]/15 text-white' : 'border-[#2A2A38] text-[#8F8FA3] hover:text-[#F2F2F6]'
  }`

export default function StoryFeed({ initial }: { initial: StoryFeedPage }) {
  const [family, setFamily] = useState<StoryFamily | null>(null)
  const [category, setCategory] = useState<StoryCategory | null>(null)
  const [sort, setSort] = useState<StorySort>('fresh')
  const cache = useRef(new Map<string, FeedState>([[keyOf(null, null, 'fresh'), initial]]))
  const [state, setState] = useState<FeedState>(initial)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const requestRef = useRef(0)
  const activeKey = keyOf(family, category, sort)

  const session = useUserStore((state) => state.session)
  const sessionValidated = useUserStore((state) => state.sessionValidated)
  const isRegistered = Boolean(sessionValidated && session.isAuthenticated && session.user && !session.user.isAnonymous)

  const familyRef = useRef(family)
  familyRef.current = family
  const categoryRef = useRef(category)
  categoryRef.current = category
  const sortRef = useRef(sort)
  sortRef.current = sort
  const activeKeyRef = useRef(activeKey)
  activeKeyRef.current = activeKey

  const patchCachedStory = useCallback((storyId: string, patch: Partial<StoryFeedItem>) => {
    cache.current.forEach((entry, key) => {
      if (!entry.items.some((item) => item.id === storyId)) return
      cache.current.set(key, { ...entry, items: entry.items.map((item) => (item.id === storyId ? { ...item, ...patch } : item)) })
    })
  }, [])

  useStoriesFeedRealtime({
    enabled: isRegistered,
    onNewStory: (story: StoryFeedItem) => {
      if (sortRef.current !== 'fresh') return
      const wantsFamily = familyRef.current
      const wantsCategory = categoryRef.current
      if (wantsCategory && story.category !== wantsCategory) return
      if (!wantsCategory && wantsFamily && story.family !== wantsFamily) return

      const key = activeKeyRef.current
      const existing = cache.current.get(key)
      if (existing?.items.some((item) => item.id === story.id)) return
      const merged: FeedState = existing
        ? { ...existing, items: [story, ...existing.items] }
        : { items: [story], nextCursor: null }
      cache.current.set(key, merged)
      setState((current) => (current.items.some((item) => item.id === story.id) ? current : { ...current, items: [story, ...current.items] }))
    },
    onStoryUpdate: (story: StoryFeedItem) => {
      const patch = {
        reply_count: story.reply_count,
        reaction_counts: story.reaction_counts,
        follower_count: story.follower_count,
      }
      patchCachedStory(story.id, patch)
      setState((current) => ({
        ...current,
        items: current.items.map((item) => (item.id === story.id ? { ...item, ...patch } : item)),
      }))
    },
  })

  const select = useCallback(async (nextFamily: StoryFamily | null, nextCategory: StoryCategory | null, nextSort: StorySort) => {
    setFamily(nextFamily)
    setCategory(nextCategory)
    setSort(nextSort)
    setError(null)
    const key = keyOf(nextFamily, nextCategory, nextSort)
    const cached = cache.current.get(key)
    if (cached) {
      setState(cached)
      return
    }
    const requestId = ++requestRef.current
    setLoading(true)
    setState({ items: [], nextCursor: null })
    try {
      const page = await fetchPage(nextFamily, nextCategory, nextSort, null)
      cache.current.set(key, page)
      if (requestId === requestRef.current) setState(page)
    } catch (cause) {
      if (requestId === requestRef.current) setError(cause instanceof Error ? cause.message : 'Unable to load stories.')
    } finally {
      if (requestId === requestRef.current) setLoading(false)
    }
  }, [])

  const loadMore = useCallback(async () => {
    if (loading || !state.nextCursor) return
    const key = activeKey
    const requestId = ++requestRef.current
    setLoading(true)
    try {
      const page = await fetchPage(family, category, sort, state.nextCursor)
      const seen = new Set(state.items.map((item) => item.id))
      const merged = { items: [...state.items, ...page.items.filter((item) => !seen.has(item.id))], nextCursor: page.nextCursor }
      cache.current.set(key, merged)
      if (requestId === requestRef.current) setState(merged)
    } catch (cause) {
      if (requestId === requestRef.current) setError(cause instanceof Error ? cause.message : 'Unable to load more stories.')
    } finally {
      if (requestId === requestRef.current) setLoading(false)
    }
  }, [activeKey, category, family, loading, sort, state])

  useEffect(() => {
    const node = sentinelRef.current
    if (!node || !state.nextCursor) return
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) void loadMore()
    }, { rootMargin: '600px 0px' })
    observer.observe(node)
    return () => observer.disconnect()
  }, [loadMore, state.nextCursor])

  const visibleCategories = family ? categoriesForFamily(family) : []
  const [sheetOpen, setSheetOpen] = useState(false)
  const [draft, setDraft] = useState<{ family: StoryFamily | null; category: StoryCategory | null; sort: StorySort }>({ family: null, category: null, sort: 'fresh' })
  const isFiltered = Boolean(family || category || sort !== 'fresh')
  const activeSummary = [
    category ? CATEGORY_META[category].label : family ? FAMILY_LABELS[family] : 'All stories',
    sort === 'fresh' ? 'Fresh' : 'Most discussed',
  ].join(' · ')
  const draftCategories = draft.family ? categoriesForFamily(draft.family) : []

  const openSheet = () => {
    setDraft({ family, category, sort })
    setSheetOpen(true)
  }

  const applySheet = () => {
    setSheetOpen(false)
    if (draft.family !== family || draft.category !== category || draft.sort !== sort) {
      void select(draft.family, draft.category, draft.sort)
    }
  }

  useEffect(() => {
    if (!sheetOpen) return
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setSheetOpen(false) }
    document.addEventListener('keydown', onKey)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previousOverflow
    }
  }, [sheetOpen])

  return (
    <section aria-label="Stories">
      <div className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-[#1C1C26] bg-[#0A0A10]/95 px-4 py-2.5 backdrop-blur md:hidden">
        <p className="min-w-0 truncate text-sm text-[#DFDFE7]">{activeSummary}</p>
        <button
          type="button"
          onClick={openSheet}
          aria-label="Filter stories"
          className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#2A2A38] text-[#DFDFE7] active:scale-95"
        >
          <SlidersHorizontal className="h-4 w-4" />
          {isFiltered && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[#F97316]" />}
        </button>
      </div>

      <div className="sticky top-0 z-20 hidden border-b border-[#1C1C26] bg-[#0A0A10]/95 px-5 py-3 backdrop-blur md:block">
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
          <button className={chip(!family)} onClick={() => select(null, null, sort)}>All</button>
          {STORY_FAMILIES.map((value) => (
            <button key={value} className={chip(family === value)} onClick={() => select(value, null, sort)}>
              {FAMILY_LABELS[value]}
            </button>
          ))}
          <span className="mx-1 h-4 w-px shrink-0 bg-[#2A2A38]" />
          <button className={chip(sort === 'fresh')} onClick={() => select(family, category, 'fresh')}>Fresh</button>
          <button className={chip(sort === 'discussed')} onClick={() => select(family, category, 'discussed')}>Most discussed</button>
        </div>
        {visibleCategories.length > 0 && (
          <div className="mt-2 flex items-center gap-2 overflow-x-auto scrollbar-hide">
            <button className={chip(!category)} onClick={() => select(family, null, sort)}>Everything</button>
            {visibleCategories.map((value) => (
              <button key={value} className={chip(category === value)} onClick={() => select(family, value, sort)}>
                {CATEGORY_META[value].label}
              </button>
            ))}
          </div>
        )}
      </div>

      {state.items.length > 0 && (
        <ul className="divide-y divide-[#1C1C26]">
          {state.items.map((story) => (
            <StoryCard key={story.id} story={story} />
          ))}
        </ul>
      )}

      {!loading && !error && state.items.length === 0 && (
        <div className="px-6 py-16 text-center">
          <p className="text-base text-[#F2F2F6]">No stories here yet.</p>
          <p className="mt-1 text-sm text-[#8F8FA3]">Be the first to share one.</p>
          <Link href="/stories/new" prefetch={false} className="mt-5 inline-flex h-11 items-center rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#F97316] px-5 text-sm font-medium text-white">
            Tell your story
          </Link>
        </div>
      )}

      {error && (
        <div className="px-6 py-8 text-center text-sm text-[#F09595]">
          {error}{' '}
          <button className="underline" onClick={() => (state.items.length ? loadMore() : select(family, category, sort))}>Try again</button>
        </div>
      )}

      {sheetOpen && (
        <div className="fixed inset-0 z-[1300] flex items-end bg-black/60 md:hidden" onClick={() => setSheetOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="story-filter-title"
            className="w-full rounded-t-2xl border-t border-[#23232E] bg-[#12121A] px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[#2A2A38]" />
            <div className="flex items-center justify-between">
              <h2 id="story-filter-title" className="text-base font-medium text-[#F2F2F6]">Filter stories</h2>
              <button onClick={() => setSheetOpen(false)} aria-label="Close" className="rounded-lg p-1.5 text-[#5C5C6E]">
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="mt-5 text-[11px] font-bold uppercase tracking-[0.14em] text-[#5C5C6E]">Type</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button className={chip(!draft.family)} onClick={() => setDraft((d) => ({ ...d, family: null, category: null }))}>All</button>
              {STORY_FAMILIES.map((value) => (
                <button key={value} className={chip(draft.family === value)} onClick={() => setDraft((d) => ({ ...d, family: value, category: null }))}>
                  {FAMILY_LABELS[value]}
                </button>
              ))}
            </div>

            {draftCategories.length > 0 && (
              <>
                <p className="mt-5 text-[11px] font-bold uppercase tracking-[0.14em] text-[#5C5C6E]">Category</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button className={chip(!draft.category)} onClick={() => setDraft((d) => ({ ...d, category: null }))}>Everything</button>
                  {draftCategories.map((value) => (
                    <button key={value} className={chip(draft.category === value)} onClick={() => setDraft((d) => ({ ...d, category: value }))}>
                      {CATEGORY_META[value].label}
                    </button>
                  ))}
                </div>
              </>
            )}

            <p className="mt-5 text-[11px] font-bold uppercase tracking-[0.14em] text-[#5C5C6E]">Sort by</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button className={chip(draft.sort === 'fresh')} onClick={() => setDraft((d) => ({ ...d, sort: 'fresh' }))}>Fresh</button>
              <button className={chip(draft.sort === 'discussed')} onClick={() => setDraft((d) => ({ ...d, sort: 'discussed' }))}>Most discussed</button>
            </div>

            <div className="mt-6 flex gap-2">
              <button
                onClick={() => setDraft({ family: null, category: null, sort: 'fresh' })}
                className="h-11 flex-1 rounded-xl border border-[#2A2A38] text-sm text-[#DFDFE7]"
              >
                Reset
              </button>
              <button
                onClick={applySheet}
                className="h-11 flex-[2] rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#F97316] text-sm font-medium text-white"
              >
                Show stories
              </button>
            </div>
          </div>
        </div>
      )}

      <div ref={sentinelRef} aria-hidden className="h-px" />
      {loading && (
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-[#5C5C6E]" />
        </div>
      )}
    </section>
  )
}
