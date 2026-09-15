'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, CheckCircle2, Send } from 'lucide-react'
import posthog from 'posthog-js'
import type { PromptResponseFormat } from '@/lib/prompts/types'

interface PromptDropProps {
  promptId: string
  question: string
  expiresAt: string
  responseFormat?: PromptResponseFormat
  options?: string[] | null
}

const hoursRemaining = (expiresAt: string) => Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (60 * 60 * 1000)))

export default function PromptDrop({ promptId, question, expiresAt, responseFormat = 'text', options }: PromptDropProps) {
  const router = useRouter()
  const [answer, setAnswer] = useState('')
  const [selectedOption, setSelectedOption] = useState<number | null>(null)
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  const isChoice = responseFormat === 'choice' && Array.isArray(options) && options.length >= 2

  const sendText = async () => {
    const content = answer.trim()
    if (!content || isSending) return
    setError(null)
    setIsSending(true)
    try {
      const response = await fetch(`/api/prompts/${promptId}/responses`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content }) })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data?.error || 'Unable to send your answer.')
      setAnswer('')
      setSent(true)
      try { posthog.capture('prompt_response_sent', { prompt_id: promptId }) } catch { /* analytics is optional */ }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to send your answer.')
    } finally {
      setIsSending(false)
    }
  }

  const sendChoice = async () => {
    if (selectedOption === null || isSending) return
    setError(null)
    setIsSending(true)
    try {
      const comment = answer.trim()
      const response = await fetch(`/api/prompts/${promptId}/responses`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ optionIndex: selectedOption, ...(comment ? { content: comment } : {}) }) })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data?.error || 'Unable to send your answer.')
      setSent(true)
      try { posthog.capture('prompt_response_sent', { prompt_id: promptId }) } catch { /* analytics is optional */ }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to send your answer.')
    } finally {
      setIsSending(false)
    }
  }

  if (dismissed) {
    return <div className="mx-auto w-full max-w-lg rounded-2xl border border-[#23232E] bg-[#12121A] p-7 text-center"><CheckCircle2 className="mx-auto mb-4 h-10 w-10 text-[#5DCAA5]" /><h1 className="text-xl font-medium text-[#F2F2F6]">Thank you.</h1><p className="mt-2 text-sm text-[#8F8FA3]">Ask what people are afraid to say out loud. Create an account and run your own Curiosity Ask — the questions everyone thinks, nobody says.</p><button onClick={() => { try { posthog.capture('prompt_cta_clicked', { prompt_id: promptId }) } catch {} ; router.push('/auth?force=1&view=signup&reason=prompt&redirect=%2Fcuriosity-ask%2Fcreate') }} className="mt-6 h-12 w-full rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#F97316] text-sm font-medium text-white">Create your own curiosity ask</button></div>
  }

  if (sent) {
    return <div className="mx-auto w-full max-w-lg rounded-2xl border border-[#23232E] bg-[#12121A] p-7 text-center"><CheckCircle2 className="mx-auto mb-4 h-10 w-10 text-[#5DCAA5]" /><h1 className="text-xl font-medium text-[#F2F2F6]">Sent. They&apos;ll never know it was you.</h1><p className="mt-2 text-sm text-[#8F8FA3]">Ask your people the same question.</p><button onClick={() => { try { posthog.capture('prompt_cta_clicked', { prompt_id: promptId }) } catch {} ; router.push('/auth?force=1&view=signup&reason=prompt&redirect=%2Fcuriosity-ask%2Fcreate') }} className="mt-6 h-12 w-full rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#F97316] text-sm font-medium text-white">Create your own curiosity ask</button><button onClick={() => setDismissed(true)} className="mt-3 text-sm text-[#5C5C6E] hover:text-[#8F8FA3]">Maybe later</button></div>
  }

  return (
    <div className="mx-auto w-full max-w-lg rounded-2xl border border-[#23232E] bg-[#12121A] p-6 md:p-8">
      <p className="mb-3 text-xs font-medium uppercase tracking-[0.18em] text-[#C4B5FD]">Curiosity Ask</p>
      <h1 className="text-2xl font-medium leading-snug tracking-tight text-[#F2F2F6]">{question}</h1>
      <div className="mt-4 flex gap-3 text-xs text-[#8F8FA3]"><span className="rounded-full bg-[#8B5CF6]/10 px-2.5 py-1 text-[#C4B5FD]">Closes in {hoursRemaining(expiresAt)}h</span></div>

      {isChoice ? (
        <div className="mt-6 space-y-2">
          {options!.map((option, index) => (
            <button
              key={index}
              onClick={() => setSelectedOption(index)}
              disabled={isSending}
              className={`w-full rounded-xl border px-4 py-3 text-left text-sm transition-colors disabled:cursor-not-allowed ${selectedOption === index ? 'border-[#8B5CF6]/70 bg-[#8B5CF6]/15 text-white' : 'border-[#2A2A38] text-[#F2F2F6] hover:border-[#8B5CF6]/40'}`}
            >
              {option}
            </button>
          ))}

          {selectedOption !== null && (
            <>
              <textarea value={answer} onChange={(event) => setAnswer(event.target.value.slice(0, 1000))} rows={3} placeholder="Add a reason or comment (optional)…" className="mt-2 w-full resize-none rounded-xl border border-[#2A2A38] bg-white/[0.03] px-4 py-3 text-sm text-[#F2F2F6] placeholder:text-[#5C5C6E] focus:border-[#8B5CF6]/70 focus:outline-none" />
              <div className="text-right text-xs text-[#5C5C6E]">{answer.length}/1000</div>
            </>
          )}

          {error && <p className="mt-1 flex gap-2 rounded-xl border border-red-400/25 bg-red-400/10 px-3 py-2 text-sm text-red-200"><AlertCircle className="h-4 w-4 shrink-0" />{error}</p>}

          <button onClick={sendChoice} disabled={selectedOption === null || isSending} className="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#F97316] text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"><Send className="h-4 w-4" />{isSending ? 'Sending…' : 'Submit'}</button>
        </div>
      ) : (
        <>
          <textarea value={answer} onChange={(event) => setAnswer(event.target.value.slice(0, 1000))} rows={6} placeholder="Share your answer honestly…" className="mt-6 w-full resize-none rounded-xl border border-[#2A2A38] bg-white/[0.03] px-4 py-3 text-sm text-[#F2F2F6] placeholder:text-[#5C5C6E] focus:border-[#8B5CF6]/70 focus:outline-none" />
          <div className="mt-1 text-right text-xs text-[#5C5C6E]">{answer.length}/1000</div>
          {error && <p className="mt-3 flex gap-2 rounded-xl border border-red-400/25 bg-red-400/10 px-3 py-2 text-sm text-red-200"><AlertCircle className="h-4 w-4 shrink-0" />{error}</p>}
          <button onClick={sendText} disabled={!answer.trim() || isSending} className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#F97316] text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"><Send className="h-4 w-4" />{isSending ? 'Sending…' : 'Send anonymously'}</button>
        </>
      )}

      <p className="mt-3 text-center text-xs text-[#5C5C6E]">No name. No trace.</p>
    </div>
  )
}
