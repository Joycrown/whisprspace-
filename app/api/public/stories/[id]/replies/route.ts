import { NextRequest, NextResponse } from 'next/server'
import { decodeReplyCursor } from '@/lib/stories/cursor'
import { getStoryReplies, REPLIES_REVALIDATE_SECONDS } from '@/lib/stories/server'
import { sanitizeUuid } from '@/lib/security/input-sanitization'

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const storyId = sanitizeUuid(id)
  if (!storyId) return NextResponse.json({ error: 'Invalid story.' }, { status: 400 })

  const rawCursor = request.nextUrl.searchParams.get('cursor')
  const cursor = decodeReplyCursor(rawCursor)
  if (rawCursor && !cursor) return NextResponse.json({ error: 'Invalid cursor.' }, { status: 400 })

  try {
    const page = await getStoryReplies(storyId, cursor)
    return NextResponse.json(page, {
      headers: {
        'Cache-Control': `public, s-maxage=${REPLIES_REVALIDATE_SECONDS}, stale-while-revalidate=120`,
      },
    })
  } catch {
    return NextResponse.json({ error: 'Unable to load replies.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
}
