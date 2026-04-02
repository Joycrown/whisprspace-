'use client'

import { useState, useEffect, useRef } from 'react'
import { X, Copy, Check, Share2, Link } from 'lucide-react'
import { useInboxShare } from '@/lib/hooks/useInboxShare'
import { ShareDropdown } from './ShareDropdown'

const DISMISS_KEY = 'inbox_nudge_dismissed_at'
const COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000 // 14 days

export function InboxLinkNudge() {
  const [visible, setVisible] = useState(false)
  const [mounted, setMounted] = useState(false)
  const shareButtonRef = useRef<HTMLButtonElement>(null)

  const {
    link,
    handle,
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
  } = useInboxShare()

  useEffect(() => {
    setMounted(true)
    const raw = localStorage.getItem(DISMISS_KEY)
    if (raw) {
      const elapsed = Date.now() - parseInt(raw, 10)
      if (elapsed < COOLDOWN_MS) return
    }
    setVisible(true)
  }, [])

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, Date.now().toString())
    setVisible(false)
  }

  const handleShareClick = () => {
    if (!shareButtonRef.current) return
    openDropdown(shareButtonRef.current.getBoundingClientRect())
  }

  // Only render for authenticated users with a real handle, after mount
  if (!mounted || !visible || !handle) return null

  const displayLink = link.replace(/^https?:\/\//, '')

  return (
    <>
      <div className="mx-3 md:mx-4 mt-2 mb-1 bg-gray-900 border border-gray-800 rounded-lg px-3 py-2.5 flex-shrink-0">
        {/* Top row: label + dismiss */}
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-2 min-w-0">
            <Link className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
            <span className="text-xs font-medium text-white leading-none">
              Get anonymous messages
            </span>
            <span className="text-[11px] text-gray-500 leading-none hidden sm:inline">
              — share this link and let people reach you honestly, no names attached
            </span>
          </div>
          <button
            onClick={dismiss}
            className="text-gray-700 hover:text-gray-400 transition-colors flex-shrink-0 p-1 rounded"
            title="Dismiss"
          >
            <X className="w-3 h-3" />
          </button>
        </div>

        {/* Bottom row: link + actions */}
        <div className="flex items-center gap-2">
          <span className="flex-1 text-[11px] text-gray-400 font-mono truncate min-w-0 bg-gray-800/60 rounded px-2 py-1">
            {displayLink}
          </span>
          <button
            onClick={copyLink}
            className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-white transition-colors flex-shrink-0 px-2 py-1 rounded hover:bg-gray-800"
            title="Copy inbox link"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-green-400" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
            <span className="hidden sm:inline">{copied ? 'Copied!' : 'Copy'}</span>
          </button>
          <button
            ref={shareButtonRef}
            onClick={handleShareClick}
            className="flex items-center gap-1 text-[11px] text-purple-400 hover:text-purple-300 transition-colors flex-shrink-0 px-2 py-1 rounded hover:bg-purple-900/20"
            title="Share inbox link"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Share</span>
          </button>
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
          onEmail={shareViaEmail}
        />
      )}
    </>
  )
}
