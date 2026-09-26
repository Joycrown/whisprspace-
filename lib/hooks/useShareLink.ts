'use client'

import { useState, useCallback, useRef } from 'react'

interface UseShareLinkOptions {
  link: string
  shareText: string
  downloadName?: string
}

export function useShareLink({ link, shareText, downloadName = 'whisprspace-card' }: UseShareLinkOptions) {
  const [copied, setCopied] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [dropdownPos, setDropdownPos] = useState<{ top: number; right: number; anchorTop?: number }>({ top: 0, right: 0 })
  const [isGeneratingCard, setIsGeneratingCard] = useState(false)
  const shareCardRef = useRef<HTMLDivElement>(null)

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
      anchorTop: rect.top,
    })
    setShowDropdown(true)
  }, [])

  const closeDropdown = useCallback(() => setShowDropdown(false), [])

  const shareOnTwitter = useCallback(() => {
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(link)}`,
      '_blank'
    )
    closeDropdown()
  }, [link, shareText, closeDropdown])

  const shareOnFacebook = useCallback(() => {
    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`,
      '_blank'
    )
    closeDropdown()
  }, [link, closeDropdown])

  const shareOnWhatsApp = useCallback(() => {
    // URL must come first so WhatsApp renders the preview card.
    // Text after a newline appears below the card.
    window.open(
      `https://api.whatsapp.com/send?text=${encodeURIComponent(link + '\n\n' + shareText)}`,
      '_blank'
    )
    closeDropdown()
  }, [link, shareText, closeDropdown])

  const shareOnLinkedIn = useCallback(() => {
    window.open(
      `https://www.linkedin.com/shareArticle?mini=true&url=${encodeURIComponent(link)}&summary=${encodeURIComponent(shareText)}`,
      '_blank'
    )
    closeDropdown()
  }, [link, shareText, closeDropdown])

  const shareOnInstagram = useCallback(() => {
    // Instagram has no web share API — copy to clipboard instead
    navigator.clipboard.writeText(link).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    closeDropdown()
  }, [link, closeDropdown])

  const shareViaEmail = useCallback((subject: string) => {
    window.open(
      `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(shareText + '\n\n' + link)}`,
      '_blank'
    )
    closeDropdown()
  }, [link, shareText, closeDropdown])

  const downloadShareCard = useCallback(async () => {
    if (!shareCardRef.current || isGeneratingCard) return
    setIsGeneratingCard(true)
    closeDropdown()
    try {
      const { toPng } = await import('html-to-image')
      const dataUrl = await toPng(shareCardRef.current, { pixelRatio: 1, cacheBust: true })
      const a = document.createElement('a')
      a.href = dataUrl
      a.download = `${downloadName}.png`
      a.click()
    } catch (err) {
      console.error('Share card generation failed', err)
    } finally {
      setIsGeneratingCard(false)
    }
  }, [downloadName, isGeneratingCard, closeDropdown])

  return {
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
  }
}
