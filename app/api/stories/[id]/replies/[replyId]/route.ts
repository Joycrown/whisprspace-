import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/core/supabase/admin-client'
import { containsBlockedContent } from '@/lib/moderation/blocklist'
import { resolveUserFromRequest } from '@/lib/security/request-auth'
import { sanitizeMultilineInput, sanitizeUuid } from '@/lib/security/input-sanitization'
import { revalidateStoryReplies } from '@/lib/stories/server'
import { STORY_LIMITS } from '@/lib/stories/types'

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string; replyId: string }> }) {
  try {
    const { id, replyId } = await context.params
    const storyId = sanitizeUuid(id)
    const messageId = sanitizeUuid(replyId)
    if (!storyId || !messageId) return NextResponse.json({ error: 'Invalid comment.' }, { status: 400 })

    const user = await resolveUserFromRequest(request)
    if (!user) return NextResponse.json({ error: 'Sign in to edit your comment.' }, { status: 401 })

    const raw = ((await request.json().catch(() => null)) ?? {}) as Record<string, unknown>
    if (typeof raw.content !== 'string' || raw.content.trim().length > STORY_LIMITS.replyMax) {
      return NextResponse.json({ error: `Comments can be up to ${STORY_LIMITS.replyMax} characters.` }, { status: 400 })
    }
    const content = sanitizeMultilineInput(raw.content, { maxLength: STORY_LIMITS.replyMax })
    if (!content) return NextResponse.json({ error: 'Your comment is empty.' }, { status: 400 })
    if (containsBlockedContent(content).blocked) {
      return NextResponse.json({ error: 'That comment can’t be posted here. Please rephrase it.' }, { status: 422 })
    }

    const { data: story } = await supabaseAdmin
      .from('stories')
      .select('thread_id, moderation_status, deleted_at')
      .eq('id', storyId)
      .maybeSingle()
    if (!story?.thread_id || story.deleted_at || story.moderation_status !== 'visible') {
      return NextResponse.json({ error: 'This story is no longer available.' }, { status: 404 })
    }

    const editedAt = new Date().toISOString()
    const { data, error } = await supabaseAdmin
      .from('messages')
      .update({ content, is_edited: true, edited_at: editedAt })
      .eq('id', messageId)
      .eq('thread_id', story.thread_id)
      .eq('sender_id', user.id)
      .is('deleted_at', null)
      .select('id, content, created_at')
      .maybeSingle()

    if (error) {
      console.error('[Stories] Comment edit failed:', error.message)
      return NextResponse.json({ error: 'Unable to save your comment.' }, { status: 500 })
    }
    if (!data) return NextResponse.json({ error: 'You can only edit your own comments.' }, { status: 403 })

    revalidateStoryReplies(storyId)
    return NextResponse.json({ reply: { ...data, is_edited: true } })
  } catch (error) {
    console.error('[Stories] Unexpected comment edit failure:', error)
    return NextResponse.json({ error: 'Unable to save your comment.' }, { status: 500 })
  }
}
