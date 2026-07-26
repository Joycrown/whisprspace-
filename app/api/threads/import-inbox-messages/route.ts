import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/core/supabase/admin-client'
import { resolveUserFromRequest } from '@/lib/security/request-auth'

/**
 * Import an inbox conversation's messages into an existing thread as anonymous
 * "INBOX_USER" messages.
 *
 * The thread is created first by the client via the normal createThread path
 * (full validation, creator = the recipient). This route then copies every
 * direct_message from the conversation into the thread's `messages` table under
 * the shared ANON_SYSTEM_INBOX system user, so the original anonymous senders are
 * never revealed (their real sender_id never crosses over). The thread renderer
 * displays ANON_SYSTEM_INBOX-authored messages as "INBOX_USER".
 *
 * Auth: caller must own the thread (creator) AND be a participant of the
 * conversation being imported — enforced server-side below.
 */
export async function POST(req: NextRequest) {
  const caller = await resolveUserFromRequest(req)
  if (!caller) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { conversationId?: string; threadId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const { conversationId, threadId } = body
  if (!conversationId || !threadId) {
    return NextResponse.json({ error: 'Missing conversationId or threadId' }, { status: 400 })
  }

  // ── Ownership checks ────────────────────────────────────────────────────────
  // 1. Caller must be the thread's creator.
  const { data: thread, error: threadErr } = await supabaseAdmin
    .from('threads')
    .select('id, creator_id')
    .eq('id', threadId)
    .single()

  if (threadErr || !thread || thread.creator_id !== caller.id) {
    return NextResponse.json({ error: 'Not allowed to import into this thread' }, { status: 403 })
  }

  // 2. Caller must be a participant of the conversation being imported.
  const { data: participant } = await supabaseAdmin
    .from('conversation_participants')
    .select('user_id')
    .eq('conversation_id', conversationId)
    .eq('user_id', caller.id)
    .maybeSingle()

  if (!participant) {
    return NextResponse.json({ error: 'Not allowed to import this conversation' }, { status: 403 })
  }

  // 3. One-time conversion — refuse if this conversation was already converted.
  const { data: convo } = await supabaseAdmin
    .from('conversations')
    .select('converted_thread_id')
    .eq('id', conversationId)
    .maybeSingle()

  if (convo?.converted_thread_id) {
    return NextResponse.json(
      { error: 'This conversation has already been turned into a thread.' },
      { status: 409 }
    )
  }

  // ── Resolve the shared anonymous system user (create if missing) ───────────
  let systemUserId: string | null = null
  const { data: systemUser } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('anonymous_id', 'ANON_SYSTEM_INBOX')
    .maybeSingle()

  if (systemUser?.id) {
    systemUserId = systemUser.id
  } else {
    // Self-heal: create the shared system user so imports work even on
    // environments where it was never seeded.
    const { data: created, error: createErr } = await supabaseAdmin
      .from('users')
      .insert({
        anonymous_id: 'ANON_SYSTEM_INBOX',
        username: 'INBOX_USER',
        is_anonymous: true,
      })
      .select('id')
      .single()

    if (createErr || !created?.id) {
      console.error('[import-inbox] Could not resolve/create ANON_SYSTEM_INBOX:', createErr?.message)
      return NextResponse.json(
        { error: 'Import unavailable', detail: createErr?.message || 'system user missing' },
        { status: 500 }
      )
    }
    systemUserId = created.id
  }

  // ── Fetch all conversation messages (oldest first) ─────────────────────────
  const { data: dms, error: dmErr } = await supabaseAdmin
    .from('direct_messages')
    .select('content, created_at')
    .eq('conversation_id', conversationId)
    .eq('is_deleted', false)
    .order('created_at', { ascending: true })

  if (dmErr) {
    console.error('[import-inbox] Failed to fetch messages:', dmErr.message)
    return NextResponse.json({ error: 'Failed to read conversation' }, { status: 500 })
  }

  const rows = (dms ?? [])
    .map((m) => (m.content || '').trim())
    .filter(Boolean)
    .map((content) => ({
      thread_id: threadId,
      sender_id: systemUserId, // anonymised — never the original sender
      content,
      type: 'text' as const,
    }))

  if (rows.length === 0) {
    return NextResponse.json({ success: true, imported: 0 })
  }

  const { error: insertErr } = await supabaseAdmin.from('messages').insert(rows)
  if (insertErr) {
    console.error('[import-inbox] Failed to insert thread messages:', insertErr.message)
    // Surface the underlying DB reason to aid debugging (no secrets in PG messages).
    return NextResponse.json(
      { error: 'Failed to import messages', detail: insertErr.message },
      { status: 500 }
    )
  }

  // Ensure the system user is a participant so its messages render cleanly.
  await supabaseAdmin
    .from('thread_participants')
    .upsert({ thread_id: threadId, user_id: systemUserId }, { onConflict: 'thread_id,user_id' })

  // Commit point: mark the conversation converted ONLY now that everything
  // succeeded. Until this runs, the conversation stays convertible (resumable if
  // the user cancelled midway); after this it behaves as a normal inbox message.
  // Tolerate the column not existing yet (migration not run) — the import still
  // succeeded, so don't fail the whole request over the marker.
  const { error: markErr } = await supabaseAdmin
    .from('conversations')
    .update({ converted_thread_id: threadId })
    .eq('id', conversationId)
  if (markErr) {
    console.warn('[import-inbox] Could not set converted_thread_id (migration run?):', markErr.message)
  }

  return NextResponse.json({ success: true, imported: rows.length })
}
