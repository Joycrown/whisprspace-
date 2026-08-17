import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/core/supabase/admin-client'
import { resolveUserFromRequest } from '@/lib/security/request-auth'
import { getTrustedAppBaseUrl } from '@/lib/security/app-url'
import { buildInboxMessageContent, buildWelcomeEmailHtml } from '@/lib/welcome/templates'

const SYSTEM_USER_ID = 'ffffffff-ffff-ffff-ffff-ffffffffffff'

async function isAdmin(userId: string): Promise<boolean> {
  const [{ data: u }, { data: a }] = await Promise.all([
    supabaseAdmin.from('users').select('is_admin').eq('id', userId).single(),
    supabaseAdmin.from('admin_users').select('role').eq('user_id', userId).maybeSingle(),
  ])
  return u?.is_admin === true || !!a
}

export async function POST(request: NextRequest) {
  try {
    const caller = await resolveUserFromRequest(request)
    if (!caller) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!(await isAdmin(caller.id))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const baseUrl = getTrustedAppBaseUrl(request)
    const gettingStartedUrl = `${baseUrl}/getting-started`
    const brevoApiKey =
      process.env.BREVO_TRANSACTIONAL_API_KEY || process.env.NEXT_PUBLIC_BREVO_API_KEY

    // Fetch all users except the system bot itself
    const { data: users, error: usersError } = await supabaseAdmin
      .from('users')
      .select('id, anonymous_id, username, email')
      .neq('id', SYSTEM_USER_ID)

    if (usersError || !users) {
      return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
    }

    // Welcome conversations are one-time and have no bot participant, so find
    // them by message sender rather than by participation.
    const { data: alreadySentRows } = await supabaseAdmin
      .from('direct_messages')
      .select('conversation_id')
      .eq('sender_id', SYSTEM_USER_ID)

    const alreadySentConvIds = new Set((alreadySentRows ?? []).map((r) => r.conversation_id))

    const { data: alreadyWelcomedParticipants } = alreadySentConvIds.size
      ? await supabaseAdmin
          .from('conversation_participants')
          .select('conversation_id, user_id')
          .in('conversation_id', [...alreadySentConvIds])
          .neq('user_id', SYSTEM_USER_ID)
      : { data: [] }

    const alreadyWelcomedUserIds = new Set(
      (alreadyWelcomedParticipants ?? []).map((r) => r.user_id)
    )

    // Pre-flight: verify Brevo key is present before looping
    if (!brevoApiKey) {
      console.error('[BackfillWelcome] Brevo API key not configured — emails will be skipped. Set BREVO_TRANSACTIONAL_API_KEY in your environment.')
    }

    let messaged = 0
    let emailed = 0
    let skipped = 0
    const errors: string[] = []

    if (!brevoApiKey) {
      errors.push('BREVO_TRANSACTIONAL_API_KEY is not set — inbox messages will send but emails are skipped.')
    }

    for (const user of users) {
      const handle = user.username || user.anonymous_id
      const inboxUrl = `${baseUrl}/message/${encodeURIComponent(handle)}`
      const alreadyGotInbox = alreadyWelcomedUserIds.has(user.id)

      if (!alreadyGotInbox) {
        // First time — create conversation and send inbox message
        const { data: conversationId, error: convError } = await supabaseAdmin.rpc(
          'create_one_time_conversation',
          { sender_id: null, recipient_id: user.id }
        )

        if (convError || !conversationId) {
          errors.push(`Failed to create conversation for user ${user.id}: ${convError?.message}`)
          continue
        }

        const { error: msgError } = await supabaseAdmin.from('direct_messages').insert({
          conversation_id: conversationId,
          sender_id: SYSTEM_USER_ID,
          content: buildInboxMessageContent(inboxUrl, gettingStartedUrl),
          message_type: 'text',
        })

        if (msgError) {
          errors.push(`Failed to send inbox message to user ${user.id}: ${msgError.message}`)
          continue
        }

        messaged++
      } else if (!user.email) {
        // Already got inbox, no email — nothing left to do
        skipped++
        continue
      }

      // Send welcome email — runs for both new users and those who already got
      // the inbox message but missed the email on a previous run
      if (user.email && brevoApiKey) {
        try {
          const emailRes = await fetch('https://api.brevo.com/v3/smtp/email', {
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
              to: [{ email: user.email }],
              subject: "You're in. Here's what to do first on WhisprSpace.",
              htmlContent: buildWelcomeEmailHtml(inboxUrl, gettingStartedUrl),
            }),
          })

          if (emailRes.ok) {
            emailed++
          } else {
            const errBody = await emailRes.json().catch(() => ({}))
            errors.push(`Email failed for ${user.email} (HTTP ${emailRes.status}): ${JSON.stringify(errBody)}`)
          }
        } catch (err) {
          errors.push(`Email error for ${user.email}: ${String(err)}`)
        }
      } else if (alreadyGotInbox) {
        // Got inbox, no email address — count as skipped
        skipped++
      }
    }

    return NextResponse.json({
      success: true,
      total: users.length,
      messaged,
      emailed,
      skipped,
      errors: errors.length ? errors : undefined,
    })
  } catch (error) {
    console.error('[BackfillWelcome] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
