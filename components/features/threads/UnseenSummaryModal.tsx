'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { useUserStore } from '@/store/userStore'
import * as rawAuth from '@/lib/core/supabase/raw-auth'

// Dismissed summary IDs live in localStorage, NOT sessionStorage: sessionStorage
// is wiped every time the app is relaunched, which made "View later in My Threads"
// re-show the same modal on every single login.
const DISMISSED_KEY = 'whispr_dismissed_summaries'

function readDismissed(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(DISMISSED_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : []
  } catch {
    return []
  }
}

function addDismissed(summaryId: string) {
  if (typeof window === 'undefined') return
  try {
    // Keep the list bounded — only the most recent dismissals matter.
    const next = [summaryId, ...readDismissed().filter((id) => id !== summaryId)].slice(0, 50)
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(next))
  } catch { /* noop */ }
}

export function UnseenSummaryModal() {
  const router = useRouter()
  const { session, sessionValidated } = useUserStore()
  const userId = session?.user?.id

  const [unseenSummary, setUnseenSummary] = useState<{ id: string } | null>(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (!sessionValidated || !userId) return

    const checkForUnseen = async () => {
      // getValidAccessToken refreshes if needed. Using the raw stored token here
      // sent expired tokens, which 401'd and left viewed_by_creator = false.
      const token = await rawAuth.getValidAccessToken()
      if (!token) return

      const res = await fetch('/api/summaries/unseen', {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!res.ok) return

      const { summary } = await res.json()
      if (!summary?.id) return

      // Already dismissed on this device — don't nag on every login.
      if (readDismissed().includes(summary.id)) return

      setUnseenSummary(summary)
      setTimeout(() => setIsVisible(true), 900)
    }

    checkForUnseen()
  }, [sessionValidated, userId])

  const handleViewImpact = async () => {
    if (!unseenSummary) return
    const summaryId = unseenSummary.id

    // Dismiss immediately in local state
    setIsVisible(false)
    setUnseenSummary(null)

    // Record the dismissal locally first, so the modal can't come back even if
    // the network call below fails outright.
    addDismissed(summaryId)

    // Mark as viewed in the DB and WAIT for it before navigating. This was
    // previously fire-and-forget, so client-side navigation could abort the
    // request and viewed_by_creator would stay false — making the modal
    // reappear on the next login.
    try {
      const token = await rawAuth.getValidAccessToken()
      if (token) {
        await fetch(`/api/summaries/${summaryId}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
      }
    } catch { /* the summary page will retry the same call */ }

    router.push(`/summary/${summaryId}`)
  }

  const handleDismiss = () => {
    if (!unseenSummary) return
    const summaryId = unseenSummary.id

    setIsVisible(false)
    setTimeout(() => setUnseenSummary(null), 350)

    // Don't mark as viewed on dismiss — the user asked to see it later in
    // My Threads, so it stays unseen server-side. We only suppress the modal
    // on this device.
    addDismissed(summaryId)
  }

  return (
    <AnimatePresence>
      {isVisible && unseenSummary && (
        <>
          {/* Single solid overlay — backdrop + content in one layer */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="fixed inset-0 z-[1200] flex items-center justify-center p-6"
            style={{ backgroundColor: 'var(--color-bg-primary)' }}
          >
            {/* Purple glow — decorative only, sits behind text */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: 'radial-gradient(ellipse 60% 40% at 50% 45%, rgba(109,40,217,0.25) 0%, transparent 70%)',
              }}
            />

          <motion.div
            initial={{ opacity: 0, y: 28, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.45, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full max-w-sm text-center"
          >
            <div
              style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
            >
              {/* Brand */}
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="text-purple-400/60 text-xs tracking-[0.2em] uppercase mb-10"
                style={{ fontFamily: 'monospace' }}
              >
                WhisprSpace
              </motion.p>

              {/* Headline */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35, duration: 0.5 }}
              >
                <p className="text-white/90 text-3xl mb-3 leading-tight font-light">
                  Your thread<br />just closed.
                </p>
                <p className="text-gray-500 text-base mb-12 leading-relaxed">
                  Here's what it meant<br />while it was alive.
                </p>
              </motion.div>

              {/* CTA */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.4 }}
                className="flex flex-col items-center gap-5"
              >
                <button
                  onClick={handleViewImpact}
                  className="relative w-full py-4 text-sm tracking-[0.15em] uppercase font-medium overflow-hidden group"
                  style={{
                    background: 'linear-gradient(135deg, #7c3aed 0%, #db2777 100%)',
                    color: '#fff',
                  }}
                >
                  {/* Shimmer effect */}
                  <span
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                    style={{
                      background: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)',
                    }}
                  />
                  <span className="relative">See Your Impact</span>
                </button>

                <button
                  onClick={handleDismiss}
                  className="text-gray-600 text-sm hover:text-gray-400 transition-colors duration-200 underline underline-offset-4"
                >
                  View later in My Threads
                </button>
              </motion.div>
            </div>
          </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
