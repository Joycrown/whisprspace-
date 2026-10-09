'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, Loader2, Lock } from 'lucide-react'
import { formatTimestamp } from '@/lib/utils/utils/helpers/threadHelpers'
import {
  ASK_REACTIONS,
  type AskReaction,
  type AskReactionResult,
  type AskSort,
  type AskViewerState,
  type PublicAskResponse,
  type PublicAskResponsesPage,
} from '@/lib/prompts/public-types'
import type { PromptResponseFormat } from '@/lib/prompts/types'
import { ASK_ANSWERED_EVENT } from './PromptDrop'
import { formatCompactCount } from './AskViewCount'

const REACTION_META: Record<AskReaction, { emoji: string; label: string }> = {
  same: { emoji: '🫂', label: 'Same' },
  bold: { emoji: '🔥', label: 'Bold' },
  oof: { emoji: '😮‍💨', label: 'Oof' },
}

const countFor = (item: PublicAskResponse, reaction: AskReaction) =>
  reaction === 'same' ? item.same_count : reaction === 'bold' ? item.bold_count : item.oof_count

const EMPTY_VIEWER: AskViewerState = { answered: false, ownResponseIds: [], reactions: {} }

interface PublicAskResponsesProps {
  askId: string
  responseFormat: PromptResponseFormat
  options: string[] | null
  tally: number[] | null
  correctOptionIndex: number | null
  closed: boolean
  initialPage: PublicAskResponsesPage
}

