'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { usePathname } from 'next/navigation'
import { BellRing, Settings, X } from 'lucide-react'
import { useUserStore } from '@/store/userStore'
import {
  getCurrentPushSubscription,
  isPushSupported,
} from '@/lib/notifications/push-client'
import NotificationPreferencesModal from './NotificationPreferencesModal'

const DISMISS_KEY = 'whispr_notification_education_dismissed_at'
const DISMISS_COOLDOWN_MS = 3 * 24 * 60 * 60 * 1000

type ReminderReason =
  | 'in_app_disabled'
  | 'mentions_disabled'
  | 'push_disabled'
  | 'push_not_connected'

const REASON_COPY: Record<ReminderReason, string> = {
  in_app_disabled: 'In-app notifications are currently turned off.',
  mentions_disabled: 'Mention alerts are currently turned off.',
  push_disabled: 'Push notifications are currently turned off.',
  push_not_connected: 'Push is on, but this device is not subscribed yet.',
}

const NotificationEducationPrompt: React.FC = () => {
  const pathname = usePathname()
  const { session } = useUserStore()
  const prefs = session.user?.preferences?.notifications

  const [isVisible, setIsVisible] = useState(false)
  const [showPreferencesModal, setShowPreferencesModal] = useState(false)
  const [reasons, setReasons] = useState<ReminderReason[]>([])

  const shouldSkipRoute = useMemo(() => {
    if (!pathname) return false
    return pathname.startsWith('/auth') || pathname.startsWith('/api')
  }, [pathname])

  useEffect(() => {
    let isCancelled = false

    const evaluatePrompt = async () => {
      if (typeof window === 'undefined') return

      if (!session.user || shouldSkipRoute) {
        setIsVisible(false)
        return
      }

      const dismissedAt = Number(window.localStorage.getItem(DISMISS_KEY) || '0')
      const dismissedRecently =
        dismissedAt > 0 && Date.now() - dismissedAt < DISMISS_COOLDOWN_MS

      if (dismissedRecently) {
        setIsVisible(false)
        return
      }

      const nextReasons: ReminderReason[] = []

      if (prefs?.inApp === false) {
        nextReasons.push('in_app_disabled')
      }

      if (prefs?.mentions === false) {
        nextReasons.push('mentions_disabled')
      }

      if (prefs?.push === false) {
        nextReasons.push('push_disabled')
      } else if (isPushSupported()) {
        const subscription = await getCurrentPushSubscription().catch(() => null)
        if (!subscription) {
          nextReasons.push('push_not_connected')
        }
      }

      if (isCancelled) return

      setReasons(nextReasons)
      setIsVisible(nextReasons.length > 0)
    }

    evaluatePrompt()

    return () => {
      isCancelled = true
    }
  }, [
    session.user,
    prefs?.inApp,
    prefs?.mentions,
    prefs?.push,
    shouldSkipRoute,
  ])

  const handleDismiss = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now()))
    }
    setIsVisible(false)
  }

  const handleOpenSettings = () => {
    setShowPreferencesModal(true)
    setIsVisible(false)
  }

  return (
    <>
      {isVisible && (
        <div className="fixed inset-x-3 bottom-[calc(9.5rem+env(safe-area-inset-bottom))] z-[1250] md:inset-x-auto md:right-5 md:bottom-24 md:w-[380px]">
          <div className="rounded-2xl border border-blue-500/30 bg-[#141C2C]/95 shadow-2xl backdrop-blur-md p-4 text-white">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full border border-blue-400/40 bg-blue-500/20">
                  <BellRing className="h-4 w-4 text-blue-300" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Stay Updated</p>
                  <p className="text-xs text-gray-300">Turn on alerts so you do not miss activity.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleDismiss}
                aria-label="Dismiss notification reminder"
                className="rounded-md p-1 text-gray-400 hover:bg-slate-700/70 hover:text-white transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-3 space-y-1.5 text-xs text-gray-200">
              {reasons.slice(0, 3).map((reason) => (
                <p key={reason}>- {REASON_COPY[reason]}</p>
              ))}
              <p className="text-blue-200">
                Tip: use @username or @ANON_12345678 to mention someone.
              </p>
            </div>

            <div className="mt-4 flex items-center gap-2">
              <button
                type="button"
                onClick={handleOpenSettings}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-teal-500 px-3 py-2 text-sm font-semibold hover:opacity-95 transition-opacity"
              >
                <Settings className="h-4 w-4" />
                Open Notification Settings
              </button>
              <button
                type="button"
                onClick={handleDismiss}
                className="rounded-lg border border-slate-600 px-3 py-2 text-xs text-gray-200 hover:bg-slate-700/60 transition-colors"
              >
                Later
              </button>
            </div>
          </div>
        </div>
      )}

      <NotificationPreferencesModal
        isOpen={showPreferencesModal}
        onClose={() => setShowPreferencesModal(false)}
      />
    </>
  )
}

export default NotificationEducationPrompt
