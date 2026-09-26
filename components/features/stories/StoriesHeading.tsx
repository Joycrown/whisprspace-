'use client'

import Link from 'next/link'
import { PenLine } from 'lucide-react'
import { useUserStore } from '@/store/userStore'

export default function StoriesHeading() {
  const session = useUserStore((state) => state.session)
  const sessionValidated = useUserStore((state) => state.sessionValidated)
  const isRegistered = sessionValidated && session.isAuthenticated && !session.user?.isAnonymous

  return (
    <div className="flex items-center justify-between gap-3 px-4 pb-1 pt-4 md:px-5">
      <h1 className="text-xl font-semibold tracking-[-0.3px] text-[#F2F2F6] md:text-2xl">
        <span className="bg-gradient-to-r from-[#C4B5FD] to-[#FDBA74] bg-clip-text text-transparent">Whispers</span>
        <span className="sr-only">: true stories, regrets, fiction and poetry shared anonymously on WhisprSpace</span>
      </h1>
      {isRegistered && (
        <Link
          href="/stories/new"
          prefetch={false}
          className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#F97316] px-3.5 text-xs font-medium text-white active:scale-[0.97]"
        >
          <PenLine className="h-3.5 w-3.5" />
          Tell your story
        </Link>
      )}
    </div>
  )
}
