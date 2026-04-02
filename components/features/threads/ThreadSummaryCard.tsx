'use client'

import { useRef, useState, useEffect } from 'react'
import { toPng } from 'html-to-image'
import { Download, ArrowRight, Sparkles } from 'lucide-react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import posthog from 'posthog-js'

interface ThreadSummary {
  id: string
  thread_id: string
  participant_count: number
  perspective_count: number
  reaction_count: number
  duration_hours: number
  created_at: string
}

interface Props {
  summary: ThreadSummary
}

function humanizeImpact(summary: ThreadSummary) {
  const { participant_count: p, perspective_count: persp, reaction_count: r, duration_hours: h } = summary

  const voices =
    p === 0 ? "Your thread waited in silence. That's still honest."
    : p === 1 ? 'One person found their voice in your thread.'
    : p < 5 ? `${p} people found their voice here.`
    : `${p} people showed up for your thread.`

  const perspectives =
    persp === 0 ? null
    : persp === 1 ? 'One perspective was shared.'
    : persp < 10 ? `${persp} different perspectives collided here.`
    : `${persp} perspectives. That's a real conversation.`

  const resonance =
    r === 0 ? "Some things don't need a reaction — they just need to be said."
    : r < 5 ? 'A few people said this hit home.'
    : r < 20 ? 'This clearly hit a nerve with people.'
    : 'This thread struck something deep in people.'

  const duration =
    h < 24 ? `${h}h`
    : h < 48 ? '1 day'
    : `${Math.round(h / 24)}d`

  return { voices, perspectives, resonance, duration }
}

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.12, duration: 0.5, ease: [0.16, 1, 0.3, 1] },
  }),
}

export function ThreadSummaryCard({ summary }: Props) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [isDownloading, setIsDownloading] = useState(false)
  const [hasShared, setHasShared] = useState(false)
  const [downloadError, setDownloadError] = useState(false)

  const humanized = humanizeImpact(summary)

  useEffect(() => {
    try {
      posthog.capture('thread_summary_viewed', {
        thread_id: summary.thread_id,
        summary_id: summary.id,
        participant_count: summary.participant_count,
        perspective_count: summary.perspective_count,
        reaction_count: summary.reaction_count,
        duration_hours: summary.duration_hours,
      })
    } catch { /* PostHog not available in dev */ }
  }, [summary.id])

  const handleDownload = async () => {
    if (!cardRef.current || isDownloading) return
    setIsDownloading(true)
    setDownloadError(false)

    try {
      const dataUrl = await toPng(cardRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: '#0d0d0d',
      })

      const link = document.createElement('a')
      link.download = 'my-whisprspace-moment.png'
      link.href = dataUrl
      link.click()

      await fetch('/api/summaries/mark-shared', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ summaryId: summary.id }),
      })

      posthog.capture('thread_summary_shared', {
        thread_id: summary.thread_id,
        summary_id: summary.id,
      })

      setHasShared(true)
    } catch (err) {
      console.error('[ThreadSummaryCard] Download failed:', err)
      setDownloadError(true)
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <div className="w-full max-w-lg mx-auto flex flex-col items-center gap-8">

      {/* ── THE CARD (captured as PNG) ── */}
      <motion.div
        ref={cardRef}
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        style={{
          width: '100%',
          backgroundColor: '#0d0d0d',
          fontFamily: 'Georgia, "Times New Roman", serif',
          position: 'relative',
          overflow: 'hidden',
          border: '1px solid rgba(109,40,217,0.3)',
        }}
      >
        {/* Top gradient accent bar */}
        <div style={{
          height: '2px',
          background: 'linear-gradient(90deg, #7c3aed, #db2777, #7c3aed)',
          width: '100%',
        }} />

        {/* Subtle background glow inside card */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(109,40,217,0.08) 0%, transparent 60%)',
          pointerEvents: 'none',
        }} />

        <div style={{ padding: '40px 36px 40px', position: 'relative' }}>

          {/* Brand + duration row */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '44px',
          }}>
            <span style={{
              fontSize: '10px',
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: 'rgba(139,92,246,0.8)',
              fontFamily: 'monospace',
            }}>
              WHISPRSPACE
            </span>
            <span style={{
              fontSize: '11px',
              color: '#4a4a4a',
              letterSpacing: '0.08em',
              fontFamily: 'monospace',
            }}>
              {humanized.duration} · closed
            </span>
          </div>

          {/* Human language — the entire product. No raw numbers. */}
          <div style={{
            borderLeft: '2px solid rgba(109,40,217,0.4)',
            paddingLeft: '20px',
            marginBottom: '44px',
          }}>
            <p style={{
              fontSize: '18px',
              lineHeight: '1.8',
              color: '#e2e2e2',
              marginBottom: '18px',
            }}>
              {humanized.voices}
            </p>
            {humanized.perspectives && (
              <p style={{
                fontSize: '18px',
                lineHeight: '1.8',
                color: '#e2e2e2',
                marginBottom: '18px',
              }}>
                {humanized.perspectives}
              </p>
            )}
            <p style={{
              fontSize: '18px',
              lineHeight: '1.8',
              color: '#e2e2e2',
            }}>
              {humanized.resonance}
            </p>
          </div>

          {/* Closing line — visible but secondary */}
          <p style={{
            fontSize: '13px',
            color: '#555',
            lineHeight: '1.9',
            fontStyle: 'italic',
          }}>
            Then it closed — the way honest things should.
          </p>
        </div>
      </motion.div>

      {/* ── ACTIONS (outside capture area) ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35, duration: 0.5 }}
        className="w-full flex flex-col items-center gap-4"
      >
        <button
          onClick={handleDownload}
          disabled={isDownloading}
          className="relative w-full py-4 flex items-center justify-center gap-2 text-sm tracking-widest uppercase font-medium overflow-hidden group disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #db2777 100%)', color: '#fff' }}
        >
          <span
            className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
            style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)' }}
          />
          <Download className="relative w-4 h-4" />
          <span className="relative">
            {isDownloading ? 'Preparing...' : hasShared ? 'Download Again' : 'Save & Share This Moment'}
          </span>
        </button>

        {downloadError && (
          <p className="text-red-400 text-xs text-center">
            Could not generate image — try a screenshot instead.
          </p>
        )}

        {hasShared && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-gray-600 text-sm text-center leading-relaxed"
          >
            Share on your story, bio, anywhere.<br />
            No names. No content. Just that it happened.
          </motion.p>
        )}

        <Link
          href="/threads/create"
          onClick={() => {
            try {
              posthog.capture('thread_created_from_summary', { previous_summary_id: summary.id })
            } catch { /* noop */ }
          }}
          className="flex items-center gap-1.5 text-gray-600 text-sm hover:text-white transition-colors duration-200"
        >
          <Sparkles className="w-3 h-3" />
          Start a new thread
          <ArrowRight className="w-3 h-3" />
        </Link>
      </motion.div>
    </div>
  )
}
