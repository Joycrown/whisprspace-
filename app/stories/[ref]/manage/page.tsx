import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import StoryManager from '@/components/features/stories/StoryManager'
import { extractStoryIdFromRef } from '@/lib/stories/story-url'

export const metadata: Metadata = {
  title: 'Manage your story | WhisprSpace',
  robots: { index: false, follow: false },
}

export default async function ManageStoryPage({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params
  const storyId = extractStoryIdFromRef(ref)
  if (!storyId) notFound()

  return (
    <div className="min-h-screen bg-[#0A0A10] text-[#F2F2F6]">
      <StoryManager storyId={storyId} />
    </div>
  )
}
