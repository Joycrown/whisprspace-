import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/core/supabase/admin-client'
import { resolveUserFromRequest } from '@/lib/security/request-auth'
import { sanitizeMultilineInput, sanitizeUuid } from '@/lib/security/input-sanitization'
import { revalidateStory } from '@/lib/stories/server'
import { STORY_LIMITS } from '@/lib/stories/types'

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string; number: string }> }) {
  try {
    const { id, number } = await context.params
    const storyId = sanitizeUuid(id)
    const episodeNumber = Number(number)
    if (!storyId || !Number.isInteger(episodeNumber) || episodeNumber < 1) {
      return NextResponse.json({ error: 'Invalid episode.' }, { status: 400 })
    }

    const user = await resolveUserFromRequest(request)
    if (!user) return NextResponse.json({ error: 'Sign in to edit your story.' }, { status: 401 })

    const raw = ((await request.json().catch(() => null)) ?? {}) as Record<string, unknown>
    const body = sanitizeMultilineInput(raw.body, { maxLength: STORY_LIMITS.bodyMax + 1 })
    if (body.length < STORY_LIMITS.bodyMin || body.length > STORY_LIMITS.bodyMax) {
      return NextResponse.json({ error: `Your story needs between ${STORY_LIMITS.bodyMin} and ${STORY_LIMITS.bodyMax.toLocaleString()} characters.` }, { status: 400 })
    }

    const { error } = await supabaseAdmin.rpc('edit_story_episode', {
      p_story_id: storyId,
      p_author_user_id: user.id,
      p_episode_number: episodeNumber,
      p_body: body,
    })

    if (error) {
      if (error.message.includes('Story not found')) return NextResponse.json({ error: 'Story not found.' }, { status: 404 })
      if (error.message.includes('no longer available')) return NextResponse.json({ error: 'This story is no longer available.' }, { status: 409 })
      console.error('[Stories] Episode edit failed:', error.message)
      return NextResponse.json({ error: 'Unable to save your changes.' }, { status: 500 })
    }

    revalidateStory(storyId, { feed: episodeNumber === 1 })
    return NextResponse.json({ success: true, editedAt: new Date().toISOString() })
  } catch (error) {
    console.error('[Stories] Unexpected episode edit failure:', error)
    return NextResponse.json({ error: 'Unable to save your changes.' }, { status: 500 })
  }
}
