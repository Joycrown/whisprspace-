import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/core/supabase/admin-client'
import { resolveUserFromRequest } from '@/lib/security/request-auth'
import { sanitizeUuid } from '@/lib/security/input-sanitization'

/** Creator-only, export-safe read surface for a discussion. */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ threadId: string }> }
) {
  const user = await resolveUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })

  const { threadId } = await context.params
  const safeThreadId = sanitizeUuid(threadId)
  if (!safeThreadId) return NextResponse.json({ error: 'Invalid discussion ID.' }, { status: 400 })

  const { data: thread, error: threadError } = await supabaseAdmin
    .from('threads')
    .select('id, title, message_count, is_premium, creator_id')
    .eq('id', safeThreadId)
    .eq('creator_id', user.id)
    .is('deleted_at', null)
    .maybeSingle()

  if (threadError || !thread) return NextResponse.json({ error: 'Discussion not found.' }, { status: 404 })

  const { data: messages, error: messageError } = await supabaseAdmin
    .from('messages')
    .select('id, thread_id, content, created_at')
    .eq('thread_id', safeThreadId)
    .eq('moderation_status', 'visible')
    .is('deleted_at', null)
    .neq('sender_id', user.id)
    .order('created_at', { ascending: true })
    .limit(50)

  if (messageError) {
    console.error('[ThreadExport] Failed to load messages:', messageError.message)
    return NextResponse.json({ error: 'Unable to load discussion responses.' }, { status: 500 })
  }

  // Thread exports are an explicit creator selection; mark the readable
  // candidates as selected in this response without persisting new state.
  return NextResponse.json({
    thread: {
      id: thread.id,
      title: thread.title,
      response_count: messages?.length ?? 0,
      is_premium: thread.is_premium === true,
      responses: (messages ?? []).map((message) => ({
        id: message.id,
        prompt_id: thread.id,
        content: message.content,
        is_starred: true,
        starred_at: message.created_at,
        created_at: message.created_at,
      })),
    },
  })
}
