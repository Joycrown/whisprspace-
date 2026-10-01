'use client'

import { usePathname } from "next/navigation"
import { publicRoutes } from "@/lib/utils/utils/routes"
import Sidebar from "./Sidebar"
import BottomNav from "./BottomNav"
import PWAInstallPrompt from "@/components/pwa/PWAInstallPrompt"
import NotificationEducationPrompt from "@/components/features/notifications/NotificationEducationPrompt"
import FirstTimeEducationModal from "@/components/features/onboarding/FirstTimeEducationModal"
import { UnseenSummaryModal } from "@/components/features/threads/UnseenSummaryModal"
import { PostThreadNudge } from "@/components/features/inbox/PostThreadNudge"
import SupportButton from "@/components/SupportButton"
import { useUserStore } from "@/store/userStore"
import { isStoriesPath, isStoryReaderPath } from "@/lib/stories/config"

// components/layout/MainLayout.tsx
export default function MainLayout({
  children
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const session = useUserStore((state) => state.session)
  const sessionValidated = useUserStore((state) => state.sessionValidated)
  const isRegistered = Boolean(sessionValidated && session.isAuthenticated && session.user && !session.user.isAnonymous)
  const onStories = isStoriesPath(pathname)

  // Launch page — render with zero chrome
  if (pathname === '/launch') {
    return <>{children}</>
  }

  // Matches only the sender-facing ask landing page (/curiosity-ask/[id]), never
  // /curiosity-ask/create or /curiosity-ask/[id]/manage|export — those keep the app chrome.
  const isPublicPromptPage = /^\/curiosity-ask\/[^/]+\/?$/.test(pathname || '')

  if (onStories && !isRegistered) {
    return (
      <div className="min-h-screen bg-[#0A0A10] flex overflow-x-hidden w-full max-w-full">
        <Sidebar />
        <main className="flex-1 md:pl-20 pb-16 md:pb-0 overflow-x-hidden w-full min-w-0">{children}</main>
        <BottomNav />
      </div>
    )
  }

  const isPublicRoute =
    (publicRoutes.includes(pathname || '') && !onStories) ||
    (pathname?.startsWith('/auth/') ?? false) ||
    (pathname?.startsWith('/profile/') ?? false) ||
    (pathname?.startsWith('/message/') ?? false) ||
    // Seed-account claim links (/claim/[token]) are standalone, logged-out pages —
    // no app chrome, no other user's sidebar/session should bleed through.
    (pathname?.startsWith('/claim/') ?? false) ||
    isPublicPromptPage

  // Anonymous message-drop, ask, and claim pages have their own prominent send
  // button. A floating chat FAB next to it reads as "send your message here", so
  // support messages were landing in the support inbox instead of the recipient's.
  const hidesSupportFab =
    (pathname?.startsWith('/message/') ?? false) ||
    (pathname?.startsWith('/claim/') ?? false) ||
    isPublicPromptPage

  if (isPublicRoute) {
    return (
      <main className="min-h-screen bg-[#121212]">
        <div className="w-full">
          {children}
        </div>
        <FirstTimeEducationModal />
        <NotificationEducationPrompt />
        <PWAInstallPrompt />
        {!hidesSupportFab && <SupportButton />}
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
      {!isStoryReaderPath(pathname) && <SupportButton />}
    </div>
  )
}
