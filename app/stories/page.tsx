import type { Metadata } from 'next'
import StoriesHome from '@/components/features/stories/StoriesHome'
import { siteConfig } from '@/lib/seo'

export const revalidate = 60

const TITLE = 'Stories | WhisprSpace'
const DESCRIPTION = 'Read real experiences, regrets, fiction and poetry shared anonymously. Relate, comment, or tell your own.'

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: `${siteConfig.appUrl}/` },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: `${siteConfig.appUrl}/stories`,
    siteName: siteConfig.name,
    type: 'website',
    images: [{ url: `${siteConfig.appUrl}/stories/og`, width: 1200, height: 630, alt: TITLE }],
  },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION, images: [`${siteConfig.appUrl}/stories/og`] },
}

export default function StoriesPage() {
  return <StoriesHome />
}
