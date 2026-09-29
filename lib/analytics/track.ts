'use client'

export type AnalyticsFeature = 'stories' | 'inbox' | 'curiosity_ask' | 'discussions' | 'exclusive_discussions' | 'growth'

export type AnalyticsEvent =
  | 'story_opened'
  | 'story_read'
  | 'story_finished'
  | 'story_feed_filtered'
  | 'story_composer_started'
  | 'inbox_link_shared'
  | 'message_page_viewed'
  | 'message_sent'
  | 'message_opened'
  | 'message_converted_to_discussion'
  | 'ask_page_viewed'
  | 'discussion_opened'
  | 'discussion_created'
  | 'discussion_reply_sent'
  | 'poll_voted'
  | 'discussion_extended'
  | 'discussion_saved'
  | 'paid_discussion_preview_viewed'
  | 'paid_discussion_purchase_started'
  | 'signup_completed'
  | 'feature_gate_cta_clicked'
  | 'create_menu_opened'
  | 'create_option_chosen'

export type AnalyticsSource = 'feed' | 'shared_link' | 'notification' | 'marketing' | 'search' | 'direct' | 'in_app'

export function detectSource(): AnalyticsSource {
  if (typeof window === 'undefined') return 'direct'
  const params = new URLSearchParams(window.location.search)
  const explicit = params.get('src')
  if (explicit === 'notification' || explicit === 'marketing' || explicit === 'shared_link') return explicit
  if (window.location.hash === '#comments') return 'notification'
  const referrer = document.referrer
  if (!referrer) return 'direct'
  try {
    const host = new URL(referrer).host
    if (host === window.location.host) return 'in_app'
    if (host.endsWith('whisprspace.com')) return 'marketing'
    if (/google\.|bing\.|duckduckgo\.|yahoo\./.test(host)) return 'search'
    return 'shared_link'
  } catch {
    return 'direct'
  }
}

export function track(event: AnalyticsEvent, properties: Record<string, unknown> & { feature: AnalyticsFeature }) {
  if (typeof window === 'undefined') return
  import('posthog-js')
    .then(({ default: posthog }) => {
      if (!(posthog as unknown as { __loaded?: boolean }).__loaded) return
      posthog.capture(event, properties)
    })
    .catch(() => {})
}
