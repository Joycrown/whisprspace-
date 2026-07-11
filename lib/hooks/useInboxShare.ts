'use client'

import { useState, useCallback } from 'react'
import { useUserStore } from '@/store/userStore'

const FALLBACK_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://whisprspace.com'

const SHARE_TEXT =
  "Drop me an anonymous message — a secret, a question, or just say hi. No identity, pure honesty 👀🔥"

export function useInboxShare() {
  const { session } = useUserStore()
  const [copied, setCopied] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [dropdownPos, setDropdownPos] = useState({ top: 0, right: 0 })

  const handle = session?.user?.username || session?.user?.anonymousId || ''

  // Use the actual origin at runtime so the link always matches the deployed domain.
  // Falls back to the env var for SSR contexts where window is unavailable.
  const origin = typeof window !== 'undefined' ? window.location.origin : FALLBACK_URL
  const link = handle ? `${origin}/message/${handle}` : ''

  const copyLink = useCallback(() => {
    if (!link) return
    navigator.clipboard.writeText(link).catch(() => {})
    setCopied(true)
    setShowDropdown(false)
    setTimeout(() => setCopied(false), 2000)
  }, [link])

  const openDropdown = useCallback((rect: DOMRect) => {
    setDropdownPos({
      top: rect.bottom + 8,
      right: window.innerWidth - rect.right,
    })
    setShowDropdown(true)
  }, [])

  const closeDropdown = useCallback(() => setShowDropdown(false), [])

  const shareOnTwitter = useCallback(() => {
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(SHARE_TEXT)}&url=${encodeURIComponent(link)}`,
      '_blank'
    )
    closeDropdown()
  }, [link, closeDropdown])

  const shareOnFacebook = useCallback(() => {
    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`,
      '_blank'
    )
    closeDropdown()
  }, [link, closeDropdown])

  const shareOnWhatsApp = useCallback(() => {
    window.open(
      `https://api.whatsapp.com/send?text=${encodeURIComponent(SHARE_TEXT + ' ' + link)}`,
      '_blank'
    )
    closeDropdown()
  }, [link, closeDropdown])

  const shareOnLinkedIn = useCallback(() => {
    window.open(
      `https://www.linkedin.com/shareArticle?mini=true&url=${encodeURIComponent(link)}&summary=${encodeURIComponent(SHARE_TEXT)}`,
      '_blank'
    )
    closeDropdown()
  }, [link, closeDropdown])

  const shareOnInstagram = useCallback(() => {
    // Instagram has no web share API — copy to clipboard instead
    navigator.clipboard.writeText(link).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    closeDropdown()
  }, [link, closeDropdown])

  const shareViaEmail = useCallback(() => {
    window.open(
      `mailto:?subject=${encodeURIComponent('Send me an anonymous message')}&body=${encodeURIComponent(SHARE_TEXT + '\n\n' + link)}`,
      '_blank'
    )
    closeDropdown()
  }, [link, closeDropdown])

  return {
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
  }
}
