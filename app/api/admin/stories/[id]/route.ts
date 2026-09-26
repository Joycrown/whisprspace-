import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/core/supabase/admin-client'
import { requireAdmin } from '@/lib/security/admin-auth'
import { sanitizeUuid } from '@/lib/security/input-sanitization'
import { revalidateStory } from '@/lib/stories/server'

const ACTIONS = {
  restore: { moderation_status: 'visible' },
  hide: { moderation_status: 'hidden' },
  remove: { moderation_status: 'removed' },
  mark_team: { is_team: true },
  unmark_team: { is_team: false },
  mark_sensitive: { is_sensitive: true },
} as const
type Action = keyof typeof ACTIONS

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await context.params
  const storyId = sanitizeUuid(id)
  if (!storyId) return NextResponse.json({ error: 'Invalid story.' }, { status: 400 })

  const raw = ((await request.json().catch(() => null)) ?? {}) as Record<string, unknown>
  const action = raw.action as Action
  if (!(action in ACTIONS)) return NextResponse.json({ error: 'Invalid action.' }, { status: 400 })

  const updates: Record<string, unknown> = { ...ACTIONS[action] }
  if (action === 'restore') updates.report_count = 0

  const { error } = await supabaseAdmin.from('stories').update(updates).eq('id', storyId)
  if (error) return NextResponse.json({ error: 'Unable to update story.' }, { status: 500 })

  if (action === 'restore') {
    await supabaseAdmin.from('story_reports').delete().eq('story_id', storyId)
  }

  console.log('[Moderation]', { action, contentType: 'story', contentId: storyId, moderator: admin.id })
  revalidateStory(storyId)
  return NextResponse.json({ success: true })
}
