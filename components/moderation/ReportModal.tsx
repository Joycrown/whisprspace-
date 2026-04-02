'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { createContentReport } from '@/lib/admin/admin-service'

interface ReportModalProps {
  contentType: 'thread' | 'message'
  contentId: string
  reportedUserId: string
  onClose: () => void
}

const REPORT_REASONS = [
  { value: 'harassment',      label: 'Harassment or targeted abuse' },
  { value: 'hate_speech',     label: 'Hate speech or discrimination' },
  { value: 'self_harm',       label: 'Self-harm or suicide content' },
  { value: 'sexual_content',  label: 'Explicit or sexual content' },
  { value: 'violence',        label: 'Threats or incitement to violence' },
  { value: 'spam',            label: 'Spam or fake content' },
  { value: 'misinformation',  label: 'Dangerous misinformation' },
  { value: 'other',           label: 'Something else' },
]

export function ReportModal({ contentType, contentId, reportedUserId, onClose }: ReportModalProps) {
  const [reason, setReason]       = useState('')
  const [context, setContext]     = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError]         = useState('')

  const handleSubmit = async () => {
    if (!reason || submitting) return
    setSubmitting(true)
    setError('')

    const result = await createContentReport(
      contentType,
      contentId,
      reportedUserId,
      reason,
      context || undefined
    )

    setSubmitting(false)

    if (result.alreadyReported) {
      setError('You have already reported this.')
      return
    }

    if (!result.success) {
      setError('Something went wrong. Please try again.')
      return
    }

    setSubmitted(true)
  }

  // ── Submitted state ──────────────────────────────────────────
  if (submitted) {
    return (
      <div
        className="fixed inset-0 bg-black/80 z-[1200] flex items-center justify-center p-6 modal-safe-overlay"
        onClick={onClose}
      >
        <div
          className="bg-[#111] border border-[#222] rounded-xl p-8 max-w-sm w-full text-center modal-safe-panel"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
            <span className="text-green-400 text-lg">✓</span>
          </div>
          <p className="text-white text-base font-medium mb-2">Report received.</p>
          <p className="text-gray-500 text-sm leading-relaxed mb-8">
            Thank you for helping keep this space safe for honest expression.
            We'll review this shortly.
          </p>
          <button
            onClick={onClose}
            className="text-sm text-gray-600 hover:text-gray-400 underline underline-offset-4 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    )
  }

  // ── Form state ───────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 bg-black/80 z-[1200] flex items-center justify-center p-4 modal-safe-overlay"
      onClick={onClose}
    >
      <div
        className="bg-[#111] border border-[#1e1e1e] rounded-xl w-full max-w-sm modal-safe-panel overflow-y-auto max-h-[calc(var(--app-viewport-height,100vh)-2rem)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-6 pt-6 pb-4 border-b border-[#1e1e1e]">
          <div>
            <p className="text-white text-base font-medium">Report this content</p>
            <p className="text-gray-600 text-xs mt-0.5 leading-relaxed">
              WhisprSpace protects honest expression — not harm.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-700 hover:text-gray-400 transition-colors p-0.5 flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Reason list */}
        <div className="px-6 py-4 flex flex-col gap-1.5">
          {REPORT_REASONS.map((r) => (
            <button
              key={r.value}
              onClick={() => setReason(r.value)}
              className={`text-left px-4 py-3 rounded-lg border text-sm transition-colors ${
                reason === r.value
                  ? 'border-white text-white bg-white/5'
                  : 'border-[#1e1e1e] text-gray-500 hover:border-[#333] hover:text-gray-300'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        {/* Additional context — only for 'other' */}
        {reason === 'other' && (
          <div className="px-6 pb-4">
            <textarea
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="Tell us more (optional)"
              rows={3}
              className="w-full bg-[#0d0d0d] border border-[#1e1e1e] rounded-lg text-white text-sm p-3 resize-none placeholder:text-gray-700 focus:outline-none focus:border-[#333]"
            />
          </div>
        )}

        {/* Error */}
        {error && (
          <p className="px-6 pb-2 text-red-400 text-xs">{error}</p>
        )}

        {/* Actions */}
        <div className="flex gap-3 px-6 pb-6">
          <button
            onClick={handleSubmit}
            disabled={!reason || submitting}
            className="flex-1 py-2.5 bg-white text-black text-sm font-medium rounded-lg disabled:opacity-40 hover:bg-gray-100 transition-colors"
          >
            {submitting ? 'Submitting...' : 'Submit Report'}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 border border-[#1e1e1e] text-gray-500 text-sm rounded-lg hover:border-[#333] hover:text-gray-300 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
