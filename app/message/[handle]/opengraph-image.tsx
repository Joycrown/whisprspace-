import { renderOgCard, OG_SIZE } from './og-card'

export const runtime = 'edge'
export const revalidate = 86400
export const contentType = 'image/png'
export const size = OG_SIZE

interface Props {
  params: Promise<{ handle: string }>
}

/**
 * opengraph-image file convention — kept for crawlers/tools that auto-discover it.
 * NOTE: this convention streams the PNG without a Content-Length header, which
 * WhatsApp's crawler rejects. The metadata in page.tsx therefore points og:image
 * at the dedicated /og route handler (which sets Content-Length). This file shares
 * the same render via renderOgCard so both stay in sync.
 */
export default async function OgImage({ params }: Props) {
  const { handle } = await params
  return renderOgCard(handle)
}
