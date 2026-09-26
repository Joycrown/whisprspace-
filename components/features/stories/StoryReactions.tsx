'use client'

import { memo, useEffect, useRef, useState } from 'react'
import { SmilePlus } from 'lucide-react'
import { REACTION_EMOJI, STORY_REACTIONS, type ReactionCounts, type StoryReaction } from '@/lib/stories/types'
import { useStoryViewer } from './StoryViewerContext'

export function displayCount(counts: ReactionCounts | undefined, reaction: StoryReaction, mine: StoryReaction | null): number {
  const count = counts?.[reaction] ?? 0
  return mine === reaction ? Math.max(count, 1) : count
}

export function StoryReactionBar({ compact = false }: { compact?: boolean }) {
  const { reactionCounts, myReaction, react } = useStoryViewer()
  const total = STORY_REACTIONS.reduce((sum, reaction) => sum + displayCount(reactionCounts, reaction, myReaction), 0)

  return (
    <div className={compact ? '' : 'rounded-2xl border border-[#23232E] bg-[#12121A] px-4 py-3.5'}>
      {!compact && (
        <p className="mb-2.5 text-xs text-[#8F8FA3]">
          {total > 0 ? `${total} ${total === 1 ? 'reader' : 'readers'} reacted` : 'How did this land with you?'}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="React to this story">
        {STORY_REACTIONS.map((reaction) => {
          const count = displayCount(reactionCounts, reaction, myReaction)
          const active = myReaction === reaction
          return (
            <button
              key={reaction}
              onClick={() => react(reaction)}
              aria-pressed={active}
              aria-label={`${REACTION_EMOJI[reaction].label}${count ? `, ${count}` : ''}`}
              className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm transition-transform active:scale-90 ${
                active ? 'border-[#8B5CF6]/60 bg-[#8B5CF6]/15 text-[#F2F2F6]' : 'border-[#2A2A38] text-[#B9B9C6] hover:border-[#8B5CF6]/40'
              }`}
            >
              <span className="text-base leading-none">{REACTION_EMOJI[reaction].emoji}</span>
              {count > 0 && <span className="text-xs tabular-nums">{count}</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}

interface CommentReactionsProps {
  counts: ReactionCounts | undefined
  mine: StoryReaction | null
  onReact: (reaction: StoryReaction) => void
}

export const CommentReactions = memo(function CommentReactions({ counts, mine, onReact }: CommentReactionsProps) {
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const shown = STORY_REACTIONS.filter((reaction) => displayCount(counts, reaction, mine) > 0)

  useEffect(() => {
    if (!open) return
    const close = (event: PointerEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [open])

  const pick = (reaction: StoryReaction) => {
    setOpen(false)
    onReact(reaction)
  }

  return (
    <div ref={wrapperRef} className="relative flex flex-wrap items-center gap-1" onClick={(event) => event.stopPropagation()}>
      {shown.map((reaction) => (
        <button
          key={reaction}
          onClick={() => pick(reaction)}
          aria-pressed={mine === reaction}
          className={`inline-flex h-6 items-center gap-1 rounded-full border px-2 text-[11px] active:scale-90 ${
            mine === reaction ? 'border-[#8B5CF6]/60 bg-[#8B5CF6]/15 text-[#F2F2F6]' : 'border-[#2A2A38] text-[#8F8FA3]'
          }`}
        >
          <span className="text-xs leading-none">{REACTION_EMOJI[reaction].emoji}</span>
          <span className="tabular-nums">{displayCount(counts, reaction, mine)}</span>
        </button>
      ))}
      <button
        onClick={() => setOpen((value) => !value)}
        aria-label="Add reaction"
        aria-expanded={open}
        className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[#5C5C6E] hover:bg-white/[0.05] hover:text-[#DFDFE7]"
      >
        <SmilePlus className="h-3.5 w-3.5" />
      </button>
      {open && (
        <div className="absolute bottom-full left-0 z-20 mb-1.5 flex gap-0.5 rounded-full border border-[#2A2A38] bg-[#181822] p-1 shadow-xl">
          {STORY_REACTIONS.map((reaction) => (
            <button
              key={reaction}
              onClick={() => pick(reaction)}
              aria-label={REACTION_EMOJI[reaction].label}
              className={`flex h-9 w-9 items-center justify-center rounded-full text-lg transition-transform hover:scale-125 active:scale-95 ${
                mine === reaction ? 'bg-[#8B5CF6]/20' : ''
              }`}
            >
              {REACTION_EMOJI[reaction].emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  )
})
