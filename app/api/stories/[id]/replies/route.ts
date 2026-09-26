import { createHash } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/core/supabase/admin-client'
import { containsBlockedContent } from '@/lib/moderation/blocklist'
import { resolveUserFromRequest } from '@/lib/security/request-auth'
import { sanitizeMultilineInput, sanitizeUuid } from '@/lib/security/input-sanitization'
import { resolveRegisteredUser, revalidateStoryReplies } from '@/lib/stories/server'
import { STORY_LIMITS } from '@/lib/stories/types'

const REPLY_WINDOW_MS = 60 * 1000
const REPLY_MAX_PER_WINDOW = 6

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const storyId = sanitizeUuid(id)
    if (!storyId) return NextResponse.json({ error: 'Invalid story.' }, { status: 400 })

    const user = await resolveUserFromRequest(request)
    const profile = user ? await resolveRegisteredUser(user.id) : null
    if (!profile || profile.is_anonymous) {
      return NextResponse.json({ error: 'Create an account to comment.', code: 'account_required' }, { status: 401 })
    }

    const raw = ((await request.json().catch(() => null)) ?? {}) as Record<string, unknown>
    if (typeof raw.content !== 'string' || raw.content.trim().length > STORY_LIMITS.replyMax) {
      return NextResponse.json({ error: `Comments can be up to ${STORY_LIMITS.replyMax} characters.` }, { status: 400 })
    }
    const content = sanitizeMultilineInput(raw.content, { maxLength: STORY_LIMITS.replyMax })
    if (!content) return NextResponse.json({ error: 'Your comment is empty.' }, { status: 400 })
    const parentId = raw.parentId == null ? null : sanitizeUuid(raw.parentId)
    if (raw.parentId != null && !parentId) return NextResponse.json({ error: 'Invalid comment.' }, { status: 400 })

    if (containsBlockedContent(content).blocked) {
      return NextResponse.json({ error: 'That comment can’t be posted here. Please rephrase it.' }, { status: 422 })
    }

    const since = new Date(Date.now() - REPLY_WINDOW_MS).toISOString()
    const [{ data: story }, { count: recentCount }, { data: banned }, { data: parent }] = await Promise.all([
      supabaseAdmin
        .from('stories')
        .select('id, thread_id, moderation_status, deleted_at')
        .eq('id', storyId)
        .maybeSingle(),
      supabaseAdmin
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('sender_id', profile.id)
        .gte('created_at', since),
      supabaseAdmin.from('banned_users').select('user_id').eq('user_id', profile.id).maybeSingle(),
      parentId
        ? supabaseAdmin
            .from('messages')
            .select('id, thread_id, content, sender_id, deleted_at, moderation_status')
            .eq('id', parentId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ])

    if (banned) return NextResponse.json({ error: 'Your account can’t post comments.' }, { status: 403 })
    if (!story || story.deleted_at || story.moderation_status !== 'visible' || !story.thread_id) {
      return NextResponse.json({ error: 'This story is no longer available.' }, { status: 404 })
    }
    if (parentId && (!parent || parent.thread_id !== story.thread_id || parent.deleted_at || parent.moderation_status !== 'visible')) {
      return NextResponse.json({ error: 'The comment you’re replying to is no longer available.' }, { status: 404 })
    }
    if ((recentCount ?? 0) >= REPLY_MAX_PER_WINDOW) {
      return NextResponse.json({ error: 'You’re commenting quickly. Take a breath and try again in a minute.' }, { status: 429 })
    }

    const { data: message, error } = await supabaseAdmin
      .from('messages')
      .insert({ thread_id: story.thread_id, sender_id: profile.id, content, type: 'text', parent_message_id: parentId })
      .select('id, content, created_at')
      .single()

    if (error || !message) {
      console.error('[Stories] Comment insert failed:', error?.message)
      return NextResponse.json({ error: 'Unable to post your comment.' }, { status: 500 })
    }

    revalidateStoryReplies(storyId)
    const avatarFor = (senderId: string) => createHash('md5').update(`${story.thread_id}:${senderId}`).digest('hex')
    return NextResponse.json(
      {
        reply: {
          ...message,
          avatar_seed: avatarFor(profile.id),
          is_edited: false,
          parent_id: parent?.id ?? null,
          parent_content: parent ? String(parent.content ?? '').slice(0, 160) : null,
          parent_avatar_seed: parent?.sender_id ? avatarFor(parent.sender_id) : null,
          reaction_counts: {},
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('[Stories] Unexpected comment failure:', error)
    return NextResponse.json({ error: 'Unable to post your comment.' }, { status: 500 })
  }
}
