'use client'

import { useEffect, useRef } from 'react'
import { detectSource, track } from '@/lib/analytics/track'
import type { StoryCategory } from '@/lib/stories/types'

const WORDS_PER_MINUTE = 230
const READ_SHARE = 0.3
const MIN_READ_MS = 3_000
const MAX_READ_MS = 15_000

function readThresholdMs(wordCount: number) {
  const fullReadMs = (Math.max(wordCount, 1) / WORDS_PER_MINUTE) * 60_000
  return Math.min(MAX_READ_MS, Math.max(MIN_READ_MS, fullReadMs * READ_SHARE))
}
const READER_KEY = 'whs_reader_key'
const readKey = (storyId: string) => `whs_story_read:${storyId}`

function readerKey(): string | null {
  try {
    const existing = localStorage.getItem(READER_KEY)
    if (existing && /^[A-Za-z0-9_-]{16,64}$/.test(existing)) return existing
    const bytes = new Uint8Array(18)
    crypto.getRandomValues(bytes)
    const created = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    localStorage.setItem(READER_KEY, created)
    return created
  } catch {
    return null
  }
}

function recordRead(storyId: string) {
  const today = new Date().toISOString().slice(0, 10)
  try {
    if (localStorage.getItem(readKey(storyId)) === today) return false
  } catch {}
  const key = readerKey()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!key || !url || !anon) return false
  fetch(`${url.replace(/\/$/, '')}/rest/v1/rpc/record_story_read`, {
    method: 'POST',
    keepalive: true,
    headers: { apikey: anon, Authorization: `Bearer ${anon}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_story_id: storyId, p_reader_key: key }),
  })
    .then((response) => {
      if (!response.ok) return
      try { localStorage.setItem(readKey(storyId), today) } catch {}
    })
    .catch(() => {})
  return true
}

interface StoryReadTrackerProps {
  storyId: string
  category: StoryCategory
  episodeCount: number
  wordCount: number
}

export default function StoryReadTracker({ storyId, category, episodeCount, wordCount }: StoryReadTrackerProps) {
  const endRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const readAfterMs = readThresholdMs(wordCount)
    const finishMinMs = Math.min(readAfterMs, MIN_READ_MS)
    const base = { feature: 'stories' as const, story_id: storyId, category, episode_count: episodeCount, word_count: wordCount }
    const source = detectSource()
    track('story_opened', { ...base, source })

    let visibleMs = 0
    let lastTick = document.visibilityState === 'visible' ? Date.now() : 0
    let read = false
    let finished = false
    let reachedEnd = false

    const elapsed = () => visibleMs + (lastTick ? Date.now() - lastTick : 0)

    const markRead = (trigger: 'time' | 'end') => {
      if (read) return
      read = true
      const counted = recordRead(storyId)
      track('story_read', { ...base, source, trigger, counted, seconds: Math.round(elapsed() / 1000) })
    }

    const markFinished = () => {
      if (finished) return
      finished = true
      track('story_finished', { ...base, source, seconds: Math.round(elapsed() / 1000) })
    }

    const check = () => {
      const ms = elapsed()
      if (reachedEnd && ms >= finishMinMs) {
        markRead('end')
        markFinished()
      } else if (ms >= readAfterMs) {
        markRead('time')
      }
      if (read && finished) window.clearInterval(interval)
    }

    const interval = window.setInterval(check, 1000)

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        lastTick = Date.now()
      } else if (lastTick) {
        visibleMs += Date.now() - lastTick
        lastTick = 0
      }
    }
    document.addEventListener('visibilitychange', onVisibility)

    const node = endRef.current
    const observer = node
      ? new IntersectionObserver((entries) => {
          if (entries[0]?.isIntersecting) {
            reachedEnd = true
            check()
          }
        })
      : null
    if (node && observer) observer.observe(node)

    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibility)
      observer?.disconnect()
    }
  }, [storyId, category, episodeCount, wordCount])

  return <div ref={endRef} aria-hidden className="h-px w-full" />
}
