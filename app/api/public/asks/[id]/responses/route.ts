import { NextRequest, NextResponse } from 'next/server'
import { decodeAskCursor } from '@/lib/prompts/cursor'
import { getPublicAskResponses, PUBLIC_RESPONSES_REVALIDATE_SECONDS } from '@/lib/prompts/public'
import { ASK_SORTS, type AskSort } from '@/lib/prompts/public-types'
import { sanitizeUuid } from '@/lib/security/input-sanitization'

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const askId = sanitizeUuid(id)
  if (!askId) return NextResponse.json({ error: 'Invalid ask.' }, { status: 400 })

  const rawSort = request.nextUrl.searchParams.get('sort')
  const sort: AskSort = (ASK_SORTS as readonly string[]).includes(rawSort ?? '') ? (rawSort as AskSort) : 'latest'
  const rawCursor = request.nextUrl.searchParams.get('cursor')
  const cursor = decodeAskCursor(sort, rawCursor)
  if (rawCursor && !cursor) return NextResponse.json({ error: 'Invalid cursor.' }, { status: 400 })

  try {
    const page = await getPublicAskResponses(askId, sort, cursor)
    return NextResponse.json(page, {
      headers: {
        'Cache-Control': cursor || sort === 'felt'
          ? `public, s-maxage=${PUBLIC_RESPONSES_REVALIDATE_SECONDS}, stale-while-revalidate=120`
          : 'no-store',
      },
    })
  } catch {
    return NextResponse.json({ error: 'Unable to load answers.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
}
