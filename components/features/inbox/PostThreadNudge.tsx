'use client'

import { useState, useEffect, useRef } from 'react'
import { X, Copy, Check, Share2, MessageCircle } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useInboxShare } from '@/lib/hooks/useInboxShare'
import { ShareDropdown } from './ShareDropdown'
import UserShareCard from './UserShareCard'
import { useUserStore } from '@/store/userStore'

// ThreadComposer dispatches this event right after a thread is successfully created.
// MainLayout renders PostThreadNudge, so both are alive simultaneously — the event
// fires while still on /threads/create, before the router push.
export const POST_THREAD_NUDGE_EVENT = 'whisprspace:inbox-nudge'

const AUTO_DISMISS_MS = 8000

export function PostThreadNudge() {
  const [visible, setVisible] = useState(false)
  const [progress, setProgress] = useState(100)
  const shareButtonRef = useRef<HTMLButtonElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const { session } = useUserStore()
  const {
    link,
    cardLink,
    handle,
    copied,
    showDropdown,
    dropdownPos,
    shareCardRef,
    isGeneratingCard,
    copyLink,
    openDropdown,
    closeDropdown,
    shareOnTwitter,
    shareOnFacebook,
    shareOnWhatsApp,
    shareOnLinkedIn,
    shareOnInstagram,
    shareViaEmail,
    downloadShareCard,
  } = useInboxShare()
  const displayName = session?.user?.username || session?.user?.anonymousId || handle

  useEffect(() => {
    const show = () => {
      setVisible(true)
      setProgress(100)

      if (timerRef.current) clearTimeout(timerRef.current)
      if (intervalRef.current) clearInterval(intervalRef.current)

      const start = Date.now()
      intervalRef.current = setInterval(() => {
        const elapsed = Date.now() - start
        const remaining = Math.max(0, 100 - (elapsed / AUTO_DISMISS_MS) * 100)
        setProgress(remaining)
        if (remaining === 0) {
          clearInterval(intervalRef.current!)
        }
      }, 50)

      timerRef.current = setTimeout(() => {
        setVisible(false)
      }, AUTO_DISMISS_MS)
    }

    window.addEventListener(POST_THREAD_NUDGE_EVENT, show)
    return () => {
      window.removeEventListener(POST_THREAD_NUDGE_EVENT, show)
      if (timerRef.current) clearTimeout(timerRef.current)
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  const dismiss = () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (intervalRef.current) clearInterval(intervalRef.current)
    setVisible(false)
  }

  const handleShareClick = () => {
    if (!shareButtonRef.current) return
    openDropdown(shareButtonRef.current.getBoundingClientRect())
  }

  // Don't render if user has no handle (unauthenticated / guest)
  if (!handle) return null

  return (
    <>
      <AnimatePresence>
        {visible && (
          <motion.div
            key="post-thread-nudge"
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 340, damping: 30 }}
            className="fixed bottom-36 md:bottom-6 left-4 right-4 md:left-1/2 md:right-auto md:-translate-x-1/2 z-[900] mx-auto w-auto md:w-[calc(100%-2rem)] max-w-sm
              bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl overflow-hidden"
          >
            {/* Auto-dismiss progress bar */}
            <div className="h-0.5 bg-gray-800">
              <div
                className="h-full bg-purple-600 transition-none"
                style={{ width: `${progress}%` }}
              />
            </div>

            <div className="p-4">
              {/* Header */}
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-purple-500/15 flex items-center justify-center flex-shrink-0">
                    <MessageCircle className="w-4 h-4 text-purple-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white leading-tight">
                      Your thread is live.
                    </p>
                    <p className="text-xs text-gray-400 leading-tight mt-0.5">
                      Share your inbox link so people can reach you directly.
                    </p>
                  </div>
                </div>
                <button
                  onClick={dismiss}
                  className="text-gray-600 hover:text-gray-400 transition-colors p-0.5 flex-shrink-0 mt-0.5"
                  title="Dismiss"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Link + actions */}
              <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0 bg-gray-800 rounded-lg px-3 py-2">
                  <p className="text-[11px] text-gray-400 font-mono truncate">
                    {link.replace(/^https?:\/\//, '')}
                  </p>
                </div>
                <button
                  onClick={copyLink}
                  className="flex items-center gap-1.5 px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-xs text-gray-300 hover:text-white transition-colors flex-shrink-0"
                >
                  {copied ? (
                    <Check className="w-3.5 h-3.5 text-green-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>{copied ? 'Copied!' : 'Copy'}</span>
                </button>
                <button
                  ref={shareButtonRef}
                  onClick={handleShareClick}
                  className="flex items-center gap-1.5 px-3 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-xs text-white transition-colors flex-shrink-0"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Share</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
          onEmail={shareViaEmail}
          onDownloadCard={downloadShareCard}
          isGeneratingCard={isGeneratingCard}
        />
      )}

      {/* Hidden off-screen card for html-to-image capture */}
      <div style={{ position: 'fixed', top: -9999, left: -9999, pointerEvents: 'none', zIndex: -1 }}>
        <UserShareCard
          ref={shareCardRef}
          displayName={displayName}
          handle={handle}
          inboxUrl={cardLink}
        />
      </div>
    </>
  )
}
