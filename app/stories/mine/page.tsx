import type { Metadata } from 'next'
import MyStories from '@/components/features/stories/MyStories'

export const metadata: Metadata = {
  title: 'My stories | WhisprSpace',
  robots: { index: false, follow: false },
}

export default function MyStoriesPage() {
  return (
    <div className="min-h-screen bg-[#0A0A10] text-[#F2F2F6]">
      <MyStories />
    </div>
  )
}
