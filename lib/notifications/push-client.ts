import { supabase } from '@/lib/core/supabase/client'

const getAuthHeaders = async () => {
  const { data } = await supabase.auth.getSession()
  const token = data?.session?.access_token

  if (!token) {
    return {}
  }

  return {
    Authorization: `Bearer ${token}`,
  }
}

const urlBase64ToUint8Array = (base64String: string) => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }

  return outputArray
}

export const isPushSupported = () => {
  if (typeof window === 'undefined') return false

  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

export const isIosInstallRequiredForPush = () => {
  if (typeof window === 'undefined') return false

  const ua = window.navigator.userAgent.toLowerCase()
  const isIos =
    ua.includes('iphone') || ua.includes('ipad') || ua.includes('ipod')
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true

  return isIos && !isStandalone
}

export const getCurrentPushSubscription = async () => {
  if (!isPushSupported()) return null

  const registration = await navigator.serviceWorker.ready
  return registration.pushManager.getSubscription()
}

const fetchPublicVapidKey = async () => {
  const response = await fetch('/api/push/public-key')
  const payload = await response.json().catch(() => ({}))

  if (!response.ok || !payload?.publicKey) {
    throw new Error(payload?.error || 'Missing public VAPID key')
  }

  return payload.publicKey as string
}

const syncSubscriptionWithBackend = async (subscription: PushSubscription) => {
  const authHeaders = await getAuthHeaders()

  const response = await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
    },
    body: JSON.stringify({ subscription }),
  })

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}))
    throw new Error(payload?.error || 'Failed to save push subscription')
  }
}

export const subscribeDeviceToPush = async () => {
  if (!isPushSupported()) {
    throw new Error('Push notifications are not supported on this device')
  }

  if (Notification.permission === 'denied') {
    throw new Error('Push permission has been denied in browser settings')
  }

  let permission = Notification.permission
  if (permission === 'default') {
    permission = await Notification.requestPermission()
  }

  if (permission !== 'granted') {
    throw new Error('Push notification permission was not granted')
  }

  const registration = await navigator.serviceWorker.ready
  const existingSubscription = await registration.pushManager.getSubscription()
  if (existingSubscription) {
    await syncSubscriptionWithBackend(existingSubscription)
    return existingSubscription
  }

  const publicVapidKey = await fetchPublicVapidKey()
  const applicationServerKey = urlBase64ToUint8Array(publicVapidKey)

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey,
  })

  await syncSubscriptionWithBackend(subscription)
  return subscription
}

export const unsubscribeDeviceFromPush = async () => {
  const authHeaders = await getAuthHeaders()
  const subscription = await getCurrentPushSubscription()

  const endpoint = subscription?.endpoint || null

  await fetch('/api/push/unsubscribe', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
    },
    body: JSON.stringify({ endpoint }),
  }).catch(() => null)

  if (subscription) {
    await subscription.unsubscribe().catch(() => null)
  }
}

export const sendPushTestNotification = async () => {
  const authHeaders = await getAuthHeaders()

  const response = await fetch('/api/push/test', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
    },
    body: JSON.stringify({}),
  })

  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(payload?.error || 'Failed to send test notification')
  }

  return payload
}

