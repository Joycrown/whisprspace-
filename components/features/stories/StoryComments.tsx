'use client'

import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, CornerUpLeft, Flag, Loader2, MessageCircle, Send, X } from 'lucide-react'
import { StoriesApiError, storiesApi } from '@/lib/stories/api-client'
import { STORY_LIMITS, type ReactionCounts, type StoryRepliesPage, type StoryReaction, type StoryReply } from '@/lib/stories/types'
import { COMMENTS_HASH, useStoryViewer } from './StoryViewerContext'
import { CommentReactions } from './StoryReactions'
import RelativeTime from './RelativeTime'

interface EpisodeMarker {
  number: number
  published_at: string
}

interface StoryCommentsProps {
  storyId: string
  replyCount: number
  episodes: EpisodeMarker[]
  isEpisodic: boolean
}

interface ReplyTarget {
  id: string
  content: string
  avatar_seed: string
}

type Row = { kind: 'comment'; comment: StoryReply } | { kind: 'episode'; episode: EpisodeMarker }

const REPORT_REASONS = [
  { value: 'harassment', label: 'Harassment' },
  { value: 'hate_speech', label: 'Hate speech' },
  { value: 'self_harm', label: 'Self-harm' },
  { value: 'sexual_content', label: 'Sexual content' },
  { value: 'spam', label: 'Spam' },
  { value: 'other', label: 'Something else' },
] as const

const SWIPE_TRIGGER = 56
const DESKTOP_QUERY = '(min-width: 1024px)'
const draftKey = (storyId: string) => `whs_story_reply_draft:${storyId}`

function readDraft(storyId: string): { text: string; replyTo: ReplyTarget | null } {
  try {
    const raw = localStorage.getItem(draftKey(storyId))
    if (!raw) return { text: '', replyTo: null }
    try {
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object' && typeof parsed.text === 'string') {
        return { text: parsed.text, replyTo: parsed.replyTo ?? null }
      }
    } catch {}
    return { text: raw, replyTo: null }
  } catch {
    return { text: '', replyTo: null }
  }
}

function writeDraft(storyId: string, text: string, replyTo: ReplyTarget | null) {
  try {
    if (text || replyTo) localStorage.setItem(draftKey(storyId), JSON.stringify({ text, replyTo }))
    else localStorage.removeItem(draftKey(storyId))
  } catch {}
}

const Avatar = memo(function Avatar({ seed, size = 'md' }: { seed: string; size?: 'sm' | 'md' }) {
  let hash = 0
  for (let index = 0; index < seed.length; index += 1) hash = (hash * 31 + seed.charCodeAt(index)) >>> 0
  const hue = hash % 360
  return (
    <span
      aria-hidden
      className={`${size === 'sm' ? 'h-4 w-4' : 'h-8 w-8'} shrink-0 rounded-[22%]`}
      style={{ background: `linear-gradient(135deg, hsl(${hue},62%,42%), hsl(${(hue + 55) % 360},62%,52%))` }}
    />
  )
})

interface CommentRowProps {
  comment: StoryReply
  mine: boolean
  myReaction: StoryReaction | null
  highlighted: boolean
  onReply: (comment: StoryReply) => void
  onReport: (id: string) => void
  onEdit: (id: string, content: string) => Promise<void>
  onReact: (id: string, reaction: StoryReaction) => void
  onQuoteClick: (id: string) => void
}

