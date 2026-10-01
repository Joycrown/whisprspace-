'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Bell, BellOff, Flag, Loader2, Settings2 } from 'lucide-react'
import { isPushSupported, subscribeDeviceToPush } from '@/lib/notifications/push-client'
import { storiesApi } from '@/lib/stories/api-client'
import type { StoryCategory } from '@/lib/stories/types'
import { useStoryViewer } from './StoryViewerContext'
import ReportStoryModal from './ReportStoryModal'
import StoryShareButton from './StoryShareButton'

interface StoryActionsProps {
  storyId: string
  title: string
  category: StoryCategory
  path: string
  canFollow: boolean
}

export default function StoryActions({ storyId, title, category, path, canFollow }: StoryActionsProps) {
  const { viewer, isRegistered, setFollowing, requireAccount } = useStoryViewer()
  const [followBusy, setFollowBusy] = useState(false)
  const [reporting, setReporting] = useState(false)

  const toggleFollow = async () => {
    if (!isRegistered) {
      requireAccount('follow')
      return
    }
    if (followBusy) return
    const next = !viewer.isFollowing
    if (next && isPushSupported() && Notification.permission === 'default') {
      subscribeDeviceToPush().catch(() => {})
    }
    setFollowBusy(true)
    setFollowing(next)
    try {
      await storiesApi(`/api/stories/${storyId}/follow`, { method: next ? 'POST' : 'DELETE' })
      if (next) import('posthog-js').then(({ default: posthog }) => posthog.capture('story_followed', { story_id: storyId })).catch(() => {})
    } catch {
      setFollowing(!next)
    } finally {
      setFollowBusy(false)
    }
  }

  const button = 'inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#2A2A38] px-3 text-xs text-[#DFDFE7] hover:border-[#8B5CF6]/45 disabled:opacity-50'

  return (
    <div className="flex flex-wrap items-center gap-2">
      {canFollow && (
        <button onClick={toggleFollow} disabled={followBusy} className={viewer.isFollowing ? `${button} border-[#8B5CF6]/50 bg-[#8B5CF6]/10` : button}>
          {followBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : viewer.isFollowing ? <BellOff className="h-3.5 w-3.5" /> : <Bell className="h-3.5 w-3.5" />}
          {viewer.isFollowing ? 'Following' : 'Follow for new episodes'}
        </button>
      )}
      <StoryShareButton story={{ id: storyId, title, category }} variant="pill" />
      {viewer.isAuthor ? (
        <Link href={`${path}/manage`} prefetch={false} className={button}>
          <Settings2 className="h-3.5 w-3.5" />
          Manage your story
        </Link>
      ) : (
        <button onClick={() => setReporting(true)} className={`${button} ml-auto border-transparent text-[#5C5C6E]`}>
          <Flag className="h-3.5 w-3.5" />
          Report
        </button>
      )}
      {reporting && <ReportStoryModal storyId={storyId} onClose={() => setReporting(false)} />}
    </div>
  )
}
