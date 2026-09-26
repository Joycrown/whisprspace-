import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/core/supabase/admin-client'
import { resolveUserFromRequest } from '@/lib/security/request-auth'
import { sanitizeUuid } from '@/lib/security/input-sanitization'
import { resolveRegisteredUser } from '@/lib/stories/server'
import { isStoryReaction } from '@/lib/stories/types'

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const storyId = sanitizeUuid(id)
  if (!storyId) return NextResponse.json({ error: 'Invalid story.' }, { status: 400 })

  const user = await resolveUserFromRequest(request)
  const profile = user ? await resolveRegisteredUser(user.id) : null
  if (!profile || profile.is_anonymous) {
    return NextResponse.json({ error: 'Create an account to react.', code: 'account_required' }, { status: 401 })
  }

  const raw = ((await request.json().catch(() => null)) ?? {}) as Record<string, unknown>
  if (!isStoryReaction(raw.reaction)) return NextResponse.json({ error: 'Invalid reaction.' }, { status: 400 })

  const { data, error } = await supabaseAdmin.rpc('toggle_story_reaction', {
    p_story_id: storyId,
    p_user_id: profile.id,
    p_reaction: raw.reaction,
  })

  if (error) {
    if (error.message.includes('Story not found')) return NextResponse.json({ error: 'This story is no longer available.' }, { status: 404 })
    console.error('[Stories] Reaction failed:', error.message)
    return NextResponse.json({ error: 'Unable to save your reaction.' }, { status: 500 })
  }

  return NextResponse.json(data)
}
