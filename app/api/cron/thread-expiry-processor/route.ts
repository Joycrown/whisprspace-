/**
 * Thread Expiry Processor Cron Route
 *
 * Called every minute by pg_cron via net.http_post.
 * For each thread that has just expired:
 *   1. Computes a human-readable impact summary from existing DB data
 *   2. Stores the summary in thread_summaries (creator private)
 *   3. Sends the creator their closing story via email
 *
 * Protected by x-cron-secret header (must match CRON_SECRET env var).
 *
 * NOTE: This route uses supabaseAdmin (service role) to bypass RLS.
 * All inserts into thread_summaries are intentionally service-role only.
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

    // Find threads that have expired AND are not soft-deleted AND are not saved.
    // is_saved can be null or false — both mean not saved. Only true means saved.
    const { data: expiredThreads, error } = await supabaseAdmin
      .from('threads')
      .select('id, creator_id, title, created_at, expires_at')
      .is('deleted_at', null)
      .or('is_saved.is.null,is_saved.eq.false')
      .lte('expires_at', now.toISOString())
      .not('expires_at', 'is', null)

    if (error) {
      console.error('[ExpiryProcessor] DB error fetching expired threads:', error)
      return NextResponse.json({ error: 'DB error' }, { status: 500 })
    }

    if (!expiredThreads?.length) {
      return NextResponse.json({ processed: 0 })
    }

    // Filter out threads already summarized (thread_summaries already has a row)
    const threadIds = expiredThreads.map(t => t.id)
    const { data: existingSummaries } = await supabaseAdmin
      .from('thread_summaries')
      .select('thread_id')
      .in('thread_id', threadIds)

    const alreadySummarized = new Set(existingSummaries?.map(s => s.thread_id) ?? [])
    const toProcess = expiredThreads.filter(t => !alreadySummarized.has(t.id))

    if (!toProcess.length) {
      return NextResponse.json({ processed: 0, skipped: expiredThreads.length })
    }

    let processed = 0

    for (const thread of toProcess) {
      try {
        await processExpiredThread(thread)
        processed++
      } catch (err) {
        console.error(`[ExpiryProcessor] Failed for thread ${thread.id}:`, err)
      }
    }

    return NextResponse.json({ processed, skipped: alreadySummarized.size })
  } catch (err) {
    console.error('[ExpiryProcessor] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

async function processExpiredThread(thread: {
  id: string
  creator_id: string
  title: string
  created_at: string
  expires_at: string
}) {
  // 1. Unique participants who replied (excluding the creator)
  const { data: messages } = await supabaseAdmin
    .from('messages')
    .select('sender_id')
    .eq('thread_id', thread.id)
    .neq('sender_id', thread.creator_id)
    .is('deleted_at', null)

  const uniqueParticipants = new Set(messages?.map(m => m.sender_id) ?? [])
  const participantCount = uniqueParticipants.size
  const perspectiveCount = messages?.length ?? 0

  // 2. Total reactions across all messages in this thread (via join through messages)
  //    Step 1: get all message IDs for this thread
  const { data: threadMessages } = await supabaseAdmin
    .from('messages')
    .select('id')
    .eq('thread_id', thread.id)
    .is('deleted_at', null)

  const messageIds = threadMessages?.map(m => m.id) ?? []

  let reactionCount = 0
  if (messageIds.length > 0) {
    const { count } = await supabaseAdmin
      .from('message_reactions')
      .select('*', { count: 'exact', head: true })
      .in('message_id', messageIds)
    reactionCount = count ?? 0
  }

  // 3. How long the thread lived in hours
  const createdAt = new Date(thread.created_at)
  const expiredAt = new Date(thread.expires_at)
  const durationHours = Math.max(
    1,
    Math.round((expiredAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60))
  )

  // 4. Store the summary (service role — bypasses RLS)
  const { data: summary, error: insertError } = await supabaseAdmin
    .from('thread_summaries')
    .insert({
      thread_id:         thread.id,
      creator_id:        thread.creator_id,
      participant_count: participantCount,
      perspective_count: perspectiveCount,
      reaction_count:    reactionCount,
      duration_hours:    durationHours,
    })
    .select()
    .single()

  if (insertError || !summary) {
    console.error('[ExpiryProcessor] Failed to insert summary:', insertError)
    return
  }

  // 5. Get creator details for email
  const { data: creator } = await supabaseAdmin
    .from('users')
    .select('email, username, anonymous_id')
    .eq('id', thread.creator_id)
    .single()

  if (!creator?.email || !BREVO_API_KEY) return

  // 6. Convert numbers into human language — the actual product
  const humanized = humanizeImpact(participantCount, perspectiveCount, reactionCount, durationHours)

  // 7. Send the closing story email
  await sendSummaryEmail(creator, humanized, summary.id)
}

// ============================================================
// THE HEART OF THE SYSTEM — numbers become human signals
// These are not vanity metrics. They are emotional language.
// Do not reduce this to "X participants, Y reactions".
// ============================================================
function humanizeImpact(
  participants: number,
  perspectives: number,
  reactions: number,
  hours: number
) {
  const voices =
    participants === 0
      ? "Your thread waited in silence. That's still honest."
      : participants === 1
        ? 'One person found their voice in your discussion.'
        : participants < 5
          ? `${participants} people found their voice here.`
          : `${participants} people showed up for your discussion.`

  const perspectivesLine =
    perspectives === 0
      ? null
      : perspectives === 1
        ? 'One perspective was shared.'
        : perspectives < 10
          ? `${perspectives} different perspectives collided here.`
          : `${perspectives} perspectives. That's a real conversation.`

  const resonance =
    reactions === 0
      ? "Some things don't need a reaction — they just need to be said."
      : reactions < 5
        ? 'A few people said this hit home.'
        : reactions < 20
          ? 'This clearly hit a nerve with people.'
          : 'This discussion struck something deep in people.'

  const duration =
    hours < 24
      ? `${hours} hours`
      : hours < 48
        ? 'one day'
        : `${Math.round(hours / 24)} days`

  return { voices, perspectivesLine, resonance, duration }
}

async function sendSummaryEmail(
  creator: { email: string; username?: string | null; anonymous_id: string },
  humanized: ReturnType<typeof humanizeImpact>,
  summaryId: string
) {
  const displayName = creator.username || creator.anonymous_id
  const summaryUrl = `${APP_URL}/summary/${summaryId}`

  const perspectiveLine = humanized.perspectivesLine
    ? `<p style="font-size: 17px; line-height: 1.8; color: #e0e0e0; margin-bottom: 16px;">${humanized.perspectivesLine}</p>`
    : ''

  const html = `
    <div style="font-family: Georgia, serif; max-width: 520px; margin: 0 auto; padding: 48px 24px; color: #1a1a1a; background: #ffffff;">
      <p style="font-size: 13px; letter-spacing: 0.12em; text-transform: uppercase; color: #999; margin-bottom: 40px; font-family: monospace;">WhisprSpace</p>

      <p style="font-size: 20px; font-weight: 400; line-height: 1.6; margin-bottom: 8px; color: #555;">
        @${displayName}, your thread just closed.
      </p>
      <p style="font-size: 28px; font-weight: 400; line-height: 1.4; margin-bottom: 40px; color: #1a1a1a;">
        Here's its story.
      </p>

      <div style="border-left: 2px solid #1a1a1a; padding-left: 24px; margin-bottom: 40px; background: #f9f9f9; padding: 20px 24px;">
        <p style="font-size: 17px; line-height: 1.8; color: #1a1a1a; margin-bottom: 16px;">
          ${humanized.voices}
        </p>
        ${perspectiveLine}
        <p style="font-size: 17px; line-height: 1.8; color: #1a1a1a; margin-bottom: 0;">
          ${humanized.resonance}
        </p>
      </div>

      <p style="font-size: 14px; color: #888; line-height: 1.8; margin-bottom: 40px;">
        This conversation lived for ${humanized.duration}.<br/>
        Then it closed — the way honest things should.
      </p>

      <div style="margin-bottom: 16px;">
        <a href="${summaryUrl}"
           style="display: inline-block; padding: 14px 28px; background: #1a1a1a; color: #fff; text-decoration: none; font-size: 14px; letter-spacing: 0.05em; margin-right: 12px; margin-bottom: 12px;">
          View &amp; Share Your Impact Card
        </a>
      </div>
      <div style="margin-bottom: 40px;">
        <a href="${APP_URL}/threads/create"
           style="display: inline-block; padding: 14px 28px; border: 1px solid #ccc; color: #444; text-decoration: none; font-size: 14px; letter-spacing: 0.05em;">
          Start a New Thread
        </a>
      </div>

      <p style="font-size: 12px; color: #bbb; line-height: 1.6;">— WhisprSpace</p>
    </div>
  `

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
      subject: "Your thread just closed. Here's its story.",
      htmlContent: html,
    }),
  })
}