const CommentRow = memo(function CommentRow({ comment, mine, myReaction, highlighted, onReply, onReport, onEdit, onReact, onQuoteClick }: CommentRowProps) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(comment.content)
  const [saving, setSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [offset, setOffset] = useState(0)
  const touchRef = useRef<{ x: number; y: number; mode: 'pending' | 'swipe' | 'scroll' } | null>(null)

  const save = async () => {
    const content = value.trim()
    if (!content) return
    if (content === comment.content) {
      setEditing(false)
      return
    }
    setSaving(true)
    setEditError(null)
    try {
      await onEdit(comment.id, content)
      setEditing(false)
    } catch (cause) {
      setEditError(cause instanceof Error ? cause.message : 'Unable to save your comment.')
    } finally {
      setSaving(false)
    }
  }

  const onTouchStart = (event: React.TouchEvent) => {
    if (editing) return
    const touch = event.touches[0]
    touchRef.current = { x: touch.clientX, y: touch.clientY, mode: 'pending' }
  }

  const onTouchMove = (event: React.TouchEvent) => {
    const state = touchRef.current
    if (!state || state.mode === 'scroll') return
    const touch = event.touches[0]
    const dx = touch.clientX - state.x
    const dy = touch.clientY - state.y
    if (state.mode === 'pending') {
      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) {
        state.mode = 'scroll'
        return
      }
      if (dx > 10 && dx > Math.abs(dy)) state.mode = 'swipe'
      else return
    }
    setOffset(Math.max(0, Math.min(dx, 88)))
  }

  const onTouchEnd = () => {
    const state = touchRef.current
    touchRef.current = null
    if (state?.mode === 'swipe' && offset >= SWIPE_TRIGGER) {
      navigator.vibrate?.(8)
      onReply(comment)
    }
    setOffset(0)
  }

  const onBodyClick = (event: React.MouseEvent) => {
    if (editing) return
    const target = event.target as HTMLElement
    if (target.closest('button, a, textarea, input')) return
    if (window.getSelection()?.toString()) return
    onReply(comment)
  }

  return (
    <li
      id={`comment-${comment.id}`}
      className={`relative overflow-hidden transition-colors duration-700 [content-visibility:auto] [contain-intrinsic-size:auto_84px] ${highlighted ? 'bg-[#8B5CF6]/10' : ''}`}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-[#C4B5FD]"
        style={{ opacity: Math.min(offset / SWIPE_TRIGGER, 1) }}
      >
        <CornerUpLeft className="h-4 w-4" />
      </span>
      <div
        className="flex cursor-pointer gap-3 px-4 py-3 md:px-5"
        style={{ transform: offset ? `translateX(${offset}px)` : undefined, transition: offset ? 'none' : 'transform 180ms ease-out' }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
        onClick={onBodyClick}
      >
        <Avatar seed={comment.avatar_seed} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[11px] text-[#5C5C6E]">
            {mine && <span className="text-[#C4B5FD]">You</span>}
            <RelativeTime iso={comment.created_at} />
            {comment.is_edited && <span>· edited</span>}
            <span className="ml-auto flex items-center gap-0.5">
              {mine && !editing && (
                <button
                  onClick={() => {
                    setValue(comment.content)
                    setEditError(null)
                    setEditing(true)
                  }}
                  className="rounded px-1.5 py-0.5 text-[#8F8FA3] hover:text-[#F2F2F6]"
                >
                  Edit
                </button>
              )}
              {!mine && (
                <button onClick={() => onReport(comment.id)} className="rounded p-1 text-[#3F3F4E] hover:text-[#8F8FA3]" aria-label="Report comment">
                  <Flag className="h-3 w-3" />
                </button>
              )}
            </span>
          </div>

          {comment.parent_id && comment.parent_content && (
            <button
              onClick={() => onQuoteClick(comment.parent_id as string)}
              className="mt-1 flex w-full items-start gap-2 rounded-lg border-l-2 border-[#8B5CF6]/60 bg-white/[0.03] px-2.5 py-1.5 text-left"
            >
              {comment.parent_avatar_seed && <Avatar seed={comment.parent_avatar_seed} size="sm" />}
              <span className="line-clamp-2 text-xs leading-5 text-[#8F8FA3]">{comment.parent_content}</span>
            </button>
          )}

          {editing ? (
            <div className="mt-1.5">
              <textarea
                value={value}
                onChange={(event) => setValue(event.target.value.slice(0, STORY_LIMITS.replyMax))}
                rows={3}
                autoFocus
                className="w-full resize-y rounded-xl border border-[#2A2A38] bg-[#0A0A10] px-3 py-2 text-sm leading-6 text-[#F2F2F6] focus:border-[#8B5CF6]/60 focus:outline-none"
              />
              {editError && <p className="mt-1 text-xs text-[#F09595]">{editError}</p>}
              <div className="mt-2 flex justify-end gap-2">
                <button onClick={() => setEditing(false)} disabled={saving} className="h-8 rounded-lg border border-[#2A2A38] px-3 text-xs text-[#DFDFE7] disabled:opacity-40">
                  Cancel
                </button>
                <button
                  onClick={save}
                  disabled={saving || !value.trim()}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-gradient-to-r from-[#8B5CF6] to-[#F97316] px-3 text-xs font-medium text-white disabled:opacity-40"
                >
                  {saving && <Loader2 className="h-3 w-3 animate-spin" />}
                  Save
                </button>
              </div>
            </div>
          ) : (
            <p className="mt-0.5 whitespace-pre-wrap break-words text-sm leading-6 text-[#DFDFE7]">{comment.content}</p>
          )}

          {!editing && (
            <div className="mt-1.5 flex items-center gap-3">
              <CommentReactions counts={comment.reaction_counts} mine={myReaction} onReact={(reaction) => onReact(comment.id, reaction)} />
              <button onClick={() => onReply(comment)} className="text-[11px] font-medium text-[#8F8FA3] hover:text-[#F2F2F6]">
                Reply
              </button>
            </div>
          )}
        </div>
      </div>
    </li>
  )
})

export default function StoryComments({ storyId, replyCount, episodes, isEpisodic }: StoryCommentsProps) {
  const { isRegistered, requireAccount, commentsOpen, setCommentsOpen } = useStoryViewer()
  const listRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  const stickToBottomRef = useRef(true)
  const prependAnchorRef = useRef<number | null>(null)
  const [isDesktop, setIsDesktop] = useState(false)
  const [comments, setComments] = useState<StoryReply[]>([])
  const [mineIds, setMineIds] = useState<Set<string>>(() => new Set())
  const [myReactions, setMyReactions] = useState<Record<string, StoryReaction>>({})
  const [cursor, setCursor] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [replyTo, setReplyTo] = useState<ReplyTarget | null>(null)
  const [posting, setPosting] = useState(false)
  const [postError, setPostError] = useState<string | null>(null)
  const [highlightId, setHighlightId] = useState<string | null>(null)
  const [reportingId, setReportingId] = useState<string | null>(null)
  const [reportState, setReportState] = useState<'idle' | 'sending' | 'sent'>('idle')

  const active = isDesktop || commentsOpen

  useEffect(() => {
    const saved = readDraft(storyId)
    setDraft(saved.text)
    setReplyTo(saved.replyTo)
  }, [storyId])

  useEffect(() => {
    const query = window.matchMedia(DESKTOP_QUERY)
    const update = () => setIsDesktop(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    if (!commentsOpen || isDesktop) return
    const scrollY = window.scrollY
    const body = document.body.style
    const html = document.documentElement.style
    const previous = { position: body.position, top: body.top, left: body.left, right: body.right, width: body.width, overflow: body.overflow, htmlOverflow: html.overflow }
    body.position = 'fixed'
    body.top = `-${scrollY}px`
    body.left = '0'
    body.right = '0'
    body.width = '100%'
    body.overflow = 'hidden'
    html.overflow = 'hidden'
    return () => {
      body.position = previous.position
      body.top = previous.top
      body.left = previous.left
      body.right = previous.right
      body.width = previous.width
      body.overflow = previous.overflow
      html.overflow = previous.htmlOverflow
      window.scrollTo(0, scrollY)
    }
  }, [commentsOpen, isDesktop])

  const closeSheet = useCallback(() => {
    setCommentsOpen(false)
    if (window.location.hash === COMMENTS_HASH) history.replaceState(null, '', window.location.pathname + window.location.search)
  }, [setCommentsOpen])

  useEffect(() => {
    if (!commentsOpen || isDesktop) return
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') closeSheet() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [commentsOpen, isDesktop, closeSheet])

  const loadPage = useCallback(async (pageCursor: string | null) => {
    setLoading(true)
    setError(null)
    if (pageCursor) {
      stickToBottomRef.current = false
      const list = listRef.current
      if (list) prependAnchorRef.current = list.scrollHeight - list.scrollTop
    }
    try {
      const params = pageCursor ? `?cursor=${encodeURIComponent(pageCursor)}` : ''
      const response = await fetch(`/api/public/stories/${storyId}/replies${params}`)
      if (!response.ok) throw new Error('Unable to load comments.')
      const page = (await response.json()) as StoryRepliesPage
      setComments((current) => {
        const seen = new Set(current.map((comment) => comment.id))
        return [...current, ...page.items.filter((comment) => !seen.has(comment.id))]
      })
      setCursor(page.nextCursor)
      setLoaded(true)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load comments.')
    } finally {
      setLoading(false)
    }
  }, [storyId])

  useEffect(() => {
    if (!active || loaded) return
    if (replyCount > 0) void loadPage(null)
    else setLoaded(true)
  }, [active, loaded, loadPage, replyCount])

  useEffect(() => {
    if (!loaded || !isRegistered || replyCount === 0) return
    let cancelled = false
    storiesApi<{ ids: string[]; reactions: Record<string, StoryReaction> }>(`/api/stories/${storyId}/replies/mine`)
      .then(({ ids, reactions }) => {
        if (cancelled) return
        if (ids.length) {
          setMineIds((current) => {
            const next = new Set(current)
            ids.forEach((id) => next.add(id))
            return next
          })
        }
        setMyReactions((current) => ({ ...reactions, ...current }))
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [loaded, isRegistered, replyCount, storyId])

  const rows = useMemo<Row[]>(() => {
    const chronological = [...comments].reverse()
    const oldestLoaded = chronological[0]?.created_at
    const markers = isEpisodic
      ? episodes.filter((episode) => episode.number > 1 && (!cursor || !oldestLoaded || episode.published_at >= oldestLoaded))
      : []
    const merged: Row[] = [
      ...chronological.map((comment) => ({ kind: 'comment' as const, comment })),
      ...markers.map((episode) => ({ kind: 'episode' as const, episode })),
    ]
    return merged.sort((a, b) => {
      const at = a.kind === 'comment' ? a.comment.created_at : a.episode.published_at
      const bt = b.kind === 'comment' ? b.comment.created_at : b.episode.published_at
      return at < bt ? -1 : at > bt ? 1 : 0
    })
  }, [comments, episodes, isEpisodic, cursor])

  useLayoutEffect(() => {
    const list = listRef.current
    if (!list) return
    if (prependAnchorRef.current !== null) {
      list.scrollTop = list.scrollHeight - prependAnchorRef.current
      prependAnchorRef.current = null
      return
    }
    if (stickToBottomRef.current) list.scrollTop = list.scrollHeight
  }, [rows, active])

  const onListScroll = () => {
    const list = listRef.current
    if (!list) return
    stickToBottomRef.current = list.scrollHeight - list.scrollTop - list.clientHeight < 80
  }

  const resizeInput = useCallback(() => {
    const input = inputRef.current
    if (!input) return
    input.style.height = 'auto'
    input.style.height = `${Math.min(input.scrollHeight, 132)}px`
  }, [])

  useLayoutEffect(resizeInput, [draft, resizeInput])

  const updateDraft = (text: string, target: ReplyTarget | null = replyTo) => {
    setDraft(text)
    writeDraft(storyId, text, target)
  }

  const startReply = useCallback((comment: StoryReply) => {
    const target = { id: comment.id, content: comment.content.slice(0, 160), avatar_seed: comment.avatar_seed }
    setReplyTo(target)
    setDraft((text) => {
      writeDraft(storyId, text, target)
      return text
    })
    setCommentsOpen(true)
    requestAnimationFrame(() => inputRef.current?.focus())
  }, [storyId, setCommentsOpen])

  const cancelReply = () => {
    setReplyTo(null)
    writeDraft(storyId, draft, null)
  }

  const post = async () => {
    const content = draft.trim()
    if (!content || posting) return
    if (!isRegistered) {
      requireAccount('comment', content)
      return
    }
    setPosting(true)
    setPostError(null)
    try {
      const { reply } = await storiesApi<{ reply: StoryReply }>(`/api/stories/${storyId}/replies`, {
        method: 'POST',
        body: JSON.stringify({ content, parentId: replyTo?.id ?? null }),
      })
      stickToBottomRef.current = true
      setComments((current) => [reply, ...current])
      setMineIds((current) => new Set(current).add(reply.id))
      setReplyTo(null)
      updateDraft('', null)
      import('posthog-js').then(({ default: posthog }) => posthog.capture('story_reply_posted', { story_id: storyId, is_reply: Boolean(replyTo) })).catch(() => {})
    } catch (cause) {
      if (cause instanceof StoriesApiError && cause.code === 'account_required') requireAccount('comment', content)
      else setPostError(cause instanceof Error ? cause.message : 'Unable to post your comment.')
    } finally {
      setPosting(false)
    }
  }

  const onInputKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && window.matchMedia('(pointer: fine)').matches) {
      event.preventDefault()
      void post()
    }
  }

  const onEdit = useCallback(async (id: string, content: string) => {
    const { reply } = await storiesApi<{ reply: Pick<StoryReply, 'id' | 'content'> }>(`/api/stories/${storyId}/replies/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ content }),
    })
    setComments((current) => current.map((item) => (item.id === id ? { ...item, content: reply.content, is_edited: true } : item)))
  }, [storyId])

  const myReactionsRef = useRef(myReactions)
  myReactionsRef.current = myReactions

  const onReact = useCallback((id: string, reaction: StoryReaction) => {
    if (!isRegistered) {
      requireAccount('react')
      return
    }
    const previousMine = myReactionsRef.current[id] ?? null
    const nextMine = previousMine === reaction ? null : reaction
    let previousCounts: ReactionCounts = {}
    setComments((current) => current.map((item) => {
      if (item.id !== id) return item
      previousCounts = item.reaction_counts ?? {}
      const counts: ReactionCounts = { ...previousCounts }
      if (previousMine) counts[previousMine] = Math.max((counts[previousMine] ?? 1) - 1, 0)
      if (nextMine) counts[nextMine] = (counts[nextMine] ?? 0) + 1
      return { ...item, reaction_counts: counts }
    }))
    setMyReactions((current) => {
      const next = { ...current }
      if (nextMine) next[id] = nextMine
      else delete next[id]
      return next
    })
    storiesApi<{ counts: ReactionCounts; mine: StoryReaction | null }>(`/api/stories/${storyId}/replies/${id}/reactions`, {
      method: 'POST',
      body: JSON.stringify({ reaction }),
    })
      .then((result) => {
        setComments((current) => current.map((item) => (item.id === id ? { ...item, reaction_counts: result.counts ?? {} } : item)))
        setMyReactions((current) => {
          const next = { ...current }
          if (result.mine) next[id] = result.mine
          else delete next[id]
          return next
        })
      })
      .catch((cause) => {
        setComments((current) => current.map((item) => (item.id === id ? { ...item, reaction_counts: previousCounts } : item)))
        setMyReactions((current) => {
          const next = { ...current }
          if (previousMine) next[id] = previousMine
          else delete next[id]
          return next
        })
        if (cause instanceof StoriesApiError && cause.code === 'account_required') requireAccount('react')
      })
  }, [isRegistered, requireAccount, storyId])

  const onQuoteClick = useCallback((id: string) => {
    const node = document.getElementById(`comment-${id}`)
    if (!node) return
    node.scrollIntoView({ block: 'center', behavior: 'smooth' })
    setHighlightId(id)
    window.setTimeout(() => setHighlightId((current) => (current === id ? null : current)), 1600)
  }, [])

  const onReport = useCallback((id: string) => {
    setReportingId(id)
    setReportState('idle')
  }, [])

  const sendReport = async (reason: string) => {
    if (!reportingId) return
    setReportState('sending')
    try {
      await storiesApi(`/api/stories/${storyId}/replies/${reportingId}/report`, { method: 'POST', body: JSON.stringify({ reason }) })
      setReportState('sent')
    } catch (cause) {
      setReportingId(null)
      if (cause instanceof StoriesApiError && cause.code === 'account_required') requireAccount('report')
    }
  }

  const total = Math.max(replyCount, comments.length)
  const chrome = 'md:left-20'

  return (
    <>
      <div className={`fixed inset-x-0 bottom-0 z-40 border-t border-[#1C1C26] bg-[#0A0A10]/95 px-3 pb-[max(0.625rem,env(safe-area-inset-bottom))] pt-2.5 backdrop-blur-lg lg:hidden ${chrome}`}>
        <div className="mx-auto flex max-w-2xl items-center gap-2">
          <button
            onClick={() => {
              setCommentsOpen(true)
              requestAnimationFrame(() => inputRef.current?.focus())
            }}
            className="flex h-11 flex-1 items-center rounded-full border border-[#2A2A38] bg-[#12121A] px-4 text-left text-sm text-[#5C5C6E]"
          >
            <span className="truncate">{draft ? draft : 'Add a comment…'}</span>
          </button>
          <button
            onClick={() => setCommentsOpen(true)}
            className="inline-flex h-11 items-center gap-1.5 rounded-full border border-[#2A2A38] px-3.5 text-sm text-[#DFDFE7]"
            aria-label={`Open comments, ${total}`}
          >
            <MessageCircle className="h-4 w-4" />
            <span className="tabular-nums">{total}</span>
          </button>
        </div>
      </div>

      {commentsOpen && !isDesktop && <div className={`fixed inset-0 z-50 touch-none bg-black/55 lg:hidden ${chrome}`} onClick={closeSheet} aria-hidden />}

      <section
        id="comments"
        aria-labelledby="comments-heading"
        className={`fixed inset-x-0 bottom-0 z-50 flex h-[88dvh] flex-col rounded-t-3xl border-t border-[#23232E] bg-[#0D0D14] transition-transform duration-300 ease-out ${chrome} ${
          commentsOpen ? 'translate-y-0' : 'invisible translate-y-full'
        } lg:visible lg:static lg:z-auto lg:h-full lg:min-h-0 lg:translate-y-0 lg:rounded-none lg:border-l lg:border-t-0 lg:border-[#1C1C26] lg:transition-none`}
      >
        <header className="relative flex shrink-0 items-center justify-between gap-3 border-b border-[#1C1C26] px-4 pb-3 pt-4 md:px-5 lg:pt-3">
          <div className="absolute left-1/2 top-1.5 h-1 w-10 -translate-x-1/2 rounded-full bg-[#2A2A38] lg:hidden" />
          <h2 id="comments-heading" className="text-base font-medium text-[#F2F2F6]">
            Comments <span className="text-[#5C5C6E]">· {total}</span>
          </h2>
          <button onClick={closeSheet} aria-label="Close comments" className="rounded-lg p-1.5 text-[#8F8FA3] hover:bg-white/[0.05] hover:text-[#F2F2F6] lg:hidden">
            <ChevronDown className="h-5 w-5" />
          </button>
        </header>

        <div ref={listRef} onScroll={onListScroll} className="scrollbar-hide min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {cursor && (
            <div className="px-4 pt-3 md:px-5">
              <button onClick={() => loadPage(cursor)} disabled={loading} className="w-full rounded-xl border border-[#23232E] py-2.5 text-xs text-[#8F8FA3] hover:text-[#F2F2F6] disabled:opacity-50">
                Show earlier comments
              </button>
            </div>
          )}

          {loading && !loaded && (
            <div className="flex justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-[#5C5C6E]" />
            </div>
          )}
          {error && (
            <p className="px-4 py-4 text-center text-xs text-[#F09595]">
              {error} <button className="underline" onClick={() => loadPage(cursor)}>Try again</button>
            </p>
          )}
          {loaded && !loading && comments.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center px-8 py-12 text-center">
              <MessageCircle className="h-8 w-8 text-[#2A2A38]" />
              <p className="mt-3 text-sm text-[#DFDFE7]">No comments yet</p>
              <p className="mt-1 text-xs text-[#5C5C6E]">Be the first to say how this landed with you.</p>
            </div>
          )}

          <ul className="divide-y divide-[#16161F] pb-2">
            {rows.map((row) =>
              row.kind === 'comment' ? (
                <CommentRow
                  key={row.comment.id}
                  comment={row.comment}
                  mine={mineIds.has(row.comment.id)}
                  myReaction={myReactions[row.comment.id] ?? null}
                  highlighted={highlightId === row.comment.id}
                  onReply={startReply}
                  onReport={onReport}
                  onEdit={onEdit}
                  onReact={onReact}
                  onQuoteClick={onQuoteClick}
                />
              ) : (
                <li key={`episode-${row.episode.number}`} className="flex items-center gap-3 px-4 py-3 text-[11px] uppercase tracking-[0.1em] text-[#FDBA74] md:px-5">
                  <span className="h-px flex-1 bg-[#F97316]/25" />
                  Episode {row.episode.number} published
                  <span className="h-px flex-1 bg-[#F97316]/25" />
                </li>
              )
            )}
          </ul>
        </div>

        <div className="shrink-0 border-t border-[#1C1C26] bg-[#0D0D14] px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2.5 md:px-4">
          {replyTo && (
            <div className="mb-2 flex items-start gap-2 rounded-xl border-l-2 border-[#8B5CF6] bg-white/[0.04] px-3 py-2">
              <CornerUpLeft className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#C4B5FD]" />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium text-[#C4B5FD]">Replying to</p>
                <p className="line-clamp-1 text-xs text-[#8F8FA3]">{replyTo.content}</p>
              </div>
              <button onClick={cancelReply} aria-label="Cancel reply" className="rounded p-0.5 text-[#5C5C6E] hover:text-[#F2F2F6]">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={draft}
              onChange={(event) => updateDraft(event.target.value.slice(0, STORY_LIMITS.replyMax))}
              onKeyDown={onInputKeyDown}
              rows={1}
              placeholder={replyTo ? 'Write a reply…' : 'Add a comment…'}
              aria-label={replyTo ? 'Write a reply' : 'Add a comment'}
              className="scrollbar-hide max-h-[132px] min-h-[44px] flex-1 resize-none rounded-2xl border border-[#2A2A38] bg-[#12121A] px-4 py-[11px] text-sm leading-[22px] text-[#F2F2F6] placeholder:text-[#5C5C6E] focus:border-[#8B5CF6]/60 focus:outline-none"
            />
            <button
              onClick={post}
              disabled={!draft.trim() || posting}
              aria-label={replyTo ? 'Send reply' : 'Post comment'}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-[#8B5CF6] to-[#F97316] text-white transition-opacity disabled:opacity-35"
            >
              {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
          {(postError || draft.length > STORY_LIMITS.replyMax * 0.8) && (
            <div className="mt-1.5 flex items-center justify-between gap-2 px-1 text-[11px]">
              <span className="text-[#F09595]">{postError}</span>
              {draft.length > STORY_LIMITS.replyMax * 0.8 && <span className="text-[#5C5C6E]">{draft.length}/{STORY_LIMITS.replyMax}</span>}
            </div>
          )}
        </div>
      </section>

      {reportingId && (
        <div className="fixed inset-0 z-[1300] flex items-end justify-center bg-black/60 sm:items-center sm:p-4" onClick={() => setReportingId(null)}>
          <div className="w-full rounded-t-2xl border border-[#23232E] bg-[#12121A] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:max-w-sm sm:rounded-2xl" onClick={(event) => event.stopPropagation()}>
            {reportState === 'sent' ? (
              <>
                <p className="text-sm font-medium text-[#F2F2F6]">Report received</p>
                <p className="mt-1 text-xs leading-5 text-[#8F8FA3]">Comments reported by several readers are hidden until reviewed.</p>
                <button onClick={() => setReportingId(null)} className="mt-4 h-10 w-full rounded-xl bg-white/[0.08] text-sm text-[#F2F2F6]">Done</button>
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-[#F2F2F6]">Why are you reporting this comment?</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {REPORT_REASONS.map((option) => (
                    <button
                      key={option.value}
                      disabled={reportState === 'sending'}
                      onClick={() => sendReport(option.value)}
                      className="rounded-xl border border-[#2A2A38] px-3 py-2.5 text-xs text-[#B9B9C6] hover:border-[#F97316]/40 disabled:opacity-50"
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
