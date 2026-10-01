import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/core/supabase/admin-client'
import { resolveUserFromRequest } from '@/lib/security/request-auth'
import { sanitizeUuid } from '@/lib/security/input-sanitization'

const FREE_EXPORT_LIMIT = 2

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

  const [{ data: thread, error: threadError }, { data: profile }] = await Promise.all([
    supabaseAdmin
      .from('threads')
      .select('id, title, message_count, creator_id')
      .eq('id', safeThreadId)
      .eq('creator_id', user.id)
      .is('deleted_at', null)
      .maybeSingle(),
    supabaseAdmin.from('users').select('is_premium').eq('id', user.id).maybeSingle(),
  ])

  if (threadError || !thread) return NextResponse.json({ error: 'Discussion not found.' }, { status: 404 })

  const { data: messages, error: messageError } = await supabaseAdmin
    .from('messages')
    .select('id, thread_id, content, created_at')
    .eq('thread_id', safeThreadId)
    .eq('moderation_status', 'visible')
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(100)

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
      is_premium: profile?.is_premium === true,
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

// One export used per "Download carousel" click, checked and recorded before
// the client renders slides, so the limit holds even though rendering happens
// in the browser.
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ threadId: string }> }
) {
  const user = await resolveUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Sign in to export.' }, { status: 401 })

  const { threadId } = await context.params
  const safeThreadId = sanitizeUuid(threadId)
  if (!safeThreadId) return NextResponse.json({ error: 'Invalid discussion ID.' }, { status: 400 })

  const [{ data: thread, error: threadError }, { data: profile }] = await Promise.all([
    supabaseAdmin
      .from('threads')
      .select('id, export_count')
      .eq('id', safeThreadId)
      .eq('creator_id', user.id)
      .is('deleted_at', null)
      .maybeSingle(),
    supabaseAdmin.from('users').select('is_premium').eq('id', user.id).maybeSingle(),
  ])

  if (threadError || !thread) return NextResponse.json({ error: 'Discussion not found.' }, { status: 404 })

  const limit = profile?.is_premium === true ? null : FREE_EXPORT_LIMIT
  if (limit !== null && thread.export_count >= limit) {
    return NextResponse.json(
      { error: `You've used your ${limit} free exports for this discussion. Upgrade to Premium for unlimited exports.` },
      { status: 429 }
    )
  }

  const { data, error } = await supabaseAdmin
    .from('threads')
    .update({ export_count: thread.export_count + 1 })
    .eq('id', safeThreadId)
    .eq('creator_id', user.id)
    .eq('export_count', thread.export_count)
    .select('export_count')
    .maybeSingle()

  if (error) {
    console.error('[ThreadExport] Failed to record export:', error.message)
    return NextResponse.json({ error: 'Unable to start export.' }, { status: 500 })
  }
  if (!data) return NextResponse.json({ error: 'Another export just started. Please try again.' }, { status: 409 })

  return NextResponse.json({ exportCount: data.export_count, limit })
}
