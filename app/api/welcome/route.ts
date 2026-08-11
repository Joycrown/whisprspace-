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

    if (!email) {
      return NextResponse.json({ success: true, emailSent: false })
    }

    const brevoApiKey =
      process.env.BREVO_TRANSACTIONAL_API_KEY || process.env.NEXT_PUBLIC_BREVO_API_KEY

    if (!brevoApiKey) {
      console.warn('[Welcome] Brevo API key not configured, skipping welcome email')
      return NextResponse.json({ success: true, emailSent: false })
    }

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
      console.error('[Welcome] Brevo email failed:', err)
      return NextResponse.json({ success: true, emailSent: false })
    }

    return NextResponse.json({ success: true, emailSent: true })
  } catch (error) {
    console.error('[Welcome] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
