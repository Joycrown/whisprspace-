import type { Metadata } from 'next'
import StoryComposer from '@/components/features/stories/StoryComposer'

export const metadata: Metadata = {
  title: 'Tell your story | WhisprSpace',
  description: 'Share a true story, a regret, fiction or a poem, anonymously.',
  robots: { index: false, follow: true },
}

export default function NewStoryPage() {
  return <StoryComposer />
}