export default function PublicAskResponses({
  askId,
  responseFormat,
  options,
  tally,
  correctOptionIndex,
  closed,
  initialPage,
}: PublicAskResponsesProps) {
  const [sort, setSort] = useState<AskSort>('latest')
  const [items, setItems] = useState<PublicAskResponse[]>(initialPage.items)
  const [nextCursor, setNextCursor] = useState<string | null>(initialPage.nextCursor)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [viewer, setViewer] = useState<AskViewerState>(EMPTY_VIEWER)
  const [hint, setHint] = useState<string | null>(null)
  const pendingRef = useRef(new Set<string>())

  const isChoice = responseFormat === 'choice' && Array.isArray(options)
  const cards = isChoice ? items.filter((item) => item.content) : items
  const totalGuesses = (tally ?? []).reduce((sum, count) => sum + count, 0)

  const loadViewer = useCallback(async () => {
    try {
      const response = await fetch(`/api/prompts/${askId}/me`, { cache: 'no-store' })
      if (response.ok) setViewer((await response.json()) as AskViewerState)
    } catch {}
  }, [askId])

  useEffect(() => {
    loadViewer()
    const onAnswered = (event: Event) => {
      if ((event as CustomEvent<{ askId: string }>).detail?.askId !== askId) return
      setViewer((current) => ({ ...current, answered: true }))
      setHint(null)
      loadViewer()
    }
    window.addEventListener(ASK_ANSWERED_EVENT, onAnswered)
    return () => window.removeEventListener(ASK_ANSWERED_EVENT, onAnswered)
  }, [askId, loadViewer])

  useEffect(() => {
    if (!hint) return
    const timeoutId = setTimeout(() => setHint(null), 4000)
    return () => clearTimeout(timeoutId)
  }, [hint])

  const fetchPage = async (nextSort: AskSort, cursor: string | null) => {
    const params = new URLSearchParams({ sort: nextSort })
    if (cursor) params.set('cursor', cursor)
    const response = await fetch(`/api/public/asks/${askId}/responses?${params.toString()}`)
    const page = (await response.json().catch(() => null)) as PublicAskResponsesPage | null
    if (!response.ok || !page) throw new Error('Unable to load answers.')
    return page
  }

  const changeSort = async (nextSort: AskSort) => {
    if (nextSort === sort || loading) return
    setLoading(true)
    setLoadError(null)
    try {
      const page = await fetchPage(nextSort, null)
      setSort(nextSort)
      setItems(page.items)
      setNextCursor(page.nextCursor)
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Unable to load answers.')
    } finally {
      setLoading(false)
    }
  }

  const loadMore = async () => {
    if (!nextCursor || loading) return
    setLoading(true)
    setLoadError(null)
    try {
      const page = await fetchPage(sort, nextCursor)
      setItems((current) => [...current, ...page.items.filter((item) => !current.some((existing) => existing.id === item.id))])
      setNextCursor(page.nextCursor)
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Unable to load more answers.')
    } finally {
      setLoading(false)
    }
  }

  const applyResult = (responseId: string, reaction: AskReaction, result: Pick<AskReactionResult, 'active'> & Partial<AskReactionResult>) => {
    setItems((current) =>
      current.map((item) => {
        if (item.id !== responseId) return item
        const same = result.same ?? item.same_count
        const bold = result.bold ?? item.bold_count
        const oof = result.oof ?? item.oof_count
        return { ...item, same_count: same, bold_count: bold, oof_count: oof, reaction_total: same + bold + oof }
      })
    )
    setViewer((current) => {
      const existing = current.reactions[responseId] ?? []
      const next = result.active ? Array.from(new Set([...existing, reaction])) : existing.filter((value) => value !== reaction)
      return { ...current, reactions: { ...current.reactions, [responseId]: next } }
    })
  }

  const react = async (item: PublicAskResponse, reaction: AskReaction) => {
    if (!viewer.answered) {
      setHint(closed ? 'Only people who answered can react.' : 'Answer the question above to unlock reactions.')
      if (!closed) window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    const key = `${item.id}:${reaction}`
    if (pendingRef.current.has(key)) return
    pendingRef.current.add(key)

    const wasActive = (viewer.reactions[item.id] ?? []).includes(reaction)
    const delta = wasActive ? -1 : 1
    const before = { same: item.same_count, bold: item.bold_count, oof: item.oof_count }
    applyResult(item.id, reaction, {
      active: !wasActive,
      [reaction]: Math.max(0, countFor(item, reaction) + delta),
    })

    try {
      const response = await fetch(`/api/prompts/${askId}/responses/${item.id}/reactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reaction }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data?.error || 'Unable to react right now.')
      applyResult(item.id, reaction, data as AskReactionResult)
    } catch (error) {
      applyResult(item.id, reaction, { active: wasActive, ...before })
      setHint(error instanceof Error ? error.message : 'Unable to react right now.')
    } finally {
      pendingRef.current.delete(key)
    }
  }

  return (
    <section className="mx-auto w-full max-w-lg">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium uppercase tracking-[0.16em] text-[#8F8FA3]">
          {isChoice ? 'How people guessed' : 'What people said'}
        </h2>
        {cards.length > 1 && (
          <div className="flex rounded-full border border-[#2A2A38] p-0.5 text-xs">
            {(['latest', 'felt'] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => changeSort(value)}
                className={`rounded-full px-3 py-1 transition-colors ${sort === value ? 'bg-[#8B5CF6]/20 text-[#E9E1FF]' : 'text-[#8F8FA3] hover:text-white'}`}
              >
                {value === 'latest' ? 'Latest' : 'Most felt'}
              </button>
            ))}
          </div>
        )}
      </div>

      {isChoice && tally && totalGuesses > 0 && (
        <div className="mb-4 space-y-2 rounded-2xl border border-[#23232E] bg-[#12121A] p-4">
          {options!.map((option, index) => {
            const count = tally[index] ?? 0
            const percent = Math.round((count / totalGuesses) * 100)
            const isCorrect = correctOptionIndex === index
            return (
              <div key={index}>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className={`min-w-0 break-words ${isCorrect ? 'text-[#5DCAA5]' : 'text-[#E6E6EC]'}`}>
                    {option}
                    {isCorrect && <span className="ml-2 inline-flex items-center gap-1 text-xs"><Check className="h-3 w-3" />True answer</span>}
                  </span>
                  <span className="shrink-0 text-xs text-[#8F8FA3]">{percent}%</span>
                </div>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
                  <div className={`h-full rounded-full ${isCorrect ? 'bg-[#5DCAA5]' : 'bg-[#8B5CF6]'}`} style={{ width: `${percent}%` }} />
                </div>
              </div>
            )
          })}
          {!closed && <p className="pt-1 text-xs text-[#5C5C6E]">The true answer is revealed when this ask closes.</p>}
        </div>
      )}

      {cards.length > 0 && !viewer.answered && !closed && (
        <p className="mb-3 flex items-center gap-2 rounded-xl border border-[#2A2A38] bg-white/[0.02] px-3 py-2 text-xs text-[#8F8FA3]">
          <Lock className="h-3.5 w-3.5 shrink-0" />
          Answer the question to unlock reactions.
        </p>
      )}

      {hint && <p className="mb-3 rounded-xl border border-[#8B5CF6]/30 bg-[#8B5CF6]/10 px-3 py-2 text-xs text-[#C4B5FD]">{hint}</p>}

      {cards.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#2A2A38] px-5 py-10 text-center text-sm text-[#8F8FA3]">
          {closed ? 'No one answered before it closed.' : isChoice ? 'No comments yet.' : 'No answers yet. Yours could be the first.'}
        </div>
      ) : (
        <div className="space-y-3">
          {cards.map((item) => {
            const isOwn = viewer.ownResponseIds.includes(item.id)
            const mine = viewer.reactions[item.id] ?? []
            const locked = !viewer.answered
            return (
              <article key={item.id} className={`rounded-2xl border p-4 ${isOwn ? 'border-[#8B5CF6]/40 bg-[#8B5CF6]/[0.06]' : 'border-[#23232E] bg-[#12121A]'}`}>
                <div className="mb-1.5 flex flex-wrap items-center gap-2">
                  {isChoice && item.option_index !== null && options?.[item.option_index] && (
                    <p className="text-xs font-medium text-[#C4B5FD]">Picked: {options[item.option_index]}</p>
                  )}
                  {isOwn && <span className="rounded-full bg-[#8B5CF6]/20 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-[#E9E1FF]">Your answer</span>}
                </div>
                <p className="whitespace-pre-wrap break-words text-sm leading-6 text-[#E6E6EC]">{item.content}</p>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap gap-1.5">
                    {ASK_REACTIONS.map((reaction) => {
                      const count = countFor(item, reaction)
                      const active = mine.includes(reaction)
                      const disabled = isOwn
                      return (
                        <button
                          key={reaction}
                          type="button"
                          onClick={() => react(item, reaction)}
                          disabled={disabled}
                          aria-pressed={active}
                          aria-label={`${REACTION_META[reaction].label}${count ? `, ${count}` : ''}`}
                          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors disabled:cursor-default ${
                            active
                              ? 'border-[#F97316]/60 bg-[#F97316]/15 text-[#FCA46A]'
                              : locked || disabled
                                ? 'border-[#2A2A38] text-[#5C5C6E]'
                                : 'border-[#2A2A38] text-[#C8C8D2] hover:border-[#F97316]/40'
                          }`}
                        >
                          <span aria-hidden className={locked && !disabled ? 'opacity-60 grayscale' : ''}>{REACTION_META[reaction].emoji}</span>
                          <span>{REACTION_META[reaction].label}</span>
                          {count > 0 && <span className="font-medium">{formatCompactCount(count)}</span>}
                        </button>
                      )
                    })}
                  </div>
                  <p className="text-xs text-[#5C5C6E]">{formatTimestamp(item.created_at)}</p>
                </div>
              </article>
            )
          })}
        </div>
      )}

      {nextCursor && (
        <button
          type="button"
          onClick={loadMore}
          disabled={loading}
          className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#2A2A38] text-sm text-[#E6E6EC] hover:border-[#8B5CF6]/45 disabled:opacity-50"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {loading ? 'Loading…' : 'Load more answers'}
        </button>
      )}
      {loadError && <p className="mt-2 text-center text-xs text-red-300">{loadError}</p>}
    </section>
  )
}
