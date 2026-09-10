'use client'

import { Loader2, Star } from 'lucide-react'
import type { PromptResponse } from '@/lib/prompts/types'

interface ResponsePickerProps {
  responses: PromptResponse[]
  changingId?: string | null
  onToggle: (response: PromptResponse) => void
}

export default function ResponsePicker({ responses, changingId, onToggle }: ResponsePickerProps) {
  if (responses.length === 0) {
    return <div className="rounded-2xl border border-[#23232E] bg-[#12121A] px-5 py-12 text-center text-sm text-[#8F8FA3]">No responses yet. Share your prompt to get things started.</div>
  }

  return <div className="space-y-3">{responses.map((response) => <article key={response.id} className={`rounded-2xl border p-4 transition-colors ${response.is_starred ? 'border-[#F97316]/50 bg-[#F97316]/[0.06]' : 'border-[#23232E] bg-[#12121A]'}`}><div className="flex items-start gap-3"><p className="min-w-0 flex-1 whitespace-pre-wrap break-words text-sm leading-6 text-[#E6E6EC]">{response.content}</p><button type="button" onClick={() => onToggle(response)} disabled={changingId === response.id} aria-label={response.is_starred ? 'Remove highlight' : 'Highlight response'} className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-colors ${response.is_starred ? 'border-[#F97316]/50 bg-[#F97316]/15 text-[#FCA46A]' : 'border-[#2A2A38] text-[#5C5C6E] hover:border-[#F97316]/40 hover:text-[#FCA46A]'}`}>{changingId === response.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Star className="h-4 w-4" fill={response.is_starred ? 'currentColor' : 'none'} />}</button></div><div className="mt-3 text-xs text-[#5C5C6E]">Anonymous · {new Date(response.created_at).toLocaleDateString()}</div></article>)}</div>
}
