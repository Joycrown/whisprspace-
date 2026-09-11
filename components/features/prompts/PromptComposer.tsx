'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ChevronLeft, Copy, Loader2, Share2 } from 'lucide-react'
import posthog from 'posthog-js'
import { PROMPT_LIBRARY } from '@/lib/prompts/library'
import { promptApi } from '@/lib/prompts/api-client'
import { PROMPT_CATEGORIES, PROMPT_DURATIONS, type Prompt, type PromptCategory, type PromptDuration } from '@/lib/prompts/types'
import { useUserStore } from '@/store/userStore'
import { useShareLink } from '@/lib/hooks/useShareLink'
import { ShareDropdown } from '@/components/features/inbox/ShareDropdown'
import { buildPromptPath } from '@/lib/prompts/prompt-url'
import PromptShareCard from './PromptShareCard'

const categoryLabels: Record<PromptCategory, string> = {
  work: 'Work', money: 'Money', love: 'Love', family: 'Family', campus: 'Campus', general: 'General',
}

const durationLabels: Record<PromptDuration, string> = {
  '24h': '24 hours', '48h': '48 hours', '7d': '7 days',
}

export default function PromptComposer() {
  const router = useRouter()
  const { session, sessionValidated } = useUserStore()
  const isPremium = Boolean(session.user?.isPremium)
  const [question, setQuestion] = useState('')
  const [category, setCategory] = useState<PromptCategory>('general')
  const [duration, setDuration] = useState<PromptDuration>('48h')
  const [libraryKey, setLibraryKey] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createdPrompt, setCreatedPrompt] = useState<Prompt | null>(null)
  const shareButtonRef = useRef<HTMLButtonElement>(null)

  const promptUrl =
    createdPrompt && typeof window !== 'undefined'
      ? `${window.location.origin}${buildPromptPath({ id: createdPrompt.id, question: createdPrompt.question })}`
      : ''

  const {
    copied,
    showDropdown,
    dropdownPos,
    shareCardRef,
    isGeneratingCard,
    openDropdown,
    closeDropdown,
    copyLink,
    shareOnTwitter,
    shareOnFacebook,
    shareOnWhatsApp,
    shareOnLinkedIn,
    shareOnInstagram,
    shareViaEmail,
    downloadShareCard,
  } = useShareLink({
    link: promptUrl,
    shareText: createdPrompt
      ? `Answer this anonymously: "${createdPrompt.question}"`
      : 'Answer this anonymously on WhisprSpace.',
    downloadName: 'my-whisprspace-ask',
  })

  const suggestions = useMemo(
    () => PROMPT_LIBRARY.filter((item) => item.category === category).slice(0, 6),
    [category]
  )

  const chooseLibraryPrompt = (key: string) => {
    const selected = PROMPT_LIBRARY.find((item) => item.key === key)
    if (!selected) return
    setLibraryKey(selected.key)
    setQuestion(selected.question)
    setCategory(selected.category)
  }

  const handleCreate = async () => {
    if (!question.trim() || isSubmitting) return
    setError(null)
    setIsSubmitting(true)
    try {
      const { prompt } = await promptApi<{ prompt: Prompt }>('/api/prompts', {
        method: 'POST',
        body: JSON.stringify({ question, category, duration, libraryKey }),
      })
      setCreatedPrompt(prompt)
      try { posthog.capture('prompt_created', { category: prompt.category, duration, library_key: prompt.library_key }) } catch { /* analytics is optional */ }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to create your prompt.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const needsSignup = sessionValidated && (!session.user?.id || session.user.isAnonymous)
  useEffect(() => {
    if (needsSignup) router.replace('/auth?force=1&view=signup&reason=prompt&redirect=%2Fcuriosity-ask%2Fcreate')
  }, [needsSignup, router])

  if (needsSignup) return null

  if (createdPrompt) {
    const openSharePicker = () => {
      if (!shareButtonRef.current) return
      openDropdown(shareButtonRef.current.getBoundingClientRect())
    }

    return (
      <div className="min-h-screen bg-[#0A0A10] px-4 py-12 text-[#F2F2F6]">
        <div className="mx-auto max-w-lg rounded-2xl border border-[#23232E] bg-[#12121A] p-6 text-center md:p-8">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-[#5DCAA5]/30 bg-[#5DCAA5]/10"><Check className="h-7 w-7 text-[#5DCAA5]" /></div>
          <p className="mb-1 text-xl font-medium">Your ask is live.</p>
          <p className="mb-6 text-sm text-[#8F8FA3]">Share it now to start collecting anonymous answers.</p>
          <div className="mb-6 rounded-xl border border-[#2A2A38] bg-white/[0.02] p-4 text-left text-sm text-[#C4B5FD]">{createdPrompt.question}</div>
          <div className="space-y-3">
            <button ref={shareButtonRef} onClick={openSharePicker} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#F97316] text-sm font-medium text-white"><Share2 className="h-4 w-4" /> Share this ask</button>
            <button onClick={copyLink} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#2A2A38] text-sm text-[#F2F2F6]"><Copy className="h-4 w-4" /> {copied ? 'Copied' : 'Copy link'}</button>
            <button onClick={() => router.push(`/curiosity-ask/${createdPrompt.id}/manage`)} className="h-11 w-full text-sm text-[#8F8FA3] hover:text-white">View responses</button>
          </div>
        </div>

        {showDropdown && (
          <ShareDropdown
            position={dropdownPos}
            onClose={closeDropdown}
            onCopyLink={copyLink}
            onTwitter={shareOnTwitter}
            onFacebook={shareOnFacebook}
            onWhatsApp={shareOnWhatsApp}
            onLinkedIn={shareOnLinkedIn}
            onInstagram={shareOnInstagram}
            onEmail={() => shareViaEmail('Answer this anonymously')}
            onDownloadCard={downloadShareCard}
            isGeneratingCard={isGeneratingCard}
          />
        )}

        <div className="pointer-events-none fixed -left-[2000px] top-0">
          <PromptShareCard ref={shareCardRef} question={createdPrompt.question} expiresAt={createdPrompt.expires_at} promptUrl={promptUrl} />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0A0A10] px-4 py-8 text-[#F2F2F6] md:py-12">
      <div className="mx-auto max-w-2xl">
        <button onClick={() => router.back()} className="mb-7 inline-flex items-center gap-1 text-sm text-[#8F8FA3] hover:text-white"><ChevronLeft className="h-4 w-4" /> Back</button>
        <div className="mb-8"><p className="mb-2 text-sm font-medium uppercase tracking-[0.18em] text-[#C4B5FD]">Curiosity Ask</p><h1 className="text-3xl font-semibold tracking-tight">Ask a better question.</h1><p className="mt-2 text-sm text-[#8F8FA3]">Answers stay private until you choose what to share.</p></div>

        <div className="space-y-6 rounded-2xl border border-[#23232E] bg-[#12121A] p-5 md:p-7">
          <section>
            <label className="mb-2 block text-sm font-medium">Question</label>
            <textarea value={question} onChange={(event) => { setQuestion(event.target.value.slice(0, 280)); setLibraryKey(null) }} rows={3} placeholder="What do you want people to answer honestly?" className="w-full resize-none rounded-xl border border-[#2A2A38] bg-white/[0.03] px-4 py-3 text-sm text-white placeholder:text-[#5C5C6E] focus:border-[#8B5CF6]/70 focus:outline-none" />
            <div className="mt-1 text-right text-xs text-[#5C5C6E]">{question.length}/280</div>
          </section>

          <section>
            <label className="mb-2 block text-sm font-medium">Category</label>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">{PROMPT_CATEGORIES.map((value) => <button key={value} type="button" onClick={() => setCategory(value)} className={`rounded-lg border px-2 py-2 text-xs capitalize transition-colors ${category === value ? 'border-[#8B5CF6]/70 bg-[#8B5CF6]/15 text-[#E9E1FF]' : 'border-[#2A2A38] text-[#8F8FA3] hover:border-[#8B5CF6]/35'}`}>{categoryLabels[value]}</button>)}</div>
          </section>

          <section>
            <div className="mb-2 flex items-baseline justify-between"><label className="block text-sm font-medium">Try a library question</label><span className="text-xs text-[#5C5C6E]">Curated for safe, honest answers</span></div>
            <div className="grid gap-2">{suggestions.map((item) => <button key={item.key} type="button" onClick={() => chooseLibraryPrompt(item.key)} className={`rounded-xl border p-3 text-left text-sm transition-colors ${libraryKey === item.key ? 'border-[#F97316]/60 bg-[#F97316]/10 text-white' : 'border-[#2A2A38] text-[#C8C8D2] hover:border-[#F97316]/35'}`}>{item.question}</button>)}</div>
          </section>

          <section>
            <label className="mb-2 block text-sm font-medium">Who can see answers?</label>
            <div className="grid gap-2 sm:grid-cols-2"><button type="button" className="rounded-xl border border-[#8B5CF6]/65 bg-[#8B5CF6]/10 p-3 text-left"><span className="block text-sm font-medium">Private</span><span className="mt-1 block text-xs text-[#8F8FA3]">Only you see the answers, until you decide to share them.</span></button><div className="rounded-xl border border-[#2A2A38] p-3 opacity-60"><span className="block text-sm font-medium">Open <span className="ml-1 text-xs text-[#F97316]">Coming soon</span></span><span className="mt-1 block text-xs text-[#8F8FA3]">People can read others&apos; answers after they send theirs.</span></div></div>
          </section>

          <section>
            <label className="mb-2 block text-sm font-medium">Duration</label>
            <div className="grid grid-cols-3 gap-2">{PROMPT_DURATIONS.map((value) => {
              const locked = value === '7d' && !isPremium
              return <button key={value} type="button" disabled={locked} onClick={() => setDuration(value)} className={`relative rounded-xl border py-3 text-sm transition-colors ${locked ? 'cursor-not-allowed border-[#2A2A38] text-[#5C5C6E] opacity-60' : duration === value ? 'border-[#8B5CF6]/70 bg-[#8B5CF6]/15 text-white' : 'border-[#2A2A38] text-[#8F8FA3] hover:border-[#8B5CF6]/35'}`}>{durationLabels[value]}{locked && <span className="ml-1.5 text-[10px] text-[#F97316]">Premium</span>}</button>
            })}</div>
            {!isPremium && <p className="mt-2 text-xs text-[#5C5C6E]">Keep an ask open for a full week with Premium.</p>}
          </section>

          {error && <p className="rounded-xl border border-red-400/25 bg-red-400/10 px-4 py-3 text-sm text-red-200">{error}</p>}
          <button disabled={!question.trim() || isSubmitting} onClick={handleCreate} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#F97316] text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40">{isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}{isSubmitting ? 'Publishing…' : 'Publish ask'}</button>
        </div>
      </div>
    </div>
  )
}
