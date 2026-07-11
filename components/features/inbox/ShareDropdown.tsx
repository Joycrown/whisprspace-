'use client'

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

interface ShareDropdownProps {
  position: { top: number; right: number }
  onClose: () => void
  onCopyLink: () => void
  onTwitter: () => void
  onFacebook: () => void
  onWhatsApp: () => void
  onLinkedIn: () => void
  onInstagram: () => void
  onEmail: () => void
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
}: ShareDropdownProps) {
  if (typeof window === 'undefined') return null

  return createPortal(
    <>
      <div className="fixed inset-0 z-[1099]" onClick={onClose} />
      <div
        className="fixed z-[1100] w-52 bg-[#1A1A24] border border-[#23232E] rounded-xl py-1 overflow-hidden"
        style={{ top: `${position.top}px`, right: `${position.right}px` }}
      >
        <button
          onClick={onCopyLink}
          className="flex items-center gap-3 px-4 py-2.5 text-sm text-[#8F8FA3] hover:text-[#F2F2F6] hover:bg-white/[0.04] w-full text-left transition-colors"
        >
          <FaLink className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
          Copy link
        </button>
        <div className="h-px bg-[#23232E] mx-3 my-1" />
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
