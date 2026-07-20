'use client'

import { useState, useEffect, useRef } from 'react'
import { X, Copy, Check, Share2, Link } from 'lucide-react'
import { useInboxShare } from '@/lib/hooks/useInboxShare'
import { ShareDropdown } from './ShareDropdown'
import UserShareCard from './UserShareCard'
import { useUserStore } from '@/store/userStore'

const DISMISS_KEY = 'inbox_nudge_dismissed_at'
const COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000 // 14 days

export function InboxLinkNudge() {
  const [visible, setVisible] = useState(false)
  const [mounted, setMounted] = useState(false)
  const shareButtonRef = useRef<HTMLButtonElement>(null)
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

  if (!mounted || !visible || !handle) return null

  const displayLink = link.replace(/^https?:\/\//, '')
  const displayName = session?.user?.username || session?.user?.anonymousId || handle

  return (
    <>
      <div className="mx-3 md:mx-4 mt-2 mb-1 bg-[#12121A] border border-[#23232E] rounded-lg px-3 py-2.5 flex-shrink-0">
        {/* Top row: label + dismiss */}
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-2 min-w-0">
            <Link className="w-3.5 h-3.5 text-[#8B5CF6] flex-shrink-0" />
            <span className="text-xs font-medium text-[#F2F2F6] leading-none">
              Get anonymous messages
            </span>
            <span className="text-[11px] text-[#5C5C6E] leading-none hidden sm:inline">
              — share your link and let people reach you honestly
            </span>
          </div>
          <button
            onClick={dismiss}
            className="text-[#3A3A4E] hover:text-[#8F8FA3] transition-colors flex-shrink-0 p-1 rounded"
            title="Dismiss"
          >
            <X className="w-3 h-3" />
          </button>
        </div>

        {/* Bottom row: link + actions */}
        <div className="flex items-center gap-2">
          <span className="flex-1 text-[11px] text-[#5C5C6E] font-mono truncate min-w-0 bg-white/[0.03] border border-[#23232E] rounded px-2 py-1">
            {displayLink}
          </span>
          <button
            onClick={copyLink}
            className="flex items-center gap-1 text-[11px] text-[#8F8FA3] hover:text-[#F2F2F6] transition-colors flex-shrink-0 px-2 py-1 rounded hover:bg-white/[0.04]"
            title="Copy inbox link"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-[#5DCAA5]" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
            <span className="hidden sm:inline">{copied ? 'Copied!' : 'Copy'}</span>
          </button>
          <button
            ref={shareButtonRef}
            onClick={handleShareClick}
            className="flex items-center gap-1 text-[11px] text-[#A78BFA] hover:text-[#C4B5FD] transition-colors flex-shrink-0 px-2 py-1 rounded hover:bg-[#8B5CF6]/[0.08]"
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
