import { NextRequest, NextResponse } from 'next/server'
import { FEED_REVALIDATE_SECONDS, getStoryFeedPage } from '@/lib/stories/server'
import { STORY_CATEGORIES, STORY_FAMILIES, STORY_SORTS, type StoryCategory, type StoryFamily, type StorySort } from '@/lib/stories/types'

const pick = <T extends string>(value: string | null, allowed: readonly T[]): T | null =>
  value && (allowed as readonly string[]).includes(value) ? (value as T) : null

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const category = pick<StoryCategory>(params.get('category'), STORY_CATEGORIES)
  const family = category ? null : pick<StoryFamily>(params.get('family'), STORY_FAMILIES)
  const sort = pick<StorySort>(params.get('sort'), STORY_SORTS) ?? 'fresh'
  const cursor = params.get('cursor')

  try {
    const page = await getStoryFeedPage({ family, category, sort, cursor: cursor && cursor.length <= 200 ? cursor : null })
    return NextResponse.json(page, {
      headers: {
        'Cache-Control': `public, s-maxage=${FEED_REVALIDATE_SECONDS}, stale-while-revalidate=300`,
      },
    })
  } catch {
    return NextResponse.json({ error: 'Unable to load stories.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
}
