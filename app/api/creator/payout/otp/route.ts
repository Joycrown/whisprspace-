import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { enforceRateLimit, withRateLimitHeaders } from '@/lib/security/rate-limit'
import { resolveUserFromRequest } from '@/lib/security/request-auth'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

export async function POST(request: NextRequest) {
  const rateLimit = enforceRateLimit({
    request,
    namespace: 'payout:otp',
    max: 3,
    windowMs: 15 * 60_000,
  })
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    const user = await resolveUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString()
    const expiresAt = new Date(Date.now() + 10 * 60_000).toISOString() // 10 minutes

    // Store in DB
    const { error: dbError } = await supabaseAdmin
      .from('payout_otps')
      .insert({
        user_id: user.id,
        code: otp,
        expires_at: expiresAt,
      })

    if (dbError) {
      console.error('Failed to store payout OTP:', dbError)
      return NextResponse.json({ error: 'Failed to generate verification code' }, { status: 500 })
    }

    // Send via Brevo
    const brevoApiKey = process.env.BREVO_TRANSACTIONAL_API_KEY || process.env.NEXT_PUBLIC_BREVO_API_KEY
    if (!brevoApiKey) {
      console.error('Brevo API Key missing')
      return NextResponse.json({ error: 'Email service not configured' }, { status: 500 })
    }

    const { data: userData } = await supabaseAdmin
      .from('users')
      .select('email')
      .eq('id', user.id)
      .single()

    if (!userData?.email) {
      return NextResponse.json({ error: 'User email not found' }, { status: 400 })
    }

    const emailResponse = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': brevoApiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        sender: {
          name: process.env.EMAIL_SENDER_NAME || 'WhisprSpace',
          email: process.env.EMAIL_SENDER || 'admin@whisprspace.com',
        },
        to: [{ email: userData.email }],
        subject: 'Withdrawal Verification Code - WhisprSpace',
        htmlContent: `
          <!DOCTYPE html>
          <html>
          <body style="font-family: sans-serif; padding: 20px; color: #1f2937;">
            <div style="max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
              <h2 style="color: #8b5cf6; margin-top: 0;">Withdrawal Verification</h2>
              <p>Your verification code for the withdrawal request is:</p>
              <div style="font-size: 36px; font-weight: bold; letter-spacing: 8px; margin: 32px 0; color: #8b5cf6; text-align: center; background: #f5f3ff; padding: 16px; border-radius: 8px;">
                ${otp}
              </div>
              <p style="font-size: 14px; color: #6b7280;">This code will expire in 10 minutes. If you did not initiate this request, please secure your account immediately.</p>
              <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
              <p style="font-size: 12px; color: #9ca3af; text-align: center;">&copy; ${new Date().getFullYear()} WhisprSpace. Speak freely, stay hidden.</p>
            </div>
          </body>
          </html>
        `,
      }),
    })

    if (!emailResponse.ok) {
      console.error('Failed to send payout OTP email')
      return NextResponse.json({ error: 'Failed to send verification code' }, { status: 500 })
    }

    return withRateLimitHeaders(
      NextResponse.json({ message: 'Verification code sent' }),
      rateLimit.headers
    )
  } catch (error) {
    console.error('Payout OTP API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
