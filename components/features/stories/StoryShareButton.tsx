'use client'

import { useRef } from 'react'
import { Share2 } from 'lucide-react'
import { ShareDropdown } from '@/components/features/inbox/ShareDropdown'
import { useShareLink } from '@/lib/hooks/useShareLink'
import { siteConfig } from '@/lib/seo'
import { buildStoryPath } from '@/lib/stories/story-url'
import type { StoryCategory } from '@/lib/stories/types'

interface StoryShareButtonProps {
  story: { id: string; title: string; category: StoryCategory }
  variant?: 'primary' | 'pill' | 'icon'
  label?: string
  className?: string
}

const CAPTIONS: Record<StoryCategory, Array<(title: string) => string>> = {
  live_story: [
    (title) => `Life is writing this one live ⏳ "${title}"`,
    (title) => `Still unfolding, one update at a time 🌀 "${title}"`,
    (title) => `"${title}" ⏳ It's happening right now. Stay for what comes next.`,
  ],
  regret: [
    (title) => `The road I missed, and the decision I didn't make 🕯️ "${title}"`,
    (title) => `"${title}" 💭 What they wish someone had told them sooner.`,
    (title) => `Read this before you make the same choice 🕯️ "${title}"`,
  ],
  bad_experience: [
    (title) => `Some days leave a mark 🥀 "${title}"`,
    (title) => `Told without names, felt without filters 🥀 "${title}"`,
    (title) => `"${title}" 🩹 It really happened. Now it's finally been said.`,
  ],
  fiction: [
    (title) => `Started reading "${title}" and couldn't stop 📖 Your turn.`,
    (title) => `A story you won't see coming: "${title}" ✨`,
    (title) => `"${title}" 📖 One of those stories that stays with you long after the last line.`,
  ],
  poetry: [
    (title) => `Words that hit different 🖤 "${title}"`,
    (title) => `Read this one slowly: "${title}" ✍️`,
    (title) => `"${title}" 🖤 A poem someone needed to write, and you might need to read.`,
  ],
}

function shareTextFor(story: StoryShareButtonProps['story']) {
  const options = CAPTIONS[story.category] ?? CAPTIONS.fiction
  let hash = 0
  for (let index = 0; index < story.id.length; index += 1) hash = (hash * 31 + story.id.charCodeAt(index)) >>> 0
  return options[hash % options.length](story.title)
}

const VARIANT_CLASSES: Record<NonNullable<StoryShareButtonProps['variant']>, string> = {
  primary: 'flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#F97316] text-sm font-medium text-white active:scale-[0.98]',
  pill: 'inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#2A2A38] px-3 text-xs text-[#DFDFE7] hover:border-[#8B5CF6]/45',
  icon: 'flex h-8 w-8 items-center justify-center rounded-lg text-[#5C5C6E] hover:bg-white/[0.05] hover:text-[#F2F2F6]',
}

export default function StoryShareButton({ story, variant = 'pill', label = 'Share', className = '' }: StoryShareButtonProps) {
  const buttonRef = useRef<HTMLButtonElement>(null)
  const link = `${siteConfig.appUrl}${buildStoryPath(story)}`
  const {
    copied,
    showDropdown,
    dropdownPos,
    openDropdown,
    closeDropdown,
    copyLink,
    shareOnTwitter,
    shareOnFacebook,
    shareOnWhatsApp,
    shareOnLinkedIn,
    shareOnInstagram,
    shareViaEmail,
  } = useShareLink({ link, shareText: shareTextFor(story), downloadName: 'whisprspace-story' })

  const open = (event: React.MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    if (buttonRef.current) openDropdown(buttonRef.current.getBoundingClientRect())
    import('posthog-js').then(({ default: posthog }) => posthog.capture('story_share_opened', { story_id: story.id })).catch(() => {})
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={open}
        aria-label={variant === 'icon' ? 'Share story' : undefined}
        className={`${VARIANT_CLASSES[variant]} ${className}`}
      >
        <Share2 className={variant === 'primary' ? 'h-4 w-4' : 'h-3.5 w-3.5'} />
        {variant !== 'icon' && (copied ? 'Link copied' : label)}
      </button>
      {showDropdown && (
        <ShareDropdown
          position={dropdownPos}
          onClose={closeDropdown}
          onCopyLink={copyLink}
          onTwitter={shareOnTwitter}
          onFacebook={shareOnFacebook}
          onWhatsApp={shareOnWhatsApp}
          onLinkedIn={shareOnLinkedIn}
          onInstagram={shareOnInstagram}
          onEmail={() => shareViaEmail(story.title)}
        />
      )}
    </>
  )
}
