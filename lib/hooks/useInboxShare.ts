'use client'

import { useUserStore } from '@/store/userStore'
import { useShareLink } from './useShareLink'

const FALLBACK_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://whisprspace.com'

const SHARE_TEXT =
  "Drop me an anonymous message — a secret, a question, or just say hi. No identity, pure honesty 👀🔥"

export function useInboxShare() {
  const { session } = useUserStore()

  const handle = session?.user?.username || session?.user?.anonymousId || ''

  // Use the actual origin at runtime so the link always matches the deployed domain.
  // Falls back to the env var for SSR contexts where window is unavailable.
  const origin = typeof window !== 'undefined' ? window.location.origin : FALLBACK_URL
  const link = handle ? `${origin}/message/${handle}` : ''

  // Card always shows the canonical production URL, never localhost.
  const cardLink = handle ? `${FALLBACK_URL}/message/${handle}` : link

  const shared = useShareLink({ link, shareText: SHARE_TEXT, downloadName: `whisprspace-${handle || 'card'}` })

  const shareViaEmail = () => shared.shareViaEmail('Send me an anonymous message')

  return {
    ...shared,
    link,
    cardLink,
    handle,
    shareViaEmail,
  }
}
