import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
)

const addDays = (date: Date, days: number) => {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

const sendExpiryReminder = async (email: string, username: string, expiresAt: string) => {
  const brevoApiKey = process.env.BREVO_TRANSACTIONAL_API_KEY || process.env.NEXT_PUBLIC_BREVO_API_KEY
  if (!brevoApiKey) {
    console.error('Brevo API Key missing')
    return false
  }

  const formattedDate = new Date(expiresAt).toLocaleDateString()

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
      to: [{ email }],
      subject: 'Your WhisprSpace Premium expires soon',
      htmlContent: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Premium Expiring Soon</title>
  <style>
    body { margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f3f4f6; color: #1f2937; }
    .wrapper { width: 100%; table-layout: fixed; background-color: #f3f4f6; padding-bottom: 40px; }
    .main-table { background-color: #ffffff; margin: 0 auto; width: 100%; max-width: 600px; border-spacing: 0; font-family: sans-serif; color: #1f2937; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); }
    .header { background: linear-gradient(135deg, #8b5cf6 0%, #d946ef 100%); padding: 32px 0; text-align: center; }
    .header h1 { margin: 0; color: #ffffff; font-size: 28px; font-weight: 700; letter-spacing: -0.5px; }
    .content { padding: 40px 40px; }
    .button-container { text-align: center; margin: 32px 0; }
    .button { display: inline-block; padding: 14px 32px; background: linear-gradient(to right, #8b5cf6, #f97316); color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(139, 92, 246, 0.25); transition: opacity 0.2s; }
    .button:hover { opacity: 0.9; }
    .divider { height: 1px; background-color: #e5e7eb; margin: 32px 0; }
    .footer { padding: 0 40px 32px; text-align: center; font-size: 12px; color: #6b7280; }
    @media screen and (max-width: 600px) {
      .content { padding: 32px 24px; }
      .button { width: 100%; box-sizing: border-box; }
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <center>
      <div style="height: 40px;"></div>
      <table class="main-table" role="presentation">
        <tr>
          <td class="header">
            <h1>WhisprSpace</h1>
          </td>
        </tr>
        <tr>
          <td class="content">
            <h2 style="margin: 0 0 16px; font-size: 22px; color: #111827;">Premium Expiring Soon</h2>
            <p style="margin: 0 0 16px; line-height: 1.6; font-size: 16px; color: #4b5563;">
              Hi ${username || 'there'},
            </p>
            <p style="margin: 0 0 24px; line-height: 1.6; font-size: 16px; color: #4b5563;">
              Your WhisprSpace Premium plan expires on <strong>${formattedDate}</strong>.
              Renew now to keep your premium benefits active.
            </p>
            <div class="button-container">
              <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/profile" class="button">Manage Premium</a>
            </div>
            <p style="margin: 0 0 0; line-height: 1.6; font-size: 16px; color: #4b5563;">
              If you have questions, reply to this email and we will help.
            </p>
          </td>
        </tr>
        <tr>
          <td class="footer">
            <p style="margin: 0;">&copy; ${new Date().getFullYear()} WhisprSpace. All rights reserved.</p>
            <p style="margin: 8px 0 0;">Speak freely, stay hidden.</p>
          </td>
        </tr>
      </table>
      <div style="height: 40px;"></div>
    </center>
  </div>
</body>
</html>
      `,
    }),
  })

  if (!emailResponse.ok) {
    const errorData = await emailResponse.json().catch(() => ({}))
    console.error('Brevo API Error:', errorData)
    return false
  }

  return true
}

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const now = new Date()
  const reminderStart = addDays(now, 7)
  const reminderEnd = addDays(now, 8)

  const { data: expiredUsers, error: expiredError } = await supabaseAdmin
    .from('users')
    .select('id,premium_expires_at')
    .eq('is_premium', true)
    .not('premium_expires_at', 'is', null)
    .lte('premium_expires_at', now.toISOString())

  if (expiredError) {
    console.error('Failed to fetch expired users:', expiredError)
  }

  const expiredIds = (expiredUsers || []).map((user) => user.id)

  if (expiredIds.length > 0) {
    const { error: downgradeError } = await supabaseAdmin
      .from('users')
      .update({ is_premium: false })
      .in('id', expiredIds)

    if (downgradeError) {
      console.error('Failed to downgrade expired users:', downgradeError)
    }
  }

  const { data: expiringUsers, error: expiringError } = await supabaseAdmin
    .from('users')
    .select('id,email,username,premium_expires_at,premium_reminder_sent_for')
    .eq('is_premium', true)
    .not('premium_expires_at', 'is', null)
    .gte('premium_expires_at', reminderStart.toISOString())
    .lt('premium_expires_at', reminderEnd.toISOString())

  if (expiringError) {
    console.error('Failed to fetch expiring users:', expiringError)
  }

  let remindersSent = 0
  let remindersSkipped = 0

  for (const user of expiringUsers || []) {
    if (!user.email || !user.premium_expires_at) {
      remindersSkipped += 1
      continue
    }

    if (user.premium_reminder_sent_for === user.premium_expires_at) {
      remindersSkipped += 1
      continue
    }

    const sent = await sendExpiryReminder(user.email, user.username, user.premium_expires_at)
    if (sent) {
      remindersSent += 1
      await supabaseAdmin
        .from('users')
        .update({ premium_reminder_sent_for: user.premium_expires_at })
        .eq('id', user.id)
    }
  }

  return NextResponse.json({
    expiredCount: expiredIds.length,
    remindersSent,
    remindersSkipped,
  })
}
