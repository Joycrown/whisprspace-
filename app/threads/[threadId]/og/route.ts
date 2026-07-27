import { type NextRequest } from 'next/server'
import { renderThreadOgCard } from '../og-card'

// Node runtime preserves Content-Length on a buffered response body.
// Edge streams with Transfer-Encoding: chunked which WhatsApp rejects
// (no thumbnail shown). Buffering here fixes WhatsApp link previews.
export const runtime = 'nodejs'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ threadId: string }> }
) {
  const { threadId } = await params
  const imageResponse = await renderThreadOgCard(threadId)
  const buffer = await imageResponse.arrayBuffer()

  return new Response(buffer, {
    headers: {
      'Content-Type': 'image/png',
      'Content-Length': String(buffer.byteLength),
      'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400',
    },
  })
}
