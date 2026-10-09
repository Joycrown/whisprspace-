'use client'

import { Loader2, Star } from 'lucide-react'
import type { PromptResponse } from '@/lib/prompts/types'

interface ResponsePickerProps {
  responses: PromptResponse[]
  changingId?: string | null
  onToggle: (response: PromptResponse) => void
  getOptionLabel?: (response: PromptResponse) => string | null
}

export default function ResponsePicker({ responses, changingId, onToggle, getOptionLabel }: ResponsePickerProps) {
  if (responses.length === 0) {
    return <div className="rounded-2xl border border-[#23232E] bg-[#12121A] px-5 py-12 text-center text-sm text-[#8F8FA3]">No responses yet. Share your ask to get things started.</div>
  }

  return <div className="space-y-3">{responses.map((response) => {
    const optionLabel = getOptionLabel?.(response)
    const reactions = [
      { emoji: '🫂', label: 'Same', count: response.same_count ?? 0 },
      { emoji: '🔥', label: 'Bold', count: response.bold_count ?? 0 },
      { emoji: '😮‍💨', label: 'Oof', count: response.oof_count ?? 0 },
    ].filter((reaction) => reaction.count > 0)
    return <article key={response.id} className={`rounded-2xl border p-4 transition-colors ${response.is_starred ? 'border-[#F97316]/50 bg-[#F97316]/[0.06]' : 'border-[#23232E] bg-[#12121A]'}`}><div className="flex items-start gap-3"><div className="min-w-0 flex-1">{optionLabel && <p className="mb-1.5 text-xs font-medium text-[#C4B5FD]">Picked: {optionLabel}</p>}<p className="whitespace-pre-wrap break-words text-sm leading-6 text-[#E6E6EC]">{response.content}</p></div><button type="button" onClick={() => onToggle(response)} disabled={changingId === response.id} aria-label={response.is_starred ? 'Remove highlight' : 'Highlight response'} className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-colors ${response.is_starred ? 'border-[#F97316]/50 bg-[#F97316]/15 text-[#FCA46A]' : 'border-[#2A2A38] text-[#5C5C6E] hover:border-[#F97316]/40 hover:text-[#FCA46A]'}`}>{changingId === response.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Star className="h-4 w-4" fill={response.is_starred ? 'currentColor' : 'none'} />}</button></div><div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[#5C5C6E]"><span>Anonymous · {new Date(response.created_at).toLocaleDateString()}</span>{reactions.length > 0 && <span className="flex flex-wrap gap-1.5">{reactions.map((reaction) => <span key={reaction.label} aria-label={`${reaction.label}, ${reaction.count}`} className="rounded-full bg-white/[0.04] px-2 py-0.5 text-[#C8C8D2]">{reaction.emoji} {reaction.count}</span>)}</span>}</div></article>
  })}</div>
}
