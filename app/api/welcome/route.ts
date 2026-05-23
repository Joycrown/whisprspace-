import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/core/supabase/admin-client'
import { getTrustedAppBaseUrl } from '@/lib/security/app-url'
import { sanitizeUuid, sanitizeEmailAddress } from '@/lib/security/input-sanitization'
import { buildInboxMessageContent, buildWelcomeEmailHtml } from '@/lib/welcome/templates'

// Fixed UUID seeded by migration 20260523000000_seed_whisprspace_bot.sql.
// Must match the id in that migration — never change this without updating the migration too.
const SYSTEM_USER_ID = 'ffffffff-ffff-ffff-ffff-ffffffffffff'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)
    const userId = sanitizeUuid((body as { userId?: unknown } | null)?.userId as string)
    const inboxHandle = String((body as { inboxHandle?: unknown } | null)?.inboxHandle || '').trim()
    const email = sanitizeEmailAddress((body as { email?: unknown } | null)?.email as string)

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    const safeSystemUserId = sanitizeUuid(SYSTEM_USER_ID)!


    const baseUrl = getTrustedAppBaseUrl(request)
    const inboxUrl = inboxHandle
      ? `${baseUrl}/message/${encodeURIComponent(inboxHandle)}`
      : `${baseUrl}/inbox`
    const gettingStartedUrl = `${baseUrl}/getting-started`

    // Get or create a direct conversation between WhisprSpace Team and the new user.
    // get_or_create_conversation has SECURITY DEFINER so it works without an auth context.
    const { data: conversationId, error: convError } = await supabaseAdmin.rpc(
      'get_or_create_conversation',
      { user1_id: safeSystemUserId, user2_id: userId }
    )

    if (convError || !conversationId) {
      console.error('[Welcome] Failed to get/create conversation:', convError)
      return NextResponse.json({ error: 'Failed to create conversation' }, { status: 500 })
    }

    // Idempotency: skip if we've already sent a welcome message in this conversation.
    const { data: existingMessage } = await supabaseAdmin
      .from('direct_messages')
      .select('id')
      .eq('conversation_id', conversationId)
      .eq('sender_id', safeSystemUserId)
      .limit(1)
      .maybeSingle()

    if (existingMessage) {
      return NextResponse.json({ skipped: true, reason: 'already_sent' })
    }

    // Send the welcome inbox message.
    const { error: msgError } = await supabaseAdmin.from('direct_messages').insert({
      conversation_id: conversationId,
      sender_id: safeSystemUserId,
      content: buildInboxMessageContent(inboxUrl, gettingStartedUrl),
      message_type: 'text',
    })

    if (msgError) {
      console.error('[Welcome] Failed to insert welcome message:', msgError)
      return NextResponse.json({ error: 'Failed to send welcome message' }, { status: 500 })
    }

    // Send welcome email if the user signed up with email (fire-and-forget).
    if (email) {
      const brevoApiKey =
        process.env.BREVO_TRANSACTIONAL_API_KEY || process.env.NEXT_PUBLIC_BREVO_API_KEY

      if (brevoApiKey) {
        fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: {
            accept: 'application/json',
            'api-key': brevoApiKey,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            sender: {
              name: process.env.EMAIL_SENDER_NAME || 'WhisprSpace',
              email: process.env.EMAIL_SENDER || 'admin@whisprspace.com',
            },
            to: [{ email }],
            subject: "You're in. Here's what to do first on WhisprSpace.",
            htmlContent: buildWelcomeEmailHtml(inboxUrl, gettingStartedUrl),
          }),
        }).catch((err) => console.error('[Welcome] Brevo email failed:', err))
      } else {
        console.warn('[Welcome] Brevo API key not configured, skipping welcome email')
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Welcome] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
