'use client'

import { useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  FaTwitter,
  FaFacebook,
  FaWhatsapp,
  FaLinkedinIn,
  FaInstagram,
  FaEnvelope,
  FaLink,
} from 'react-icons/fa'
import { Download, Loader2 } from 'lucide-react'

interface ShareDropdownProps {
  position: { top: number; right: number; anchorTop?: number }
  onClose: () => void
  onCopyLink: () => void
  onTwitter: () => void
  onFacebook: () => void
  onWhatsApp: () => void
  onLinkedIn: () => void
  onInstagram: () => void
  onEmail: () => void
  onDownloadCard?: () => void
  isGeneratingCard?: boolean
}

export function ShareDropdown({
  position,
  onClose,
  onCopyLink,
  onTwitter,
  onFacebook,
  onWhatsApp,
  onLinkedIn,
  onInstagram,
  onEmail,
  onDownloadCard,
  isGeneratingCard,
}: ShareDropdownProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [isSheet, setIsSheet] = useState(false)
  const [top, setTop] = useState(position.top)

  useLayoutEffect(() => {
    const sheet = window.innerWidth < 640
    setIsSheet(sheet)
    if (sheet || !menuRef.current) return
    const height = menuRef.current.offsetHeight
    const fitsBelow = position.top + height <= window.innerHeight - 8
    if (fitsBelow) {
      setTop(position.top)
    } else {
      const above = (position.anchorTop ?? position.top) - 8 - height
      setTop(Math.max(8, above))
    }
  }, [position.top, position.anchorTop])

  if (typeof window === 'undefined') return null

  return createPortal(
    <>
      <div className={`fixed inset-0 z-[1099] ${isSheet ? 'bg-black/50' : ''}`} onClick={onClose} />
      <div
        ref={menuRef}
        className={
          isSheet
            ? 'fixed inset-x-0 bottom-0 z-[1100] rounded-t-2xl border-t border-[#23232E] bg-[#1A1A24] pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2'
            : 'fixed z-[1100] w-56 bg-[#1A1A24] border border-[#23232E] rounded-xl py-1 overflow-hidden'
        }
        style={isSheet ? undefined : { top: `${top}px`, right: `${position.right}px` }}
      >
        {isSheet && <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-[#2A2A38]" />}
        <button
          onClick={onCopyLink}
          className="flex items-center gap-3 px-4 py-2.5 text-sm text-[#8F8FA3] hover:text-[#F2F2F6] hover:bg-white/[0.04] w-full text-left transition-colors"
        >
          <FaLink className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
          Copy link
        </button>

        {/* Download card — full image for Status/Stories */}
        {onDownloadCard && (
          <>
            <button
              onClick={onDownloadCard}
              disabled={isGeneratingCard}
              className="flex items-center gap-3 px-4 py-2.5 text-sm text-[#8F8FA3] hover:text-[#F2F2F6] hover:bg-white/[0.04] w-full text-left transition-colors disabled:opacity-50"
            >
              {isGeneratingCard ? (
                <Loader2 className="w-3.5 h-3.5 text-[#A78BFA] flex-shrink-0 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5 text-[#A78BFA] flex-shrink-0" />
              )}
              <span>{isGeneratingCard ? 'Generating...' : 'Download card'}</span>
              <span className="ml-auto text-[10px] text-[#5C5C6E]">Status</span>
            </button>
            <div className="h-px bg-[#23232E] mx-3 my-1" />
          </>
        )}

        <button
          onClick={onTwitter}
          className="flex items-center gap-3 px-4 py-2.5 text-sm text-[#8F8FA3] hover:text-[#F2F2F6] hover:bg-white/[0.04] w-full text-left transition-colors"
        >
          <FaTwitter className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
          Twitter / X
        </button>
        <button
          onClick={onWhatsApp}
          className="flex items-center gap-3 px-4 py-2.5 text-sm text-[#8F8FA3] hover:text-[#F2F2F6] hover:bg-white/[0.04] w-full text-left transition-colors"
        >
          <FaWhatsapp className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
          WhatsApp
        </button>
        <button
          onClick={onFacebook}
          className="flex items-center gap-3 px-4 py-2.5 text-sm text-[#8F8FA3] hover:text-[#F2F2F6] hover:bg-white/[0.04] w-full text-left transition-colors"
        >
          <FaFacebook className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
          Facebook
        </button>
        <button
          onClick={onLinkedIn}
          className="flex items-center gap-3 px-4 py-2.5 text-sm text-[#8F8FA3] hover:text-[#F2F2F6] hover:bg-white/[0.04] w-full text-left transition-colors"
        >
          <FaLinkedinIn className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
          LinkedIn
        </button>
        <button
          onClick={onInstagram}
          className="flex items-center gap-3 px-4 py-2.5 text-sm text-[#8F8FA3] hover:text-[#F2F2F6] hover:bg-white/[0.04] w-full text-left transition-colors"
        >
          <FaInstagram className="w-3.5 h-3.5 text-pink-500 flex-shrink-0" />
          Instagram
        </button>
        <button
          onClick={onEmail}
          className="flex items-center gap-3 px-4 py-2.5 text-sm text-[#8F8FA3] hover:text-[#F2F2F6] hover:bg-white/[0.04] w-full text-left transition-colors"
        >
          <FaEnvelope className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
          Email
        </button>
      </div>
    </>,
    document.body
  )
}
