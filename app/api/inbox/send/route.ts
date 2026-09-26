import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/core/supabase/admin-client'
import { containsBlockedContent } from '@/lib/moderation/blocklist'

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_CONTENT_LENGTH = 500

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    // ── Parse body ───────────────────────────────────────────────────────────
    let body: { recipientId?: string; content?: string; senderUserId?: string }
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const { recipientId, content, senderUserId } = body

    if (!recipientId || typeof recipientId !== 'string') {
      return NextResponse.json({ error: 'Missing recipient' }, { status: 400 })
    }

    if (!content || typeof content !== 'string' || !content.trim()) {
      return NextResponse.json({ error: 'Message cannot be empty' }, { status: 400 })
    }

    const trimmedContent = content.trim()

    if (trimmedContent.length > MAX_CONTENT_LENGTH) {
      return NextResponse.json(
        { error: `Message cannot exceed ${MAX_CONTENT_LENGTH} characters` },
        { status: 400 }
      )
    }

    // ── Blocklist check ──────────────────────────────────────────────────────
    const blockResult = containsBlockedContent(trimmedContent)
    if (blockResult.blocked) {
      // Neutral error — never reveal which term triggered it
      return NextResponse.json(
        { error: "That message can't be sent here." },
        { status: 422 }
      )
    }

    // ── Verify recipient exists ──────────────────────────────────────────────
    const { data: recipient, error: recipientError } = await supabaseAdmin
      .from('users')
      .select('id, is_anonymous')
      .eq('id', recipientId)
      .single()

    if (recipientError || !recipient || recipient.is_anonymous) {
      return NextResponse.json({ error: 'Recipient not found' }, { status: 404 })
    }

    // ── Write the conversation + message via service role ────────────────────
    // sender_id is null for fully anonymous (no-account) sends.
    // The RPC handles null sender_id by only adding the recipient as participant.
    const senderId: string | null =
      senderUserId && typeof senderUserId === 'string' ? senderUserId : null

    // Create a one_time conversation — sender_id may be null for anonymous sends
    const { data: convData, error: convError } = await supabaseAdmin
      .rpc('create_one_time_conversation', {
        sender_id: senderId,
        recipient_id: recipientId,
      })

    if (convError || !convData) {
      console.error('[InboxSend] Conversation creation failed:', convError?.message)
      return NextResponse.json({ error: 'Failed to deliver message' }, { status: 500 })
    }

    const conversationId = convData.id ?? convData

    // Insert the message — service role bypasses the client INSERT policy we just revoked
    const { error: msgError } = await supabaseAdmin
      .from('direct_messages')
      .insert({
        conversation_id: conversationId,
        sender_id: senderId,
        content: trimmedContent,
        message_type: 'text',
      })

    if (msgError) {
      console.error('[InboxSend] Message insert failed:', msgError.message)
      return NextResponse.json({ error: 'Failed to deliver message' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[InboxSend] Unexpected error:', message)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
