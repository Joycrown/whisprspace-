'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Bell, Check, AlertCircle, Send } from 'lucide-react'
import { useUserStore } from '@/store/userStore'
import {
  getCurrentPushSubscription,
  isIosInstallRequiredForPush,
  isPushSupported,
  sendPushTestNotification,
  subscribeDeviceToPush,
  unsubscribeDeviceFromPush,
} from '@/lib/notifications/push-client'

interface PushNotificationSettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

type Notice = {
  tone: 'success' | 'error' | 'info'
  message: string
} | null

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error && error.message) {
    return error.message
  }

  return 'An unexpected error occurred.'
}

const PushNotificationSettingsModal: React.FC<PushNotificationSettingsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { session, updatePreferences } = useUserStore()

  const [isLoading, setIsLoading] = useState(false)
  const [isSendingTest, setIsSendingTest] = useState(false)
  const [isPushEnabled, setIsPushEnabled] = useState(false)
  const [isBrowserSupported, setIsBrowserSupported] = useState(false)
  const [isPermissionGranted, setIsPermissionGranted] = useState(false)
  const [requiresIosInstall, setRequiresIosInstall] = useState(false)
  const [notice, setNotice] = useState<Notice>(null)

  const persistPushPreference = useCallback(
    async (enabled: boolean) => {
      if (!session.user) return

      const currentPreferences = session.user.preferences
      if (!currentPreferences) return

      const nextPreferences = {
        ...currentPreferences,
        notifications: {
          ...currentPreferences.notifications,
          push: enabled,
        },
      }

      await updatePreferences(nextPreferences)
    },
    [session.user, updatePreferences]
  )

  const syncStatus = useCallback(async () => {
    const supported = isPushSupported()
    setIsBrowserSupported(supported)
    setRequiresIosInstall(isIosInstallRequiredForPush())

    if (!supported) {
      setIsPermissionGranted(false)
      setIsPushEnabled(false)
      return
    }

    const hasPermission = Notification.permission === 'granted'
    setIsPermissionGranted(hasPermission)

    const subscription = await getCurrentPushSubscription()
    setIsPushEnabled(Boolean(subscription && hasPermission))
  }, [])

  useEffect(() => {
    if (!isOpen) return
    setNotice(null)
    syncStatus()
  }, [isOpen, syncStatus])

  const handleTogglePush = async () => {
    if (!isBrowserSupported) {
      setNotice({
        tone: 'error',
        message: 'Push notifications are not supported on this device/browser.',
      })
      return
    }

    setNotice(null)
    setIsLoading(true)

    try {
      if (isPushEnabled) {
        await unsubscribeDeviceFromPush()
        await persistPushPreference(false)
        setNotice({ tone: 'info', message: 'Push notifications disabled.' })
      } else {
        await subscribeDeviceToPush()
        await persistPushPreference(true)
        setNotice({ tone: 'success', message: 'Push notifications enabled.' })
      }

      await syncStatus()
    } catch (error: unknown) {
      setNotice({
        tone: 'error',
        message: getErrorMessage(error),
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleSendTest = async () => {
    setNotice(null)
    setIsSendingTest(true)

    try {
      await sendPushTestNotification()
      setNotice({
        tone: 'success',
        message: 'Test notification sent. Check your device notification tray.',
      })
    } catch (error: unknown) {
      setNotice({
        tone: 'error',
        message: getErrorMessage(error),
      })
    } finally {
      setIsSendingTest(false)
    }
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center modal-safe-overlay"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-white rounded-xl shadow-2xl w-full max-w-lg modal-safe-panel overflow-y-auto p-6 text-gray-900"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">Push Notification Settings</h2>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="space-y-6">
            {!isBrowserSupported && (
              <div
                className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative"
                role="alert"
              >
                <AlertCircle className="inline w-5 h-5 mr-2" />
                <span className="block sm:inline">
                  This browser/device does not currently support Web Push for this site context.
                </span>
              </div>
            )}

            {requiresIosInstall && (
              <div className="bg-blue-100 border border-blue-300 text-blue-800 px-4 py-3 rounded relative">
                <AlertCircle className="inline w-5 h-5 mr-2" />
                <span className="block sm:inline">
                  On iOS, install the app to Home Screen first, then enable push from the installed app.
                </span>
              </div>
            )}

            <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
              <div className="flex items-center gap-3">
                <Bell className="w-5 h-5 text-purple-600" />
                <span className="text-gray-800 font-medium">Enable Push Notifications</span>
              </div>
              <button
                type="button"
                onClick={handleTogglePush}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 ${
                  isPushEnabled ? 'bg-purple-600' : 'bg-gray-200'
                } ${isLoading ? 'opacity-60 cursor-not-allowed' : ''}`}
                disabled={!isBrowserSupported || isLoading}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    isPushEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {isPushEnabled && isPermissionGranted && (
              <div className="p-3 bg-green-100 border border-green-400 text-green-700 rounded-lg flex items-center gap-2">
                <Check className="w-5 h-5" />
                <span>Push notifications are enabled for this device.</span>
              </div>
            )}

            {notice && (
              <div
                className={`p-3 rounded-lg flex items-center gap-2 ${
                  notice.tone === 'success'
                    ? 'bg-green-100 border border-green-400 text-green-700'
                    : notice.tone === 'error'
                      ? 'bg-red-100 border border-red-400 text-red-700'
                      : 'bg-blue-100 border border-blue-400 text-blue-700'
                }`}
              >
                <AlertCircle className="w-5 h-5" />
                <span>{notice.message}</span>
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleSendTest}
                disabled={!isPushEnabled || isSendingTest}
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-4 h-4" />
                {isSendingTest ? 'Sending...' : 'Send Test'}
              </button>
            </div>

            <div className="text-sm text-gray-600 mt-4">
              <p>
                Push notifications allow you to receive updates even when WhisprSpace is in the background.
              </p>
              <p className="mt-2">
                You can always change permission in browser or device site settings.
              </p>
            </div>
          </div>

          <div className="flex justify-end mt-6">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Close
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

export default PushNotificationSettingsModal
