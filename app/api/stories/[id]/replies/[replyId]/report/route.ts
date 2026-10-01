import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/core/supabase/admin-client'
import { resolveUserFromRequest } from '@/lib/security/request-auth'
import { sanitizeUuid } from '@/lib/security/input-sanitization'
import { revalidateStoryReplies } from '@/lib/stories/server'

const REASONS = ['harassment', 'hate_speech', 'self_harm', 'sexual_content', 'violence', 'spam', 'misinformation', 'other'] as const

export async function POST(request: NextRequest, context: { params: Promise<{ id: string; replyId: string }> }) {
  const { id, replyId } = await context.params
  const storyId = sanitizeUuid(id)
  const messageId = sanitizeUuid(replyId)
  if (!storyId || !messageId) return NextResponse.json({ error: 'Invalid comment.' }, { status: 400 })

  const user = await resolveUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Sign in to report comments.', code: 'account_required' }, { status: 401 })

  const raw = ((await request.json().catch(() => null)) ?? {}) as Record<string, unknown>
  const reason = REASONS.find((value) => value === raw.reason)
  if (!reason) return NextResponse.json({ error: 'Choose a reason.' }, { status: 400 })

  const { data: story } = await supabaseAdmin.from('stories').select('thread_id').eq('id', storyId).maybeSingle()
  if (!story?.thread_id) return NextResponse.json({ error: 'Story not found.' }, { status: 404 })

  const { data: message } = await supabaseAdmin
    .from('messages')
    .select('id, sender_id')
    .eq('id', messageId)
    .eq('thread_id', story.thread_id)
    .maybeSingle()
  if (!message) return NextResponse.json({ error: 'Comment not found.' }, { status: 404 })
  if (message.sender_id === user.id) return NextResponse.json({ error: 'You can’t report your own comment.' }, { status: 400 })

  const { error } = await supabaseAdmin.from('content_reports').insert({
    reporter_id: user.id,
    reported_user_id: message.sender_id,
    content_type: 'message',
    content_id: message.id,
    reason,
  })

  if (error && error.code !== '23505') {
    console.error('[Stories] Reply report failed:', error.message)
    return NextResponse.json({ error: 'Unable to send your report.' }, { status: 500 })
  }

  if (!error) revalidateStoryReplies(storyId)
  return NextResponse.json({ success: true })
}
