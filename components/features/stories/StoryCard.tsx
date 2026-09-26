import { memo } from 'react'
import Link from 'next/link'
import { Bell, BookOpen, MessageCircle } from 'lucide-react'
import { buildStoryPath } from '@/lib/stories/story-url'
import type { StoryFeedItem } from '@/lib/stories/types'
import RelativeTime from './RelativeTime'
import StoryShareButton from './StoryShareButton'
import StoryTags from './StoryTags'

function StoryCard({ story }: { story: StoryFeedItem }) {
  return (
    <li className="relative [content-visibility:auto] [contain-intrinsic-size:auto_168px]">
      <Link
        href={buildStoryPath(story)}
        prefetch={false}
        className="block px-4 py-4 transition-colors hover:bg-white/[0.025] focus-visible:bg-white/[0.04] focus-visible:outline-none md:px-5"
      >
        <div className="pr-9">
          <StoryTags story={story} />
        </div>
        <h3 className="mt-2.5 text-[15px] font-medium leading-snug text-[#F2F2F6] md:text-base">{story.title}</h3>
        <p className={`mt-1 line-clamp-3 break-words text-sm leading-6 text-[#8F8FA3] ${story.is_sensitive ? 'blur-[3px] select-none' : ''}`}>
          {story.excerpt}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#5C5C6E]">
          <span className="flex items-center gap-1">
            <MessageCircle className="h-3.5 w-3.5" />
            {story.reply_count}
          </span>
          {story.is_episodic && (
            <span className="flex items-center gap-1">
              <BookOpen className="h-3.5 w-3.5" />
              {story.episode_count} {story.episode_count === 1 ? 'episode' : 'episodes'}
            </span>
          )}
          {story.is_episodic && story.follower_count > 0 && (
            <span className="flex items-center gap-1">
              <Bell className="h-3.5 w-3.5" />
              {story.follower_count}
            </span>
          )}
          <span className="ml-auto">
            <RelativeTime iso={story.last_episode_at} prefix={story.is_episodic ? 'Last episode ' : ''} />
          </span>
        </div>
      </Link>
      <div className="absolute right-2.5 top-2.5 md:right-3.5">
        <StoryShareButton story={story} variant="icon" />
      </div>
    </li>
  )
}

export default memo(StoryCard)
