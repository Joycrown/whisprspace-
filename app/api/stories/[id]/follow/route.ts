import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/core/supabase/admin-client'
import { resolveUserFromRequest } from '@/lib/security/request-auth'
import { sanitizeUuid } from '@/lib/security/input-sanitization'
import { resolveRegisteredUser } from '@/lib/stories/server'

async function resolveFollower(request: NextRequest, id: string) {
  const storyId = sanitizeUuid(id)
  if (!storyId) return { error: NextResponse.json({ error: 'Invalid story.' }, { status: 400 }) }
  const user = await resolveUserFromRequest(request)
  const profile = user ? await resolveRegisteredUser(user.id) : null
  if (!profile || profile.is_anonymous) {
    return { error: NextResponse.json({ error: 'Create an account to follow stories.', code: 'account_required' }, { status: 401 }) }
  }
  return { storyId, userId: profile.id }
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const resolved = await resolveFollower(request, id)
  if ('error' in resolved) return resolved.error

  const { data: story } = await supabaseAdmin
    .from('stories')
    .select('id, moderation_status, deleted_at')
    .eq('id', resolved.storyId)
    .maybeSingle()
  if (!story || story.deleted_at || story.moderation_status !== 'visible') {
    return NextResponse.json({ error: 'This story is no longer available.' }, { status: 404 })
  }

  const { error } = await supabaseAdmin
    .from('story_follows')
    .upsert({ story_id: resolved.storyId, user_id: resolved.userId }, { onConflict: 'story_id,user_id', ignoreDuplicates: true })

  if (error) return NextResponse.json({ error: 'Unable to follow right now.' }, { status: 500 })
  return NextResponse.json({ following: true })
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const resolved = await resolveFollower(request, id)
  if ('error' in resolved) return resolved.error

  const { error } = await supabaseAdmin
    .from('story_follows')
    .delete()
    .eq('story_id', resolved.storyId)
    .eq('user_id', resolved.userId)

  if (error) return NextResponse.json({ error: 'Unable to unfollow right now.' }, { status: 500 })
  return NextResponse.json({ following: false })
}
