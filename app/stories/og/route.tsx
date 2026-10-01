import { renderStoriesOgCard } from '../og-card'

export const runtime = 'nodejs'

export async function GET() {
  const image = renderStoriesOgCard()
  const buffer = await image.arrayBuffer()
  return new Response(buffer, {
    headers: {
      'Content-Type': 'image/png',
      'Content-Length': String(buffer.byteLength),
      'Cache-Control': 'public, max-age=86400, s-maxage=604800, no-transform',
    },
  })
}
