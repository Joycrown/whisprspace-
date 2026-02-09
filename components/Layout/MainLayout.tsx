'use client'

import { usePathname } from "next/navigation"
import { publicRoutes } from "@/lib/utils/utils/routes"
import Sidebar from "./Sidebar"
import BottomNav from "./BottomNav"

// components/layout/MainLayout.tsx
export default function MainLayout({
  children
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const isPublicRoute =
    publicRoutes.includes(pathname || '') ||
    (pathname?.startsWith('/profile/') ?? false) ||
    (pathname?.startsWith('/message/') ?? false)

  if (isPublicRoute) {
    return (
      <main className="min-h-screen bg-[#121212]">
        <div className="w-full">
          {children}
        </div>
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
    </div>
  )
}
