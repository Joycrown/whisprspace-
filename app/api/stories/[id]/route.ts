import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/core/supabase/admin-client'
import { resolveUserFromRequest } from '@/lib/security/request-auth'
import { sanitizeSingleLineInput, sanitizeUuid } from '@/lib/security/input-sanitization'
import { getSeriesLimitState, loadOwnedStory, resolveRegisteredUser, revalidateStory, seriesLimitReached, SERIES_LIMIT_MESSAGE } from '@/lib/stories/server'
import { STORY_LIMITS } from '@/lib/stories/types'

async function resolveOwnedStory(request: NextRequest, id: string) {
  const storyId = sanitizeUuid(id)
  if (!storyId) return { error: NextResponse.json({ error: 'Invalid story.' }, { status: 400 }) }
  const user = await resolveUserFromRequest(request)
  if (!user) return { error: NextResponse.json({ error: 'Sign in to manage your story.' }, { status: 401 }) }
  const story = await loadOwnedStory(storyId, user.id)
  if (!story) return { error: NextResponse.json({ error: 'Story not found.' }, { status: 404 }) }
  return { story, userId: user.id }
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const resolved = await resolveOwnedStory(request, id)
  if ('error' in resolved) return resolved.error

  const { data: episodes, error } = await supabaseAdmin
    .from('story_episodes')
    .select('episode_number, body, published_at, edited_at')
    .eq('story_id', resolved.story.id)
    .order('episode_number', { ascending: true })

  if (error) return NextResponse.json({ error: 'Unable to load your story.' }, { status: 500 })

  const { author_user_id: _author, deleted_at: _deleted, thread_id: _thread, ...story } = resolved.story
  return NextResponse.json({
    story,
    episodes: (episodes ?? []).map((episode) => ({
      number: episode.episode_number,
      body: episode.body,
      published_at: episode.published_at,
      edited_at: episode.edited_at,
    })),
  })
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const resolved = await resolveOwnedStory(request, id)
  if ('error' in resolved) return resolved.error

  const raw = ((await request.json().catch(() => null)) ?? {}) as Record<string, unknown>
  const updates: Record<string, unknown> = {}

  if (typeof raw.featureConsent === 'boolean') {
    updates.feature_consent = raw.featureConsent
    updates.feature_consent_at = raw.featureConsent ? new Date().toISOString() : null
  }
  if (typeof raw.title === 'string') {
    const title = sanitizeSingleLineInput(raw.title, { maxLength: STORY_LIMITS.titleMax + 1 })
    if (title.length < STORY_LIMITS.titleMin || title.length > STORY_LIMITS.titleMax) {
      return NextResponse.json({ error: `Titles need between ${STORY_LIMITS.titleMin} and ${STORY_LIMITS.titleMax} characters.` }, { status: 400 })
    }
    if (title !== resolved.story.title) updates.title = title
  }
  if (raw.status === 'finished' || raw.status === 'ongoing') updates.status = raw.status
  if ('cadence' in raw && resolved.story.is_episodic) {
    const cadence = sanitizeSingleLineInput(raw.cadence, { maxLength: STORY_LIMITS.cadenceMax })
    updates.cadence_label = cadence || null
  }

  if (!Object.keys(updates).length) return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 })

  if (updates.status === 'ongoing' && resolved.story.status === 'finished' && resolved.story.is_episodic) {
    const profile = await resolveRegisteredUser(resolved.userId)
    const limitState = await getSeriesLimitState(resolved.userId, Boolean(profile?.is_premium))
    if (seriesLimitReached(limitState, resolved.story.id)) {
      return NextResponse.json({ error: SERIES_LIMIT_MESSAGE, code: 'series_limit', limit: limitState }, { status: 403 })
    }
  }

  const { error } = await supabaseAdmin.from('stories').update(updates).eq('id', resolved.story.id)
  if (error) {
    console.error('[Stories] Update failed:', error.message)
    return NextResponse.json({ error: 'Unable to update your story.' }, { status: 500 })
  }

  if (typeof updates.title === 'string' && resolved.story.thread_id) {
    await supabaseAdmin.from('threads').update({ title: updates.title }).eq('id', resolved.story.thread_id)
  }

  const affectsFeed = 'status' in updates || 'title' in updates
  revalidateStory(resolved.story.id, { feed: affectsFeed })
  return NextResponse.json({ success: true })
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const resolved = await resolveOwnedStory(request, id)
  if ('error' in resolved) return resolved.error

  const { error } = await supabaseAdmin
    .from('stories')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', resolved.story.id)

  if (error) return NextResponse.json({ error: 'Unable to delete your story.' }, { status: 500 })

  revalidateStory(resolved.story.id)
  return NextResponse.json({ success: true })
}
