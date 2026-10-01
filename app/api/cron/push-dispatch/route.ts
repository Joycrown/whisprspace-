import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js'
import { dispatchPushBatch, isWebPushReady } from '@/lib/notifications/push-service'

export const runtime = 'nodejs'
export const maxDuration = 60

const BATCH_SIZE = 100
const MAX_BATCHES = 5
const TIME_BUDGET_MS = 50_000

const supabaseAdmin = createSupabaseAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
)

type ClaimedNotification = {
  id: string
  user_id: string
  title: string
  message: string
  data: Record<string, unknown> | null
  created_at: string
}

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  if (!isWebPushReady()) {
    return NextResponse.json({ skipped: true, reason: 'VAPID keys are not configured' })
  }

  const deadline = Date.now() + TIME_BUDGET_MS
  const totals = { claimed: 0, processed: 0, delivered: 0, removedSubscriptions: 0, skipped: 0, timedOut: false }

  for (let batch = 0; batch < MAX_BATCHES && Date.now() < deadline; batch += 1) {
    const { data, error } = await supabaseAdmin.rpc('claim_pending_push_notifications', { p_limit: BATCH_SIZE })
    if (error) {
      console.error('Failed to claim pending push notifications:', error)
      return NextResponse.json({ error: 'Failed to load pending notifications' }, { status: 500 })
    }

    const claimed = (data || []) as ClaimedNotification[]
    if (!claimed.length) break
    totals.claimed += claimed.length

    const result = await dispatchPushBatch(claimed, { concurrency: 10, deadline })
    totals.processed += result.processed
    totals.delivered += result.delivered
    totals.removedSubscriptions += result.removed
    totals.skipped += result.skipped
    if (result.timedOut) {
      totals.timedOut = true
      break
    }
    if (claimed.length < BATCH_SIZE) break
  }

  return NextResponse.json(totals)
}
