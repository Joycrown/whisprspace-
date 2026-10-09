'use client'

import { useState } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { formatTimestamp } from '@/lib/utils/utils/helpers/threadHelpers'
import type { PublicAskResponse, PublicAskResponsesPage } from '@/lib/prompts/public-types'
import type { PromptResponseFormat } from '@/lib/prompts/types'

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
  const [items, setItems] = useState<PublicAskResponse[]>(initialPage.items)
  const [nextCursor, setNextCursor] = useState<string | null>(initialPage.nextCursor)
  const [loadingMore, setLoadingMore] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  const isChoice = responseFormat === 'choice' && Array.isArray(options)
  const cards = isChoice ? items.filter((item) => item.content) : items
  const totalGuesses = (tally ?? []).reduce((sum, count) => sum + count, 0)

  const loadMore = async () => {
    if (!nextCursor || loadingMore) return
    setLoadingMore(true)
    setLoadError(null)
    try {
      const response = await fetch(`/api/public/asks/${askId}/responses?cursor=${encodeURIComponent(nextCursor)}`)
      const page = (await response.json().catch(() => null)) as PublicAskResponsesPage | null
      if (!response.ok || !page) throw new Error('Unable to load more answers.')
      setItems((current) => [...current, ...page.items.filter((item) => !current.some((existing) => existing.id === item.id))])
      setNextCursor(page.nextCursor)
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Unable to load more answers.')
    } finally {
      setLoadingMore(false)
    }
  }

  return (
    <section className="mx-auto w-full max-w-lg">
      <h2 className="mb-3 text-sm font-medium uppercase tracking-[0.16em] text-[#8F8FA3]">
        {isChoice ? 'How people guessed' : 'What people said'}
      </h2>

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

      {cards.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#2A2A38] px-5 py-10 text-center text-sm text-[#8F8FA3]">
          {closed ? 'No one answered before it closed.' : isChoice ? 'No comments yet.' : 'No answers yet. Yours could be the first.'}
        </div>
      ) : (
        <div className="space-y-3">
          {cards.map((item) => (
            <article key={item.id} className="rounded-2xl border border-[#23232E] bg-[#12121A] p-4">
              {isChoice && item.option_index !== null && options?.[item.option_index] && (
                <p className="mb-1.5 text-xs font-medium text-[#C4B5FD]">Picked: {options[item.option_index]}</p>
              )}
              <p className="whitespace-pre-wrap break-words text-sm leading-6 text-[#E6E6EC]">{item.content}</p>
              <p className="mt-2 text-xs text-[#5C5C6E]">Anonymous · {formatTimestamp(item.created_at)}</p>
            </article>
          ))}
        </div>
      )}

      {nextCursor && (
        <button
          type="button"
          onClick={loadMore}
          disabled={loadingMore}
          className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#2A2A38] text-sm text-[#E6E6EC] hover:border-[#8B5CF6]/45 disabled:opacity-50"
        >
          {loadingMore && <Loader2 className="h-4 w-4 animate-spin" />}
          {loadingMore ? 'Loading…' : 'Load more answers'}
        </button>
      )}
      {loadError && <p className="mt-2 text-center text-xs text-red-300">{loadError}</p>}
    </section>
  )
}
