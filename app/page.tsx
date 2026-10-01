import type { Metadata } from 'next'
import MarketingLanding from '@/components/features/marketing/MarketingLanding'
import MarketingStoriesStrip from '@/components/features/marketing/MarketingStoriesStrip'
import StoriesHome from '@/components/features/stories/StoriesHome'
import { storiesIsHome } from '@/lib/stories/config'
import { getLatestStories } from '@/lib/stories/server'
import { siteConfig } from '@/lib/seo'

export const revalidate = 60

const STORIES_TITLE = storiesIsHome
  ? 'WhisprSpace: True stories & fiction, told anonymously'
  : 'WhisprSpace: Say what you really think. Hear what they really think.'
const STORIES_DESCRIPTION = storiesIsHome
  ? 'Read real experiences, regrets, fiction and poetry shared anonymously. Relate, comment, or tell your own.'
  : 'Read real stories told anonymously, get honest messages from friends with your anonymous link, and ask the questions you’d never ask face to face. No names. No trace.'

export const metadata: Metadata = {
  title: STORIES_TITLE,
  description: STORIES_DESCRIPTION,
  alternates: { canonical: storiesIsHome ? `${siteConfig.appUrl}/` : siteConfig.url },
  openGraph: {
    title: STORIES_TITLE,
    description: STORIES_DESCRIPTION,
    url: storiesIsHome ? siteConfig.appUrl : siteConfig.url,
    siteName: siteConfig.name,
    type: 'website',
    images: [{ url: `${siteConfig.appUrl}/stories/og`, secureUrl: `${siteConfig.appUrl}/stories/og`, width: 1200, height: 630, alt: STORIES_TITLE }],
  },
  twitter: { card: 'summary_large_image', title: STORIES_TITLE, description: STORIES_DESCRIPTION, images: [`${siteConfig.appUrl}/stories/og`] },
}

export default async function Home() {
  if (storiesIsHome) return <StoriesHome />

  const storiesHref = `${siteConfig.appUrl}/stories`
  const latest = await getLatestStories().catch(() => ({ items: [], nextCursor: null }))

  return (
    <MarketingLanding
      storiesHref={storiesHref}
      storiesStrip={<MarketingStoriesStrip stories={latest.items.slice(0, 6)} appUrl={siteConfig.appUrl} storiesHref={storiesHref} />}
    />
  )
}
