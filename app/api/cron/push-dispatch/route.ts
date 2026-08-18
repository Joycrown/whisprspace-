import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js'
import { dispatchPushForNotification } from '@/lib/notifications/push-service'

export const runtime = 'nodejs'
export const maxDuration = 60

const CONCURRENCY = 10
const TIME_BUDGET_MS = 50_000

const supabaseAdmin = createSupabaseAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
)

type PendingNotification = {
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

  const batchSize = 100

  const { data: pendingNotifications, error: pendingError } = await supabaseAdmin
    .from('notifications')
    .select('id,user_id,title,message,data,created_at')
    .is('push_sent_at', null)
    .order('created_at', { ascending: true })
    .limit(batchSize)

  if (pendingError) {
    console.error('Failed to load pending push notifications:', pendingError)
    return NextResponse.json(
      { error: 'Failed to load pending notifications' },
      { status: 500 }
    )
  }

  const notifications = (pendingNotifications || []) as PendingNotification[]

  let processed = 0
  let delivered = 0
  let removedSubscriptions = 0
  let deferred = 0
  let attempted = 0
  let timedOut = false

  const startedAt = Date.now()

  for (let i = 0; i < notifications.length; i += CONCURRENCY) {
    if (Date.now() - startedAt > TIME_BUDGET_MS) {
      timedOut = true
      break
    }

    const slice = notifications.slice(i, i + CONCURRENCY)
    attempted += slice.length

    const results = await Promise.allSettled(
      slice.map(async (notification) => {
        const result = await dispatchPushForNotification(notification)
        const shouldDefer =
          result.skipped && result.reason === 'VAPID keys are not configured'

        return { notification, result, shouldDefer }
      })
    )

    const toMark: string[] = []

    for (const [index, settled] of results.entries()) {
      if (settled.status === 'rejected') {
        console.error(
          `Failed to dispatch push for notification ${slice[index].id}:`,
          settled.reason
        )
        continue
      }

      const { notification, result, shouldDefer } = settled.value

      if (shouldDefer) {
        deferred += 1
        continue
      }

      toMark.push(notification.id)
      processed += 1
      delivered += result.delivered
      removedSubscriptions += result.removed
    }

    if (toMark.length > 0) {
      const { error: markError } = await supabaseAdmin
        .from('notifications')
        .update({ push_sent_at: new Date().toISOString() })
        .in('id', toMark)

      if (markError) {
        console.error('Failed to mark notifications as dispatched:', markError)
      }
    }
  }

  return NextResponse.json({
    queued: notifications.length,
    attempted,
    processed,
    delivered,
    removedSubscriptions,
    deferred,
    timedOut,
  })
}

