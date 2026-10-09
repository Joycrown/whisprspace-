import { NextRequest, NextResponse } from 'next/server'
import { decodeReplyCursor } from '@/lib/stories/cursor'
import { getPublicAskResponses, PUBLIC_RESPONSES_REVALIDATE_SECONDS } from '@/lib/prompts/public'
import { sanitizeUuid } from '@/lib/security/input-sanitization'

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const askId = sanitizeUuid(id)
  if (!askId) return NextResponse.json({ error: 'Invalid ask.' }, { status: 400 })

  const rawCursor = request.nextUrl.searchParams.get('cursor')
  const cursor = decodeReplyCursor(rawCursor)
  if (rawCursor && !cursor) return NextResponse.json({ error: 'Invalid cursor.' }, { status: 400 })

  try {
    const page = await getPublicAskResponses(askId, cursor)
    return NextResponse.json(page, {
      headers: {
        'Cache-Control': cursor
          ? `public, s-maxage=${PUBLIC_RESPONSES_REVALIDATE_SECONDS}, stale-while-revalidate=120`
          : 'no-store',
      },
    })
  } catch {
    return NextResponse.json({ error: 'Unable to load answers.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
}
