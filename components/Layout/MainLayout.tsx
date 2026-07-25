'use client'

import { useEffect } from "react"
import { usePathname } from "next/navigation"
import { publicRoutes } from "@/lib/utils/utils/routes"
import Sidebar from "./Sidebar"
import BottomNav from "./BottomNav"
import PWAInstallPrompt from "@/components/pwa/PWAInstallPrompt"
import NotificationEducationPrompt from "@/components/features/notifications/NotificationEducationPrompt"
import FirstTimeEducationModal from "@/components/features/onboarding/FirstTimeEducationModal"
import { UnseenSummaryModal } from "@/components/features/threads/UnseenSummaryModal"
import { PostThreadNudge } from "@/components/features/inbox/PostThreadNudge"

// components/layout/MainLayout.tsx
export default function MainLayout({
  children
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()

  // Global seed trigger — fires on mount and every 2 minutes across all pages
  // so reply scheduling continues even when navigating away from the feed
  useEffect(() => {
    fetch('/api/cron/seed-trigger').catch(() => {})
    const interval = setInterval(() => {
      fetch('/api/cron/seed-trigger').catch(() => {})
    }, 2 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])
  // Launch page — render with zero chrome, no seed trigger
  if (pathname === '/launch') {
    return <>{children}</>
  }

  const isPublicRoute =
    publicRoutes.includes(pathname || '') ||
    (pathname?.startsWith('/auth/') ?? false) ||
    (pathname?.startsWith('/profile/') ?? false) ||
    (pathname?.startsWith('/message/') ?? false) ||
    // Seed-account claim links (/claim/[token]) are standalone, logged-out pages —
    // no app chrome, no other user's sidebar/session should bleed through.
    (pathname?.startsWith('/claim/') ?? false)

  if (isPublicRoute) {
    return (
      <main className="min-h-screen bg-[#121212]">
        <div className="w-full">
          {children}
        </div>
        <FirstTimeEducationModal />
        <NotificationEducationPrompt />
        <PWAInstallPrompt />
      </main>
    )
  }

  return (
    <div className="min-h-screen bg-[#121212] flex overflow-x-hidden w-full max-w-full">
      {/* Desktop Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <main className="flex-1 flex justify-center md:pl-20 pb-16 md:pb-0 overflow-x-hidden w-full min-w-0">
        <div className="w-full max-w-7xl overflow-x-hidden">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <BottomNav />
      <FirstTimeEducationModal />
      <NotificationEducationPrompt />
      <PWAInstallPrompt />
      <UnseenSummaryModal />
      <PostThreadNudge />
    </div>
  )
}
