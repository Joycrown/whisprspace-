import webpush from 'web-push'
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js'
import { buildThreadPath } from '@/lib/threads/thread-url'

type PushSubscriptionRow = {
  id: string
  endpoint: string
  p256dh: string
  auth: string
}

type NotificationDispatchRecord = {
  id: string
  user_id: string
  title: string
  message: string
  data?: Record<string, unknown> | null
}

export type PushPayload = {
  title: string
  body: string
  url?: string
  notificationId?: string
  tag?: string
}

export type PushDispatchResult = {
  attempted: number
  delivered: number
  removed: number
  skipped: boolean
  reason?: string
}

let supabaseAdmin:
  | ReturnType<typeof createSupabaseAdminClient>
  | null = null

let webPushConfigured = false

const getSupabaseAdmin = () => {
  if (supabaseAdmin) return supabaseAdmin

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase admin environment variables are not configured')
  }

  supabaseAdmin = createSupabaseAdminClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  return supabaseAdmin
}

export const getPublicVapidKey = () => {
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() || null
}

const ensureWebPushConfigured = () => {
  if (webPushConfigured) return true

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim()
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim()
  const subject = process.env.VAPID_SUBJECT?.trim() || 'mailto:support@whisprspace.com'

  if (!publicKey || !privateKey) {
    return false
  }

  webpush.setVapidDetails(subject, publicKey, privateKey)
  webPushConfigured = true
  return true
}

const buildNotificationUrl = (notification: NotificationDispatchRecord) => {
  const data = notification.data || {}
  const threadId =
    (typeof data.thread_id === 'string' && data.thread_id) ||
    (typeof data.threadId === 'string' && data.threadId) ||
    null
  const threadTitle =
    (typeof data.thread_title === 'string' && data.thread_title) ||
    (typeof data.threadTitle === 'string' && data.threadTitle) ||
    undefined
  const conversationId =
    (typeof data.conversation_id === 'string' && data.conversation_id) ||
    (typeof data.conversationId === 'string' && data.conversationId) ||
    null

  if (threadId) {
    return buildThreadPath({ id: threadId, title: threadTitle })
  }

  if (conversationId) {
    return `/inbox?conversationId=${encodeURIComponent(conversationId)}`
  }

  return '/notifications'
}

const buildPayloadFromNotification = (
  notification: NotificationDispatchRecord
): PushPayload => {
  return {
    title: notification.title || 'WhisprSpace',
    body: notification.message || 'You have a new notification.',
    url: buildNotificationUrl(notification),
    notificationId: notification.id,
    tag: `notif-${notification.id}`,
  }
}

const isSubscriptionGone = (statusCode?: number) => {
  return statusCode === 404 || statusCode === 410
}

const toWebPushSubscription = (subscription: PushSubscriptionRow) => {
  return {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: subscription.p256dh,
      auth: subscription.auth,
    },
  }
}

const parsePushError = (error: unknown) => {
  if (typeof error !== 'object' || error === null) {
    return { statusCode: undefined, message: 'Push delivery failed' }
  }

  const candidate = error as {
    statusCode?: number
    status?: number
    body?: unknown
    message?: unknown
  }

  const statusCode =
    Number(candidate.statusCode || candidate.status || 0) || undefined

  const message =
    (typeof candidate.body === 'string' && candidate.body) ||
    (typeof candidate.message === 'string' && candidate.message) ||
    'Push delivery failed'

  return { statusCode, message }
}

const sendPushToSubscription = async (
  subscription: PushSubscriptionRow,
  payload: PushPayload
) => {
  try {
    await webpush.sendNotification(
      toWebPushSubscription(subscription),
      JSON.stringify(payload)
    )

    return { ok: true as const }
  } catch (error: unknown) {
    const { statusCode, message } = parsePushError(error)

    return {
      ok: false as const,
      statusCode,
      message,
    }
  }
}

const isUserPushEnabled = async (userId: string) => {
  const admin = getSupabaseAdmin()
  const { data } = await admin
    .from('users')
    .select('preferences')
    .eq('id', userId)
    .maybeSingle()

  const pushPreference = data?.preferences?.notifications?.push
  return pushPreference !== false
}

const getActiveSubscriptions = async (userId: string): Promise<PushSubscriptionRow[]> => {
  const admin = getSupabaseAdmin()
  const { data, error } = await admin
    .from('push_subscriptions')
    .select('id,endpoint,p256dh,auth')
    .eq('user_id', userId)
    .eq('is_active', true)

  if (error || !data) {
    return []
  }

  return data as PushSubscriptionRow[]
}

const markSubscriptionSuccess = async (subscriptionId: string) => {
  const admin = getSupabaseAdmin()
  await admin
    .from('push_subscriptions')
    .update({
      last_success_at: new Date().toISOString(),
      last_failure_at: null,
      failure_reason: null,
      is_active: true,
    })
    .eq('id', subscriptionId)
}

const markSubscriptionFailure = async (
  subscriptionId: string,
  reason: string,
  deactivate: boolean
) => {
  const admin = getSupabaseAdmin()
  await admin
    .from('push_subscriptions')
    .update({
      last_failure_at: new Date().toISOString(),
      failure_reason: reason.slice(0, 300),
      is_active: deactivate ? false : true,
    })
    .eq('id', subscriptionId)
}

export const sendPushToUser = async (
  userId: string,
  payload: PushPayload
): Promise<PushDispatchResult> => {
  if (!ensureWebPushConfigured()) {
    return {
      attempted: 0,
      delivered: 0,
      removed: 0,
      skipped: true,
      reason: 'VAPID keys are not configured',
    }
  }

  const pushEnabled = await isUserPushEnabled(userId)
  if (!pushEnabled) {
    return {
      attempted: 0,
      delivered: 0,
      removed: 0,
      skipped: true,
      reason: 'User push preference is disabled',
    }
  }

  const subscriptions = await getActiveSubscriptions(userId)
  if (subscriptions.length === 0) {
    return {
      attempted: 0,
      delivered: 0,
      removed: 0,
      skipped: true,
      reason: 'No active subscriptions for user',
    }
  }

  let delivered = 0
  let removed = 0

  for (const subscription of subscriptions) {
    const sendResult = await sendPushToSubscription(subscription, payload)

    if (sendResult.ok) {
      delivered += 1
      await markSubscriptionSuccess(subscription.id)
      continue
    }

    const deactivate = isSubscriptionGone(sendResult.statusCode)
    if (deactivate) {
      removed += 1
    }

    await markSubscriptionFailure(subscription.id, sendResult.message, deactivate)
  }

  return {
    attempted: subscriptions.length,
    delivered,
    removed,
    skipped: false,
  }
}

export const dispatchPushForNotification = async (
  notification: NotificationDispatchRecord
) => {
  const payload = buildPayloadFromNotification(notification)
  return sendPushToUser(notification.user_id, payload)
}

export const markNotificationPushAttempted = async (notificationId: string) => {
  const admin = getSupabaseAdmin()
  await admin
    .from('notifications')
    .update({ push_sent_at: new Date().toISOString() })
    .eq('id', notificationId)
}

export const detectDeviceType = (userAgent: string | null | undefined) => {
  const ua = (userAgent || '').toLowerCase()

  if (!ua) return 'unknown'
  if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ipod')) return 'ios'
  if (ua.includes('android')) return 'android'
  if (ua.includes('windows')) return 'windows'
  if (ua.includes('mac os') || ua.includes('macintosh')) return 'macos'
  if (ua.includes('linux')) return 'linux'

  return 'unknown'
}
