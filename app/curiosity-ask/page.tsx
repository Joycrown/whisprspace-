'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowUpRight, Loader2, MessageSquarePlus, Sparkles } from 'lucide-react'
import { useUserStore } from '@/store/userStore'
import { promptApi } from '@/lib/prompts/api-client'
import type { Prompt } from '@/lib/prompts/types'

const PURGE_GRACE_DAYS = 3

const getStatus = (prompt: Prompt) => {
  const remaining = new Date(prompt.expires_at).getTime() - Date.now()
  if (remaining > 0) {
    const hours = Math.ceil(remaining / (60 * 60 * 1000))
    return `Closes in ${hours}h`
  }

  if (prompt.is_saved) return 'Closed · Saved'

  const purgeAt = new Date(prompt.expires_at).getTime() + PURGE_GRACE_DAYS * 24 * 60 * 60 * 1000
  const untilPurge = purgeAt - Date.now()
  if (untilPurge <= 0) return 'Closed'

  const purgeHours = Math.ceil(untilPurge / (60 * 60 * 1000))
  const purgeLabel = purgeHours >= 24 ? `${Math.ceil(purgeHours / 24)}d` : `${purgeHours}h`
  return `Closed · Clears in ${purgeLabel}`
}

export default function CuriosityAskPage() {
  const router = useRouter()
  const { session, sessionValidated } = useUserStore()
  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [loading, setLoading] = useState(true)

  const needsSignup = sessionValidated && (!session.user?.id || session.user.isAnonymous)

  useEffect(() => {
    if (needsSignup) {
      router.replace('/auth?force=1&view=signup&reason=prompt&redirect=%2Fcuriosity-ask')
    }
  }, [needsSignup, router])

  useEffect(() => {
    if (needsSignup) return
    let active = true
    promptApi<{ prompts: Prompt[] }>('/api/prompts')
      .then((result) => { if (active) setPrompts(result.prompts) })
      .catch(() => { if (active) setPrompts([]) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [needsSignup])

  if (!sessionValidated || needsSignup) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0A0A10]">
        <Loader2 className="h-6 w-6 animate-spin text-[#8F8FA3]" />
      </div>
    )
  }

  const visible = prompts

  return (
    <div className="min-h-screen bg-[#0A0A10] px-4 py-8 text-[#F2F2F6] md:py-12">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 shrink-0 text-[#FCA46A]" />
              <h1 className="text-2xl font-semibold tracking-tight">Curiosity Ask</h1>
            </div>
            <p className="mt-2 text-sm text-[#8F8FA3]">Ask one good question. Curate the answers. Share the story.</p>
          </div>
          <Link
            href="/curiosity-ask/create"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-orange-500 px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            <MessageSquarePlus className="h-4 w-4" />
            New Ask
          </Link>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-[#8F8FA3]" />
          </div>
        ) : visible.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#4B4267] bg-black/10 p-8 text-center text-sm text-gray-300">
            No asks yet. Start with a question your people will want to answer.
          </div>
        ) : (
          <div className="grid gap-2">
            {visible.map((prompt) => (
              <Link
                key={prompt.id}
                href={`/curiosity-ask/${prompt.id}/manage`}
                className="group flex min-w-0 items-center justify-between gap-4 rounded-xl border border-[#3B354E] bg-[#111019]/70 p-4 transition-colors hover:border-purple-500/60"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[#F2F2F6]">{prompt.question}</p>
                  <p className="mt-1 truncate text-xs text-[#8F8FA3]">{prompt.response_count} answers · {getStatus(prompt)}</p>
                </div>
                <ArrowUpRight className="h-4 w-4 shrink-0 text-[#8F8FA3] transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
