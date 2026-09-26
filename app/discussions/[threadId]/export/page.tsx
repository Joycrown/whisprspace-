'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowLeft, Loader2 } from 'lucide-react'
import type { PromptResponse } from '@/lib/prompts/types'
import type { ExportSource } from '@/lib/prompts/export-types'
import { promptApi } from '@/lib/prompts/api-client'
import { extractThreadIdFromRef, buildThreadPath } from '@/lib/threads/thread-url'
import CarouselExport from '@/components/features/prompts/CarouselExport'

interface ThreadExportDetail {
  id: string
  title: string
  response_count: number
  is_premium: boolean
  responses: PromptResponse[]
}

export default function ThreadExportPage() {
  const params = useParams<{ threadId: string }>()
  const threadId = extractThreadIdFromRef(params.threadId)
  const [thread, setThread] = useState<ThreadExportDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const load = useCallback(async () => {
    if (!threadId) { setError('Discussion not found.'); setLoading(false); return }
    try {
      const result = await promptApi<{ thread: ThreadExportDetail }>(`/api/threads/${threadId}/export`)
      setThread(result.thread)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to load this discussion.') } finally { setLoading(false) }
  }, [threadId])
  useEffect(() => { load() }, [load])
  if (loading) return <div className="min-h-screen bg-[#0A0A10] text-center text-[#8F8FA3]"><Loader2 className="mx-auto mt-28 h-6 w-6 animate-spin" /></div>
  if (!thread || !threadId) return <div className="min-h-screen bg-[#0A0A10] p-8 text-center text-[#F2F2F6]">{error || 'Discussion not found.'}</div>
  const threadPath = buildThreadPath({ id: thread.id, title: thread.title })
  const source: ExportSource = {
    id: thread.id,
    kind: 'thread',
    question: thread.title,
    responseCount: thread.response_count,
    isPremium: thread.is_premium,
    responses: thread.responses,
    url: typeof window === 'undefined' ? '' : `${window.location.origin}${threadPath}`,
    finalCta: 'Join the discussion',
  }
  return <main className="min-h-screen bg-[#0A0A10] px-4 py-8 text-[#F2F2F6]"><div className="mx-auto max-w-2xl"><Link href={threadPath} className="mb-6 inline-flex items-center gap-1 text-sm text-[#8F8FA3] hover:text-white"><ArrowLeft className="h-4 w-4" /> Discussion</Link><p className="text-xs font-medium uppercase tracking-[0.17em] text-[#C4B5FD]">Discussion export</p><h1 className="mt-2 text-2xl font-medium leading-snug">{thread.title}</h1><p className="mt-2 text-sm text-[#8F8FA3]">Choose the replies you want to turn into a finished shareable asset.</p><div className="mt-7"><CarouselExport source={source} /></div></div></main>
}
