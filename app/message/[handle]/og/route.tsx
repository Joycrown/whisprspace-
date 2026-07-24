import { renderOgCard } from '../og-card'

// Node runtime (not edge): the edge runtime streams responses and strips the
// explicit Content-Length we set below, re-emitting Transfer-Encoding: chunked —
// which is exactly what WhatsApp rejects. Node preserves a buffered body's
// Content-Length header.
export const runtime = 'nodejs'

/**
 * OG image as a plain route handler (not the opengraph-image file convention).
 *
 * Why this exists: Next's opengraph-image convention re-streams the PNG with
 * Transfer-Encoding: chunked and NO Content-Length. WhatsApp's link crawler is
 * strict and skips the thumbnail when Content-Length is missing (browsers/curl
 * tolerate the chunked stream, which is why the convention route "worked"
 * everywhere except WhatsApp). Here we buffer the image and set Content-Length
 * ourselves so the preview renders in WhatsApp / iMessage / Telegram.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ handle: string }> }
) {
  const { handle } = await params
  const image = await renderOgCard(handle)
  const buffer = await image.arrayBuffer()

  return new Response(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'image/png',
      'Content-Length': String(buffer.byteLength),
      'Cache-Control': 'public, immutable, no-transform, max-age=31536000',
    },
  })
}
