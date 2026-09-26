import { renderStoryOgCard } from '../../og-card'

export const runtime = 'nodejs'

export async function GET(_request: Request, { params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params
  const image = await renderStoryOgCard(ref)
  const buffer = await image.arrayBuffer()
  return new Response(buffer, {
    headers: {
      'Content-Type': 'image/png',
      'Content-Length': String(buffer.byteLength),
      'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800, no-transform',
    },
  })
}
