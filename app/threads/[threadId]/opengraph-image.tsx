import { OG_SIZE, renderThreadOgCard } from './og-card'

// Edge runtime for the Next.js file convention — used by crawlers that
// auto-discover opengraph-image. The og:image meta tag points at /og
// (the Node route below) because WhatsApp needs an explicit Content-Length
// which edge streaming doesn't provide.
export const runtime = 'edge'
export const alt = 'WhisprSpace Thread'
export const size = OG_SIZE
export const contentType = 'image/png'

export default async function Image({ params }: { params: Promise<{ threadId: string }> }) {
  const { threadId } = await params
  return renderThreadOgCard(threadId)
}
