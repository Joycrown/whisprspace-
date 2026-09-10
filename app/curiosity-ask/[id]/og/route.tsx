import { renderPromptOgCard } from '../og-card'

export const runtime = 'nodejs'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const image = await renderPromptOgCard(id)
  const buffer = await image.arrayBuffer()
  return new Response(buffer, { headers: { 'Content-Type': 'image/png', 'Content-Length': String(buffer.byteLength), 'Cache-Control': 'public, immutable, no-transform, max-age=31536000' } })
}
