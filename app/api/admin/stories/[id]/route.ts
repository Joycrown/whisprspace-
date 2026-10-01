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

const AUTHOR_NOTICES: Record<'visible' | 'hidden' | 'removed', { title: string; message: (title: string) => string }> = {
  hidden: { title: 'Your story is under review', message: (title) => `“${title}” is hidden while our team reviews it.` },
  removed: { title: 'Your story was removed', message: (title) => `“${title}” was removed for breaking our community guidelines.` },
  visible: { title: 'Your story is back up', message: (title) => `“${title}” is visible to readers again.` },
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await context.params
  const storyId = sanitizeUuid(id)
  if (!storyId) return NextResponse.json({ error: 'Invalid story.' }, { status: 400 })

  const raw = ((await request.json().catch(() => null)) ?? {}) as Record<string, unknown>
  const action = raw.action as Action
  if (!(action in ACTIONS)) return NextResponse.json({ error: 'Invalid action.' }, { status: 400 })

  const { data: before } = await supabaseAdmin
    .from('stories')
    .select('title, author_user_id, moderation_status')
    .eq('id', storyId)
    .maybeSingle()
  if (!before) return NextResponse.json({ error: 'Story not found.' }, { status: 404 })

  const updates: Record<string, unknown> = { ...ACTIONS[action] }
  if (action === 'restore') updates.report_count = 0

  const { error } = await supabaseAdmin.from('stories').update(updates).eq('id', storyId)
  if (error) return NextResponse.json({ error: 'Unable to update story.' }, { status: 500 })

  if (action === 'restore') {
    await supabaseAdmin.from('story_reports').delete().eq('story_id', storyId)
  }

  const nextStatus = 'moderation_status' in updates ? (updates.moderation_status as keyof typeof AUTHOR_NOTICES) : null
  if (nextStatus && nextStatus !== before.moderation_status && before.author_user_id) {
    const notice = AUTHOR_NOTICES[nextStatus]
    const { error: notifyError } = await supabaseAdmin.from('notifications').insert({
      user_id: before.author_user_id,
      type: 'story_moderation',
      category: 'system',
      title: notice.title,
      message: notice.message(before.title),
      data: { story_id: storyId, story_title: before.title, status: nextStatus, open: 'manage' },
    })
    if (notifyError) console.error('[Moderation] Author notification failed:', notifyError.message)
  }

  console.log('[Moderation]', { action, contentType: 'story', contentId: storyId, moderator: admin.id })
  revalidateStory(storyId)
  return NextResponse.json({ success: true })
}
