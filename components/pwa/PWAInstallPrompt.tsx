'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Download, Plus, Share2, X } from 'lucide-react'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{
    outcome: 'accepted' | 'dismissed'
    platform: string
  }>
}

const DISMISS_KEY = 'whispr_pwa_prompt_dismissed_at'
const DISMISS_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000

const isInStandaloneMode = () => {
  if (typeof window === 'undefined') return false
  const navigatorWithStandalone = window.navigator as Navigator & { standalone?: boolean }
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    navigatorWithStandalone.standalone === true
  )
}

export default function PWAInstallPrompt() {
  const pathname = usePathname()

  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isVisible, setIsVisible] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [isAndroid, setIsAndroid] = useState(false)
  const [showManualGuide, setShowManualGuide] = useState(false)

  const shouldHideByRoute = useMemo(() => {
    if (!pathname) return false
    return pathname.startsWith('/auth') || pathname.startsWith('/api')
  }, [pathname])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const ua = window.navigator.userAgent.toLowerCase()
    const ios = /iphone|ipad|ipod/.test(ua)
    const android = /android/.test(ua)
    const standalone = isInStandaloneMode()

    setIsIOS(ios)
    setIsAndroid(android)
    setIsStandalone(standalone)

    if (standalone) {
      setIsVisible(false)
      setShowManualGuide(false)
      return
    }

    const dismissedAt = Number(window.localStorage.getItem(DISMISS_KEY) || '0')
    const dismissedRecently = dismissedAt > 0 && Date.now() - dismissedAt < DISMISS_COOLDOWN_MS
    if (dismissedRecently) {
      setIsVisible(false)
      return
    }

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      setDeferredPrompt(event as BeforeInstallPromptEvent)
      setIsVisible(true)
    }

    const handleAppInstalled = () => {
      setDeferredPrompt(null)
      setIsStandalone(true)
      setIsVisible(false)
      setShowManualGuide(false)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt as EventListener)
    window.addEventListener('appinstalled', handleAppInstalled)

    // iOS Safari and some Android browsers don't fire beforeinstallprompt,
    // so provide manual install guidance after mount.
    const manualInstallTimer = window.setTimeout(() => {
      if (isInStandaloneMode()) return
      if (!ios && !android) return
      setIsVisible(true)
    }, 1400)

    return () => {
      window.clearTimeout(manualInstallTimer)
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt as EventListener)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  const dismissPrompt = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now()))
    }
    setShowManualGuide(false)
    setIsVisible(false)
  }

  const handleInstall = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt()
      const choice = await deferredPrompt.userChoice
      if (choice.outcome === 'accepted') {
        setIsVisible(false)
        setShowManualGuide(false)
      }
      setDeferredPrompt(null)
      return
    }

    // iOS and some Android browsers need manual install steps.
    setShowManualGuide(true)
  }

  if (isStandalone || !isVisible || shouldHideByRoute) return null

  const isManualMode = !deferredPrompt

  return (
    <div className="fixed inset-x-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-[1300] md:inset-x-auto md:right-5 md:bottom-5 md:w-[360px]">
      <div className="rounded-2xl border border-gray-700/80 bg-[#151515]/95 backdrop-blur-md shadow-2xl p-4 text-white">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-600/30 border border-purple-500/40">
              <Download className="h-4 w-4 text-purple-300" />
            </div>
            <div>
              <p className="text-sm font-semibold">Install WhisprSpace</p>
              <p className="text-xs text-gray-300">Use it like a native app</p>
            </div>
          </div>
          <button
            type="button"
            onClick={dismissPrompt}
            className="rounded-md p-1 text-gray-400 hover:text-white hover:bg-gray-700/60 transition-colors"
            aria-label="Dismiss install prompt"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {isManualMode ? (
          <div className="mt-3 space-y-2 text-xs text-gray-200">
            {isIOS ? (
              <>
                <p>On iPhone/iPad: tap</p>
                <div className="flex items-center gap-2 text-gray-100">
                  <Share2 className="h-3.5 w-3.5 text-blue-300" />
                  <span>Share</span>
                  <span className="text-gray-400">then</span>
                  <Plus className="h-3.5 w-3.5 text-green-300" />
                  <span>Add to Home Screen</span>
                </div>
              </>
            ) : (
              <p>
                Open your browser menu and choose <strong>Install app</strong> or{' '}
                <strong>Add to Home screen</strong>.
              </p>
            )}
          </div>
        ) : null}

        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={handleInstall}
            className="flex-1 rounded-lg bg-gradient-to-r from-purple-600 to-orange-500 px-3 py-2 text-sm font-semibold hover:opacity-95 transition-opacity"
          >
            Install App
          </button>
          <button
            type="button"
            onClick={dismissPrompt}
            className="rounded-lg border border-gray-600 px-3 py-2 text-xs text-gray-200 hover:bg-gray-700/50 transition-colors"
          >
            Later
          </button>
        </div>
      </div>

      {isManualMode && showManualGuide ? (
        <div className="fixed inset-0 z-[1400] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl border border-gray-700 bg-[#151515] shadow-2xl p-5 text-white">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold">Install WhisprSpace</h3>
                <p className="text-xs text-gray-300 mt-1">
                  Follow these steps to add the app to your home screen.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowManualGuide(false)}
                className="rounded-md p-1 text-gray-400 hover:text-white hover:bg-gray-700/60 transition-colors"
                aria-label="Close install guide"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {isIOS ? (
                <>
                  <div className="rounded-lg border border-gray-700 bg-gray-900/60 p-3">
                    <p className="text-sm font-semibold">1. Tap Share in Safari</p>
                    <p className="text-xs text-gray-300 mt-1 flex items-center gap-2">
                      <Share2 className="h-3.5 w-3.5 text-blue-300" />
                      Tap the Share icon in the Safari toolbar.
                    </p>
                  </div>
                  <div className="rounded-lg border border-gray-700 bg-gray-900/60 p-3">
                    <p className="text-sm font-semibold">2. Choose Add to Home Screen</p>
                    <p className="text-xs text-gray-300 mt-1 flex items-center gap-2">
                      <Plus className="h-3.5 w-3.5 text-green-300" />
                      Scroll the menu and tap Add to Home Screen.
                    </p>
                  </div>
                  <div className="rounded-lg border border-gray-700 bg-gray-900/60 p-3">
                    <p className="text-sm font-semibold">3. Tap Add</p>
                    <p className="text-xs text-gray-300 mt-1">
                      The app icon will appear on your Home Screen.
                    </p>
                  </div>
                  <div className="rounded-lg border border-indigo-500/40 bg-indigo-500/10 p-3">
                    <p className="text-xs text-indigo-100">
                      After installing, open the app from Home Screen to enable push notifications on iPhone.
                    </p>
                  </div>
                </>
              ) : isAndroid ? (
                <>
                  <div className="rounded-lg border border-gray-700 bg-gray-900/60 p-3">
                    <p className="text-sm font-semibold">1. Open browser menu</p>
                    <p className="text-xs text-gray-300 mt-1">
                      Tap the menu button in your browser.
                    </p>
                  </div>
                  <div className="rounded-lg border border-gray-700 bg-gray-900/60 p-3">
                    <p className="text-sm font-semibold">2. Tap Install App</p>
                    <p className="text-xs text-gray-300 mt-1">
                      Choose Install app or Add to Home screen.
                    </p>
                  </div>
                </>
              ) : (
                <div className="rounded-lg border border-gray-700 bg-gray-900/60 p-3">
                  <p className="text-sm font-semibold">Install from browser menu</p>
                  <p className="text-xs text-gray-300 mt-1">
                    Use your browser install option to add WhisprSpace to your device.
                  </p>
                </div>
              )}
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={dismissPrompt}
                className="rounded-lg border border-gray-600 px-3 py-2 text-xs text-gray-200 hover:bg-gray-700/50 transition-colors"
              >
                Remind Me Later
              </button>
              <button
                type="button"
                onClick={() => setShowManualGuide(false)}
                className="rounded-lg bg-gradient-to-r from-purple-600 to-orange-500 px-4 py-2 text-sm font-semibold text-white hover:opacity-95 transition-opacity"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
