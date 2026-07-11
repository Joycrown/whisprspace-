import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { supabaseAdmin } from '@/lib/core/supabase/admin-client'
import { containsBlockedContent } from '@/lib/moderation/blocklist'

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_CONTENT_LENGTH = 500
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000   // 1 hour
const RATE_LIMIT_MAX_PER_INBOX = 5             // per sender token OR ip, per hour
const SENDER_TOKEN_COOKIE = 'whs_sit'          // sender identity token (HttpOnly)
const SENDER_TOKEN_TTL_DAYS = 90

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('cf-connecting-ip') ||
    req.headers.get('x-real-ip') ||
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown'
  )
}

function hashIp(ip: string): string {
  return createHash('sha256').update(ip).digest('hex')
}

function generateSenderToken(): string {
  // 32 random bytes → 64-char hex string
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('')
}

// ─── Rate limit check ────────────────────────────────────────────────────────

async function isRateLimited(
  inboxOwnerId: string,
  senderToken: string | null,
  ipHash: string
): Promise<boolean> {
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString()

  // Count recent sends from this sender (by token OR ip — both signals together)
  let query = supabaseAdmin
    .from('inbox_send_log')
    .select('id', { count: 'exact', head: true })
    .eq('inbox_owner_id', inboxOwnerId)
    .gte('sent_at', windowStart)

  if (senderToken) {
    query = query.or(`sender_token.eq.${senderToken},ip_hash.eq.${ipHash}`)
  } else {
    query = query.eq('ip_hash', ipHash)
  }

  const { count, error } = await query

  if (error) {
    console.error('[InboxSend] Rate limit query failed:', error.message)
    // Fail open — don't block sends on a DB error
    return false
  }

  return (count ?? 0) >= RATE_LIMIT_MAX_PER_INBOX
}

async function logSend(
  inboxOwnerId: string,
  senderToken: string | null,
  ipHash: string
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('inbox_send_log')
    .insert({ inbox_owner_id: inboxOwnerId, sender_token: senderToken, ip_hash: ipHash })

  if (error) {
    console.error('[InboxSend] Failed to log send:', error.message)
    // Non-fatal — the message was already written
  }
}

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
      .select('id')
      .eq('id', recipientId)
      .single()

    if (recipientError || !recipient) {
      return NextResponse.json({ error: 'Recipient not found' }, { status: 404 })
    }

    // ── Sender token + IP ────────────────────────────────────────────────────
    const existingToken = req.cookies.get(SENDER_TOKEN_COOKIE)?.value || null
    const ip = getClientIp(req)
    const ipHash = hashIp(ip)

    // ── Rate limit ───────────────────────────────────────────────────────────
    const limited = await isRateLimited(recipientId, existingToken, ipHash)
    if (limited) {
      return NextResponse.json(
        { error: 'Too many messages. Please wait before sending again.' },
        { status: 429 }
      )
    }

    // Issue token if this is the first send (no existing cookie)
    const senderToken = existingToken ?? generateSenderToken()

    // ── Write the conversation + message via service role ────────────────────
    // Determine actual sender UUID — anonymous sessions have a real UUID
    // from signInAnonymously(); unauthenticated visitors have none.
    // We create a deterministic anonymous sender if senderUserId is absent
    // so every message has a sender_id (required by the DM schema).
    let senderId: string

    if (senderUserId && typeof senderUserId === 'string') {
      senderId = senderUserId
    } else {
      // Look up or create a stable bot-like anonymous sender tied to this token
      // For v1: use a platform system user UUID as the sender_id for token-less sends.
      // The sender is fully anonymous — this ID is never surfaced to the recipient.
      const { data: systemUser } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('anonymous_id', 'ANON_SYSTEM_INBOX')
        .single()

      senderId = systemUser?.id ?? recipientId // last-resort fallback (still works for DM schema)
    }

    // Create or reuse a one_time conversation between sender and recipient
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

    // ── Log the send (rate limit audit trail) ────────────────────────────────
    await logSend(recipientId, senderToken, ipHash)

    // ── Issue / refresh the sender token cookie ───────────────────────────────
    const response = NextResponse.json({ success: true })

    const cookieExpiry = new Date()
    cookieExpiry.setDate(cookieExpiry.getDate() + SENDER_TOKEN_TTL_DAYS)

    response.cookies.set(SENDER_TOKEN_COOKIE, senderToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      expires: cookieExpiry,
      path: '/',
    })

    return response
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[InboxSend] Unexpected error:', message)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
