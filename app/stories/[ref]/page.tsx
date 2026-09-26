import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, permanentRedirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import RelativeTime from '@/components/features/stories/RelativeTime'
import SensitiveGate from '@/components/features/stories/SensitiveGate'
import StoriesTopBar from '@/components/features/stories/StoriesTopBar'
import StoryActions from '@/components/features/stories/StoryActions'
import StoryComments from '@/components/features/stories/StoryComments'
import { StoryReactionBar } from '@/components/features/stories/StoryReactions'
import StoryTags from '@/components/features/stories/StoryTags'
import { StoryViewerProvider } from '@/components/features/stories/StoryViewerContext'
import { STORIES_FEED_PATH } from '@/lib/stories/config'
import { getStoryPage } from '@/lib/stories/server'
import { buildStoryPath, extractStoryIdFromRef, isCanonicalStoryRef } from '@/lib/stories/story-url'
import { CATEGORY_META, FAMILY_LABELS, type StoryPageData } from '@/lib/stories/types'
import { siteConfig } from '@/lib/seo'

export const revalidate = 600
export const dynamicParams = true

export function generateStaticParams() {
  return []
}

type PageProps = { params: Promise<{ ref: string }> }

async function loadStory(ref: string): Promise<StoryPageData | null> {
  const id = extractStoryIdFromRef(ref)
  if (!id) return null
  return getStoryPage(id).catch(() => null)
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { ref } = await params
  const story = await loadStory(ref)
  if (!story) return { title: 'Story not found | WhisprSpace', robots: { index: false, follow: false } }

  const path = buildStoryPath(story)
  const url = `${siteConfig.appUrl}${path}`
  const meta = CATEGORY_META[story.category]
  const description = story.is_sensitive
    ? `A ${meta.label.toLowerCase()} story shared anonymously on WhisprSpace. Contains sensitive themes.`
    : story.excerpt.length > 157 ? `${story.excerpt.slice(0, 157)}…` : story.excerpt
  const ogImage = `${siteConfig.appUrl}/stories/${story.id}/og?v=${story.episode_count}`
  const title = `${story.title} · ${meta.tag === 'TRUE STORY' ? 'True story' : meta.label}`

  return {
    title: `${title} | WhisprSpace`,
    description,
    alternates: { canonical: url },
    robots: siteConfig.indexingEnabled ? { index: true, follow: true } : { index: false, follow: true },
    openGraph: {
      type: 'article',
      url,
      title,
      description,
      siteName: siteConfig.name,
      publishedTime: story.created_at,
      modifiedTime: story.last_episode_at,
      images: [{ url: ogImage, secureUrl: ogImage, type: 'image/png', width: 1200, height: 630, alt: story.title }],
    },
    twitter: { card: 'summary_large_image', title, description, images: [ogImage] },
  }
}

export default async function StoryPage({ params }: PageProps) {
  const { ref } = await params
  const story = await loadStory(ref)
  if (!story) notFound()

  const path = buildStoryPath(story)
  if (!isCanonicalStoryRef(ref, story)) permanentRedirect(path)

  const meta = CATEGORY_META[story.category]
  const canFollow = story.is_episodic && story.status === 'ongoing'
  const multi = story.is_episodic || story.episodes.length > 1
  const schema = {
    '@context': 'https://schema.org',
    '@type': story.family === 'true_story' ? 'Article' : 'CreativeWork',
    headline: story.title,
    genre: `${FAMILY_LABELS[story.family]} · ${meta.label}`,
    datePublished: story.created_at,
    dateModified: story.last_episode_at,
    url: `${siteConfig.appUrl}${path}`,
    author: { '@type': 'Person', name: 'Anonymous' },
    publisher: { '@type': 'Organization', name: siteConfig.name },
    commentCount: story.reply_count,
  }

  const body = (
    <div className="space-y-8">
      {story.episodes.map((episode) => (
        <article key={episode.number} id={`episode-${episode.number}`} className="[content-visibility:auto] [contain-intrinsic-size:auto_600px]">
          {multi && (
            <header className="mb-3 flex items-center gap-2 text-[11px] uppercase tracking-[0.12em] text-[#F97316]">
              Episode {episode.number}
              <span className="normal-case tracking-normal text-[#5C5C6E]">
                · <RelativeTime iso={episode.published_at} />
              </span>
            </header>
          )}
          <div className="whitespace-pre-wrap break-words text-[16px] leading-[1.8] text-[#E6E6EC]">{episode.body}</div>
          {episode.edited_at && <p className="mt-2 text-[11px] text-[#5C5C6E]">Edited</p>}
        </article>
      ))}
    </div>
  )

  return (
    <div className="min-h-screen bg-[#0A0A10] text-[#F2F2F6] lg:flex lg:h-[100dvh] lg:min-h-0 lg:flex-col lg:overflow-hidden">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, '\\u003c') }} />
      <div className="mx-auto w-full max-w-2xl md:border-x md:border-[#1C1C26] lg:flex lg:min-h-0 lg:max-w-6xl lg:flex-1 lg:flex-col">
        <StoriesTopBar />
        <StoryViewerProvider storyId={story.id} initialReactionCounts={story.reaction_counts} replyCount={story.reply_count}>
          <div className="lg:grid lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1fr)_minmax(360px,420px)]">
          <div className="px-4 pb-28 pt-5 md:px-5 scrollbar-hide lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain lg:px-8 lg:pb-12">
            <Link href={STORIES_FEED_PATH} prefetch={false} className="inline-flex items-center gap-1 text-xs text-[#8F8FA3] hover:text-[#F2F2F6]">
              <ArrowLeft className="h-3.5 w-3.5" />
              All stories
            </Link>
            <div className="mt-4">
              <StoryTags story={story} size="md" />
            </div>
            <h1 className="mt-3 text-[26px] font-semibold leading-tight tracking-[-0.5px] md:text-3xl">{story.title}</h1>
            <p className="mt-2 flex flex-wrap items-center gap-x-2 text-xs text-[#5C5C6E]">
              <span>Shared anonymously</span>
              <span>·</span>
              {story.is_episodic ? (
                <RelativeTime iso={story.last_episode_at} prefix="Last episode " />
              ) : (
                <RelativeTime iso={story.created_at} />
              )}
              {story.is_episodic && story.cadence_label && story.status === 'ongoing' && (
                <>
                  <span>·</span>
                  <span className="text-[#8F8FA3]">Usually posts {story.cadence_label}</span>
                </>
              )}
            </p>
            <div className="mt-5">
              <StoryActions
                storyId={story.id}
                title={story.title}
                category={story.category}
                path={path}
                canFollow={canFollow}
              />
            </div>
            <div className="mt-7">{story.is_sensitive ? <SensitiveGate>{body}</SensitiveGate> : body}</div>
            {story.is_episodic && story.status === 'finished' && (
              <p className="mt-8 rounded-xl border border-[#23232E] px-4 py-3 text-center text-xs text-[#8F8FA3]">The storyteller has marked this story as finished.</p>
            )}
            <div className="mt-8">
              <StoryReactionBar />
            </div>
          </div>
          <StoryComments
            storyId={story.id}
            threadId={story.thread_id}
            replyCount={story.reply_count}
            isEpisodic={story.is_episodic}
            episodes={story.episodes.map(({ number, published_at }) => ({ number, published_at }))}
          />
          </div>
        </StoryViewerProvider>
      </div>
    </div>
  )
}
