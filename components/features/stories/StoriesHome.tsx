import { getLatestStories } from '@/lib/stories/server'
import type { StoryFeedPage } from '@/lib/stories/types'
import StoriesHeading from './StoriesHeading'
import StoriesTopBar from './StoriesTopBar'
import StoryFeed from './StoryFeed'

export default async function StoriesHome() {
  let initial: StoryFeedPage = { items: [], nextCursor: null }
  try {
    initial = await getLatestStories()
  } catch {
    initial = { items: [], nextCursor: null }
  }

  return (
    <div className="min-h-screen bg-[#0A0A10] text-[#F2F2F6]">
      <div className="mx-auto w-full max-w-2xl md:border-x md:border-[#1C1C26]">
        <StoriesTopBar />
        <StoriesHeading />
        <StoryFeed initial={initial} />
      </div>
    </div>
  )
}
