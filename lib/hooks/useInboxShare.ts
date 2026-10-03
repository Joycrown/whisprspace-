'use client'

import { useUserStore } from '@/store/userStore'
import { useShareLink } from './useShareLink'
import { track } from '@/lib/analytics/track'
import { buildInboxPath } from '@/lib/inbox/inbox-url'

const FALLBACK_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://whisprspace.com'

const SHARE_TEXT =
  "Drop me an anonymous message — a secret, a question, or just say hi. No identity, pure honesty 👀🔥"

export function useInboxShare() {
  const { session } = useUserStore()

  const handle = session?.user?.username || session?.user?.anonymousId || ''

  // Use the actual origin at runtime so the link always matches the deployed domain.
  // Falls back to the env var for SSR contexts where window is unavailable.
  const origin = typeof window !== 'undefined' ? window.location.origin : FALLBACK_URL
  const link = handle ? `${origin}${buildInboxPath(handle)}` : ''

  // Card always shows the canonical production URL, never localhost.
  const cardLink = handle ? `${FALLBACK_URL}${buildInboxPath(handle)}` : link

  const shared = useShareLink({ link, shareText: SHARE_TEXT, downloadName: `whisprspace-${handle || 'card'}` })

  const withTracking = <A extends unknown[], R>(channel: string, action: (...args: A) => R) => (...args: A): R => {
    track('inbox_link_shared', { feature: 'inbox', channel })
    return action(...args)
  }

  return {
    ...shared,
    link,
    cardLink,
    handle,
    copyLink: withTracking('copy', shared.copyLink),
    shareOnTwitter: withTracking('x', shared.shareOnTwitter),
    shareOnFacebook: withTracking('facebook', shared.shareOnFacebook),
    shareOnWhatsApp: withTracking('whatsapp', shared.shareOnWhatsApp),
    shareOnLinkedIn: withTracking('linkedin', shared.shareOnLinkedIn),
    shareOnInstagram: withTracking('instagram', shared.shareOnInstagram),
    downloadShareCard: withTracking('download_card', shared.downloadShareCard),
    shareViaEmail: withTracking('email', () => shared.shareViaEmail('Send me an anonymous message')),
  }
}
