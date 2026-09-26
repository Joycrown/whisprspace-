'use client'

import { useState } from 'react'
import { Loader2, X } from 'lucide-react'
import { storiesApi } from '@/lib/stories/api-client'
import { STORY_REPORT_REASONS, type StoryReportReason } from '@/lib/stories/types'

export default function ReportStoryModal({ storyId, onClose }: { storyId: string; onClose: () => void }) {
  const [reason, setReason] = useState<StoryReportReason | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    if (!reason || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      await storiesApi(`/api/stories/${storyId}/report`, { method: 'POST', body: JSON.stringify({ reason }) })
      setDone(true)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to send your report.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[1300] flex items-end justify-center bg-black/60 sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className="w-full rounded-t-2xl border border-[#23232E] bg-[#12121A] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-[#F2F2F6] sm:max-w-md sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-medium">{done ? 'Thanks for telling us' : 'Report this story'}</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-[#5C5C6E] hover:text-[#F2F2F6]">
            <X className="h-4 w-4" />
          </button>
        </div>
        {done ? (
          <p className="mt-3 text-sm leading-6 text-[#8F8FA3]">We’ll take a look. Stories reported by several readers are hidden until our team reviews them.</p>
        ) : (
          <>
            <div className="mt-4 space-y-1.5">
              {STORY_REPORT_REASONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setReason(option.value)}
                  className={`w-full rounded-xl border px-3 py-2.5 text-left text-sm transition-colors ${
                    reason === option.value ? 'border-[#F97316]/50 bg-[#F97316]/[0.07] text-[#F2F2F6]' : 'border-[#2A2A38] text-[#B9B9C6]'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            {error && <p className="mt-3 text-xs text-[#F09595]">{error}</p>}
            <button
              onClick={submit}
              disabled={!reason || submitting}
              className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-white/[0.08] text-sm text-[#F2F2F6] disabled:opacity-40"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Send report
            </button>
          </>
        )}
      </div>
    </div>
  )
}
