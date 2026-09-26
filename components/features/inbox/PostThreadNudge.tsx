'use client'

import { useState, useEffect, useRef } from 'react'
import { X, Copy, Check, Share2, MessageCircle, Loader2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useShareLink } from '@/lib/hooks/useShareLink'
import { createThreadInvite } from '@/lib/threads/thread-service'
import { buildThreadPath } from '@/lib/threads/thread-url'
import { ShareDropdown } from './ShareDropdown'

export const POST_THREAD_NUDGE_EVENT = 'whisprspace:thread-created'

export interface PostThreadNudgeDetail {
  threadId: string
  title: string
  privacy?: string
}

const AUTO_DISMISS_MS = 8000

export function PostThreadNudge() {
  const [visible, setVisible] = useState(false)
  const [progress, setProgress] = useState(100)
  const [thread, setThread] = useState<PostThreadNudgeDetail | null>(null)
  const [link, setLink] = useState('')
  const [resolving, setResolving] = useState(false)
  const shareButtonRef = useRef<HTMLButtonElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const {
    copied,
    showDropdown,
    dropdownPos,
    copyLink,
    openDropdown,
    closeDropdown,
    shareOnTwitter,
    shareOnFacebook,
    shareOnWhatsApp,
    shareOnLinkedIn,
    shareOnInstagram,
    shareViaEmail,
  } = useShareLink({
    link,
    shareText: thread
      ? `"${thread.title}" 👀 Everyone's answering anonymously. What's your take?`
      : 'Everyone is answering anonymously on WhisprSpace. What’s your take? 👀',
    downloadName: 'whisprspace-discussion',
  })

  useEffect(() => {
    const show = (event: Event) => {
      const detail = (event as CustomEvent<PostThreadNudgeDetail>).detail
      if (!detail?.threadId) return

      setThread(detail)
      const publicLink = `${window.location.origin}${buildThreadPath({ id: detail.threadId, title: detail.title })}?from=share`
      if (!detail.privacy || detail.privacy === 'public') {
        setLink(publicLink)
      } else {
        setLink('')
        setResolving(true)
        createThreadInvite(detail.threadId, null, 7, false)
          .then(({ code }) => setLink(code ? `${window.location.origin}/invite/${code}` : publicLink))
          .catch(() => setLink(publicLink))
          .finally(() => setResolving(false))
      }

      setVisible(true)
      setProgress(100)

      if (timerRef.current) clearTimeout(timerRef.current)
      if (intervalRef.current) clearInterval(intervalRef.current)

      const start = Date.now()
      intervalRef.current = setInterval(() => {
        const elapsed = Date.now() - start
        const remaining = Math.max(0, 100 - (elapsed / AUTO_DISMISS_MS) * 100)
        setProgress(remaining)
        if (remaining === 0 && intervalRef.current) clearInterval(intervalRef.current)
      }, 50)

      timerRef.current = setTimeout(() => setVisible(false), AUTO_DISMISS_MS)
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
    if (!shareButtonRef.current || !link) return
    if (timerRef.current) clearTimeout(timerRef.current)
    if (intervalRef.current) clearInterval(intervalRef.current)
    openDropdown(shareButtonRef.current.getBoundingClientRect())
  }

  return (
    <>
      <AnimatePresence>
        {visible && thread && (
          <motion.div
            key="post-thread-nudge"
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 340, damping: 30 }}
            className="fixed bottom-36 md:bottom-6 left-4 right-4 md:left-1/2 md:right-auto md:-translate-x-1/2 z-[900] mx-auto w-auto md:w-[calc(100%-2rem)] max-w-sm
              bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl overflow-hidden"
          >
            <div className="h-0.5 bg-gray-800">
              <div className="h-full bg-purple-600 transition-none" style={{ width: `${progress}%` }} />
            </div>

            <div className="p-4">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-purple-500/15 flex items-center justify-center flex-shrink-0">
                    <MessageCircle className="w-4 h-4 text-purple-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white leading-tight">It&apos;s live 🔥 Now get people talking.</p>
                    <p className="text-xs text-gray-400 leading-tight mt-0.5">The first replies set the tone. Send it to people who&apos;ll have something to say.</p>
                  </div>
                </div>
                <button onClick={dismiss} className="text-gray-600 hover:text-gray-400 transition-colors p-0.5 flex-shrink-0 mt-0.5" title="Dismiss">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0 bg-gray-800 rounded-lg px-3 py-2">
                  <p className="text-[11px] text-gray-400 font-mono truncate">
                    {resolving ? 'Preparing invite link…' : link.replace(/^https?:\/\//, '')}
                  </p>
                </div>
                <button
                  onClick={copyLink}
                  disabled={!link}
                  className="flex items-center gap-1.5 px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-xs text-gray-300 hover:text-white transition-colors flex-shrink-0 disabled:opacity-50"
                >
                  {resolving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied!' : 'Copy'}</span>
                </button>
                <button
                  ref={shareButtonRef}
                  onClick={handleShareClick}
                  disabled={!link}
                  className="flex items-center gap-1.5 px-3 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-xs text-white transition-colors flex-shrink-0 disabled:opacity-50"
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
          onEmail={() => shareViaEmail(thread?.title || 'Join the discussion')}
        />
      )}
    </>
  )
}
