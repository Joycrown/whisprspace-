'use client'

import { useEffect } from 'react'

export default function ServiceWorkerGuard() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return

    navigator.serviceWorker.getRegistrations()
      .then((registrations) => {
        registrations.forEach((registration) => {
          registration.unregister().catch(() => null)
        })
      })
      .catch(() => null)
  }, [])

  return null
}
