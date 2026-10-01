import LivePulse from '@/components/ui/LivePulse'
import { CATEGORY_META, isStoryLive, type StoryFeedItem } from '@/lib/stories/types'

type TagSource = Pick<StoryFeedItem, 'category' | 'family' | 'is_episodic' | 'status' | 'last_episode_at' | 'is_sensitive'>

export default function StoryTags({ story, size = 'sm' }: { story: TagSource; size?: 'sm' | 'md' }) {
  const meta = CATEGORY_META[story.category]
  const isTrue = story.family === 'true_story'
  const text = size === 'md' ? 'text-[11px]' : 'text-[10px]'

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span
        className={`rounded-full px-2 py-0.5 font-bold uppercase tracking-[0.1em] ${text} ${
          isTrue ? 'bg-[#5DCAA5]/[0.12] text-[#7FE0BF] border border-[#5DCAA5]/30' : 'bg-[#8B5CF6]/[0.12] text-[#C4B5FD] border border-[#8B5CF6]/30'
        }`}
      >
        {meta.tag}
      </span>
      <span className={`rounded-full border border-[#2A2A38] px-2 py-0.5 text-[#8F8FA3] ${text}`}>{meta.label}</span>
      {story.is_sensitive && <span className={`rounded-full border border-[#E24B4A]/30 px-2 py-0.5 text-[#F09595] ${text}`}>Sensitive</span>}
      {isStoryLive(story) && <LivePulse label={story.is_episodic ? 'Ongoing' : 'Live'} />}
      {story.status === 'finished' && story.is_episodic && <span className={`rounded-full border border-[#2A2A38] px-2 py-0.5 text-[#5C5C6E] ${text}`}>Finished</span>}
    </div>
  )
}
