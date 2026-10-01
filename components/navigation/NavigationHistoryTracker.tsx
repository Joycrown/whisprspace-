'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { recordNavigation, startHistoryTracking } from '@/lib/navigation/in-app-history'

export default function NavigationHistoryTracker() {
  const pathname = usePathname()

  useEffect(() => {
    startHistoryTracking()
  }, [])

  useEffect(() => {
    if (!pathname) return
    recordNavigation(pathname)
  }, [pathname])

  return null
}
