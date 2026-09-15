'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowLeft, Loader2 } from 'lucide-react'
import type { PromptDetail } from '@/lib/prompts/types'
import type { ExportSource } from '@/lib/prompts/export-types'
import { promptApi } from '@/lib/prompts/api-client'
import CarouselExport from '@/components/features/prompts/CarouselExport'
import { buildPromptPath } from '@/lib/prompts/prompt-url'

export default function PromptExportPage() {
  const params = useParams<{ id: string }>()
  const [prompt, setPrompt] = useState<PromptDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const load = useCallback(async () => { try { const result = await promptApi<{ prompt: PromptDetail }>(`/api/prompts/${params.id}`); setPrompt(result.prompt) } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to load this ask.') } finally { setLoading(false) } }, [params.id])
  useEffect(() => { load() }, [load])
  if (loading) return <div className="min-h-screen bg-[#0A0A10] text-center text-[#8F8FA3]"><Loader2 className="mx-auto mt-28 h-6 w-6 animate-spin" /></div>
  if (!prompt) return <div className="min-h-screen bg-[#0A0A10] p-8 text-center text-[#F2F2F6]">{error || 'Ask not found.'}</div>
  const source: ExportSource = {
    id: prompt.id,
    kind: 'prompt',
    question: prompt.question,
    responseCount: prompt.response_count,
    isPremium: prompt.is_premium,
    responses: prompt.responses,
    url: typeof window === 'undefined' ? '' : `${window.location.origin}${buildPromptPath({ id: prompt.id, question: prompt.question })}`,
    finalCta: 'Answer this',
    responseFormat: prompt.response_format,
    choice: prompt.response_format === 'choice' && prompt.options ? { options: prompt.options, correctOptionIndex: prompt.correct_option_index } : undefined,
  }
  return <main className="min-h-screen bg-[#0A0A10] px-4 py-8 text-[#F2F2F6]"><div className="mx-auto max-w-2xl"><Link href={`/curiosity-ask/${prompt.id}/manage`} className="mb-6 inline-flex items-center gap-1 text-sm text-[#8F8FA3] hover:text-white"><ArrowLeft className="h-4 w-4" /> Highlights</Link><p className="text-xs font-medium uppercase tracking-[0.17em] text-[#C4B5FD]">Export</p><h1 className="mt-2 text-2xl font-medium leading-snug">{prompt.question}</h1><p className="mt-2 text-sm text-[#8F8FA3]">Build a finished shareable asset from your selected anonymous answers.</p><div className="mt-7"><CarouselExport source={source} /></div></div></main>
}
