'use client'

import Image from 'next/image'
import Link from 'next/link'
import { PenLine } from 'lucide-react'
import { useUserStore } from '@/store/userStore'
import { STORIES_FEED_PATH } from '@/lib/stories/config'

export default function StoriesTopBar() {
  const session = useUserStore((state) => state.session)
  const sessionValidated = useUserStore((state) => state.sessionValidated)
  const isRegistered = sessionValidated && session.isAuthenticated && !session.user?.isAnonymous

  if (isRegistered) return null

  return (
    <header className="flex items-center justify-between gap-3 border-b border-[#1C1C26] px-4 py-3 md:px-5">
      <Link href={STORIES_FEED_PATH} prefetch={false} className="flex items-center gap-2">
        <span className="relative h-8 w-8">
          <Image src="/assets/WS icon.png" alt="" fill sizes="32px" className="object-contain" />
        </span>
        <span className="text-[15px] font-semibold text-[#F2F2F6]">WhisprSpace</span>
      </Link>
      <div className="flex items-center gap-2">
        {sessionValidated && !isRegistered && (
          <Link href="/auth?view=login" prefetch={false} className="rounded-xl px-3 py-2 text-xs text-[#8F8FA3] hover:text-[#F2F2F6]">
            Sign in
          </Link>
        )}
        <Link
          href="/stories/new"
          prefetch={false}
          className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#F97316] px-3.5 text-xs font-medium text-white active:scale-[0.97]"
        >
          <PenLine className="h-3.5 w-3.5" />
          Tell your story
        </Link>
      </div>
    </header>
  )
}
