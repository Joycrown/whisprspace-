import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/core/supabase/admin-client'
import { resolveUserFromRequest } from '@/lib/security/request-auth'
import { sanitizeMultilineInput, sanitizeUuid } from '@/lib/security/input-sanitization'
import { revalidateStory } from '@/lib/stories/server'
import { STORY_LIMITS } from '@/lib/stories/types'

const USER_ERRORS = [
  'Story not found',
  'This story is not told in episodes',
  'This story is marked as finished',
  'This story is no longer available',
  'This story has reached the episode limit',
]

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const storyId = sanitizeUuid(id)
    if (!storyId) return NextResponse.json({ error: 'Invalid story.' }, { status: 400 })

    const user = await resolveUserFromRequest(request)
    if (!user) return NextResponse.json({ error: 'Sign in to add an episode.' }, { status: 401 })

    const raw = ((await request.json().catch(() => null)) ?? {}) as Record<string, unknown>
    const body = sanitizeMultilineInput(raw.body, { maxLength: STORY_LIMITS.bodyMax + 1 })
    if (body.length < STORY_LIMITS.bodyMin || body.length > STORY_LIMITS.bodyMax) {
      return NextResponse.json({ error: `Episodes need between ${STORY_LIMITS.bodyMin} and ${STORY_LIMITS.bodyMax.toLocaleString()} characters.` }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin.rpc('add_story_episode', {
      p_story_id: storyId,
      p_author_user_id: user.id,
      p_body: body,
    })

    if (error) {
      const message = USER_ERRORS.find((known) => error.message.includes(known))
      if (message) return NextResponse.json({ error: `${message}.` }, { status: message === 'Story not found' ? 404 : 409 })
      console.error('[Stories] Episode insert failed:', error.message)
      return NextResponse.json({ error: 'Unable to publish this episode.' }, { status: 500 })
    }

    revalidateStory(storyId)
    return NextResponse.json({ episodeNumber: data }, { status: 201 })
  } catch (error) {
    console.error('[Stories] Unexpected episode failure:', error)
    return NextResponse.json({ error: 'Unable to publish this episode.' }, { status: 500 })
  }
}
