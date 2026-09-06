/**
 * Pre-Expiry Notifier Cron Route
 *
 * Called every 10 minutes by pg_cron via net.http_post.
 * Finds threads expiring within 10 minutes that haven't been notified,
 * sends the creator a human-toned email, and marks the thread as notified.
 *
 * Protected by x-cron-secret header (must match CRON_SECRET env var).
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/core/supabase/admin-client'

const BREVO_API_KEY =
  process.env.BREVO_TRANSACTIONAL_API_KEY || process.env.NEXT_PUBLIC_BREVO_API_KEY || ''

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://whisprspace.com'

export async function POST(request: NextRequest) {
  // Validate cron secret
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const incoming = request.headers.get('x-cron-secret')
    if (incoming !== cronSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  try {
    const now = new Date()
    const tenMinutesFromNow = new Date(now.getTime() + 10 * 60 * 1000)

    // Find threads expiring within the next 10 minutes, not yet notified, not saved.
    // is_saved can be null or false — both mean not saved.
    const { data: threads, error } = await supabaseAdmin
      .from('threads')
      .select('id, creator_id, title, expires_at, created_at')
      .eq('expiry_notified', false)
      .is('deleted_at', null)
      .or('is_saved.is.null,is_saved.eq.false')
      .lte('expires_at', tenMinutesFromNow.toISOString())
      .gte('expires_at', now.toISOString())

    if (error) {
      console.error('[PreExpiryNotifier] DB error:', error)
      return NextResponse.json({ error: 'DB error' }, { status: 500 })
    }

    if (!threads?.length) {
      return NextResponse.json({ processed: 0 })
    }

    let processed = 0

    for (const thread of threads) {
      try {
        // Get creator email and username
        const { data: creator } = await supabaseAdmin
          .from('users')
          .select('email, username, anonymous_id')
          .eq('id', thread.creator_id)
          .single()

        if (!creator?.email) {
          // No email — mark notified to avoid re-querying
          await supabaseAdmin
            .from('threads')
            .update({ expiry_notified: true })
            .eq('id', thread.id)
          continue
        }

        // Get current reply count
        const { count: replyCount } = await supabaseAdmin
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('thread_id', thread.id)
          .is('deleted_at', null)

        const displayName = creator.username || creator.anonymous_id

        // Send pre-expiry email via Brevo
        if (BREVO_API_KEY) {
          await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: {
              'api-key': BREVO_API_KEY,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              sender: {
                name: process.env.EMAIL_SENDER_NAME || 'WhisprSpace',
                email: process.env.EMAIL_SENDER || 'admin@whisprspace.com',
              },
              to: [{ email: creator.email }],
              subject: "Your thread is closing soon — here's what it meant",
              htmlContent: buildPreExpiryEmail(displayName, replyCount ?? 0, thread.id),
            }),
          })
        }

        // Mark as notified to prevent duplicate sends
        await supabaseAdmin
          .from('threads')
          .update({ expiry_notified: true })
          .eq('id', thread.id)

        processed++
      } catch (err) {
        console.error(`[PreExpiryNotifier] Failed for thread ${thread.id}:`, err)
      }
    }

    return NextResponse.json({ processed })
  } catch (err) {
    console.error('[PreExpiryNotifier] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

function buildPreExpiryEmail(
  displayName: string,
  replyCount: number,
  threadId: string
): string {
  const participationLine =
    replyCount === 0
      ? "Your thread is still waiting. Sometimes that's okay too."
      : replyCount === 1
        ? 'One person showed up for your discussion.'
        : `${replyCount} people showed up for your discussion.`

  return `
    <div style="font-family: Georgia, serif; max-width: 520px; margin: 0 auto; padding: 40px 24px; color: #1a1a1a; background: #ffffff;">
      <p style="font-size: 13px; letter-spacing: 0.1em; text-transform: uppercase; color: #888; margin-bottom: 32px; font-family: monospace;">WhisprSpace</p>

      <p style="font-size: 22px; font-weight: 400; line-height: 1.5; margin-bottom: 24px;">
        @${displayName}, your thread closes in 10 minutes.
      </p>

      <p style="font-size: 16px; color: #444; line-height: 1.8; margin-bottom: 32px;">
        ${participationLine}<br/><br/>
        Before it closes, you can extend it or save it.<br/>
        Or let it close the way it was meant to.<br/>
        Some conversations are better as moments.
      </p>

      <div style="margin-bottom: 40px; display: flex; gap: 12px; flex-wrap: wrap;">
        <a href="${APP_URL}/threads/${threadId}/manage"
           style="display: inline-block; padding: 12px 24px; background: #1a1a1a; color: #fff; text-decoration: none; font-size: 14px; letter-spacing: 0.04em; margin-right: 12px; margin-bottom: 8px;">
          Extend Thread
        </a>
        <a href="${APP_URL}/threads/${threadId}/manage"
           style="display: inline-block; padding: 12px 24px; border: 1px solid #1a1a1a; color: #1a1a1a; text-decoration: none; font-size: 14px; letter-spacing: 0.04em; margin-bottom: 8px;">
          Save Thread
        </a>
      </div>

      <p style="font-size: 13px; color: #aaa; line-height: 1.6;">— WhisprSpace</p>
    </div>
  `
}
