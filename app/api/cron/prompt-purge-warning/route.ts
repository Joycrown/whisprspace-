/**
 * Prompt Purge Warning Cron Route
 *
 * Called daily by pg_cron via net.http_post.
 * Finds closed, unsaved asks that will be purged tomorrow (2 days past
 * expiry — purge_expired_prompts runs at the 3-day mark) and emails the
 * creator a last chance to save or export it.
 *
 * Protected by x-cron-secret header (must match CRON_SECRET env var).
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/core/supabase/admin-client'
import { buildPromptPath } from '@/lib/prompts/prompt-url'

const BREVO_API_KEY =
  process.env.BREVO_TRANSACTIONAL_API_KEY || process.env.NEXT_PUBLIC_BREVO_API_KEY || ''

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://whisprspace.com'

const PURGE_GRACE_DAYS = 3

export async function POST(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const incoming = request.headers.get('x-cron-secret')
    if (incoming !== cronSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  try {
    const now = Date.now()
    // Asks that expired between 2 and 3 days ago get warned today — one day
    // before purge_expired_prompts sweeps them at the 3-day mark.
    const warnCutoff = new Date(now - (PURGE_GRACE_DAYS - 1) * 24 * 60 * 60 * 1000)
    const purgeCutoff = new Date(now - PURGE_GRACE_DAYS * 24 * 60 * 60 * 1000)

    const { data: prompts, error } = await supabaseAdmin
      .from('prompts')
      .select('id, creator_id, question, expires_at')
      .is('deleted_at', null)
      .eq('is_saved', false)
      .is('purge_warning_sent_at', null)
      .lte('expires_at', warnCutoff.toISOString())
      .gt('expires_at', purgeCutoff.toISOString())

    if (error) {
      console.error('[PromptPurgeWarning] DB error:', error)
      return NextResponse.json({ error: 'DB error' }, { status: 500 })
    }

    if (!prompts?.length) {
      return NextResponse.json({ processed: 0 })
    }

    let processed = 0

    for (const prompt of prompts) {
      try {
        const { data: creator } = await supabaseAdmin
          .from('users')
          .select('email, username, anonymous_id')
          .eq('id', prompt.creator_id)
          .single()

        if (creator?.email && BREVO_API_KEY) {
          const displayName = creator.username || creator.anonymous_id
          const manageUrl = `${APP_URL}${buildPromptPath({ id: prompt.id })}/manage`

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
              subject: 'Your ask gets cleared tomorrow',
              htmlContent: buildPurgeWarningEmail(displayName, prompt.question, manageUrl),
            }),
          })
        }

        // Mark warned regardless of whether an email was sent (no email on
        // file, or Brevo not configured) — this flag only gates re-sending,
        // not the actual purge, so it's safe to set even without delivery.
        await supabaseAdmin
          .from('prompts')
          .update({ purge_warning_sent_at: new Date().toISOString() })
          .eq('id', prompt.id)

        processed++
      } catch (err) {
        console.error(`[PromptPurgeWarning] Failed for ask ${prompt.id}:`, err)
      }
    }

    return NextResponse.json({ processed })
  } catch (err) {
    console.error('[PromptPurgeWarning] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

function buildPurgeWarningEmail(displayName: string, question: string, manageUrl: string): string {
  return `
    <div style="font-family: Georgia, serif; max-width: 520px; margin: 0 auto; padding: 40px 24px; color: #1a1a1a; background: #ffffff;">
      <p style="font-size: 13px; letter-spacing: 0.1em; text-transform: uppercase; color: #888; margin-bottom: 32px; font-family: monospace;">WhisprSpace</p>

      <p style="font-size: 22px; font-weight: 400; line-height: 1.5; margin-bottom: 24px;">
        @${displayName}, this ask gets cleared tomorrow.
      </p>

      <p style="font-size: 16px; color: #444; line-height: 1.8; margin-bottom: 8px;">
        "${question}"
      </p>

      <p style="font-size: 16px; color: #444; line-height: 1.8; margin-bottom: 32px;">
        It closed a couple of days ago and hasn't been saved, so the answers will be
        permanently deleted in about 24 hours. Save it or export what you want to keep
        before then.
      </p>

      <div style="margin-bottom: 40px;">
        <a href="${manageUrl}"
           style="display: inline-block; padding: 12px 24px; background: #1a1a1a; color: #fff; text-decoration: none; font-size: 14px; letter-spacing: 0.04em;">
          Save or Export Now
        </a>
      </div>

      <p style="font-size: 13px; color: #aaa; line-height: 1.6;">— WhisprSpace</p>
    </div>
  `
}
