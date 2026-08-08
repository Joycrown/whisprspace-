/**
 * POST /api/welcome
 *
 * Sends the welcome EMAIL only.
 *
 * The welcome INBOX MESSAGE is no longer sent here — it's created by the
 * `trg_send_welcome_inbox_message` trigger on public.users
 * (migration 20260807000000_welcome_message_trigger.sql), so every new user
 * gets it instantly regardless of signup path, even if this route is never
 * called or the client navigates away mid-request.
 *
 * This route remains a client fetch because Brevo needs an HTTP call and an
 * API key that doesn't belong in the database.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getTrustedAppBaseUrl } from '@/lib/security/app-url'
import { sanitizeUuid, sanitizeEmailAddress } from '@/lib/security/input-sanitization'
import { buildWelcomeEmailHtml } from '@/lib/welcome/templates'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)
    const userId = sanitizeUuid((body as { userId?: unknown } | null)?.userId as string)
    const inboxHandle = String((body as { inboxHandle?: unknown } | null)?.inboxHandle || '').trim()
    const email = sanitizeEmailAddress((body as { email?: unknown } | null)?.email as string)

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    const baseUrl = getTrustedAppBaseUrl(request)
    const inboxUrl = inboxHandle
      ? `${baseUrl}/message/${encodeURIComponent(inboxHandle)}`
      : `${baseUrl}/inbox`
    const gettingStartedUrl = `${baseUrl}/getting-started`

    // Anonymous users have no address — the inbox message (sent by the DB
    // trigger) is all they get.
    if (!email) {
      return NextResponse.json({ success: true, emailSent: false })
    }

    const brevoApiKey =
      process.env.BREVO_TRANSACTIONAL_API_KEY || process.env.NEXT_PUBLIC_BREVO_API_KEY

    if (!brevoApiKey) {
      console.warn('[Welcome] Brevo API key not configured, skipping welcome email')
      return NextResponse.json({ success: true, emailSent: false })
    }

    // Awaited, not fire-and-forget: a serverless function can be frozen the
    // moment it returns, which would drop an in-flight request.
    try {
      await fetch('https://api.brevo.com/v3/smtp/email', {
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
      })
    } catch (err) {
      // The inbox message already landed via the trigger — a failed email
      // isn't worth failing the request over.
      console.error('[Welcome] Brevo email failed:', err)
      return NextResponse.json({ success: true, emailSent: false })
    }

    return NextResponse.json({ success: true, emailSent: true })
  } catch (error) {
    console.error('[Welcome] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
