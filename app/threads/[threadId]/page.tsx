import type { Metadata } from 'next'
import { cache } from 'react'
import { notFound, redirect } from 'next/navigation'
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js'
import ThreadPageClient from './ThreadPageClient'
import { buildThreadPath, extractThreadIdFromRef, isCanonicalThreadRef } from '@/lib/threads/thread-url'
import { siteConfig } from '@/lib/seo'

type PageParams = {
  threadId: string
}

type PageSearchParams = Record<string, string | string[] | undefined>

type PageProps = {
  params: Promise<PageParams>
  searchParams: Promise<PageSearchParams>
}

type ThreadSeoRow = {
  id: string
  title: string | null
  content: string | null
  category: string | null
  privacy: string | null
  created_at: string
  updated_at: string
  expires_at: string | null
  deleted_at: string | null
  creator:
    | {
        anonymous_id?: string | null
        username?: string | null
      }
    | Array<{
        anonymous_id?: string | null
        username?: string | null
      }>
    | null
}

const supabaseAdmin = createSupabaseAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

const getThreadForSeo = cache(async (threadId: string): Promise<ThreadSeoRow | null> => {
  const { data, error } = await supabaseAdmin
    .from('threads')
    .select(`
      id,
      title,
      content,
      category,
      privacy,
      created_at,
      updated_at,
      expires_at,
      deleted_at,
      creator:users!threads_creator_id_fkey(anonymous_id,username)
    `.replace(/\s+/g, ''))
    .eq('id', threadId)
    .maybeSingle<ThreadSeoRow>()

  if (error || !data) {
    return null
  }

  return data
})

const normalizeCreator = (creator: ThreadSeoRow['creator']) => {
  if (!creator) return null
  return Array.isArray(creator) ? creator[0] || null : creator
}

const threadIsExpired = (thread: ThreadSeoRow): boolean => {
  return Boolean(thread.expires_at && new Date(thread.expires_at) <= new Date())
}

const isPublicIndexableThread = (thread: ThreadSeoRow | null): boolean => {
  if (!thread) return false
  if (thread.deleted_at) return false
  if (thread.privacy !== 'public') return false
  if (threadIsExpired(thread)) return false
  return true
}

const buildThreadDescription = (thread: ThreadSeoRow): string => {
  const content = (thread.content || '').trim()
  if (!content) return 'Join this public discussion on WhisprSpace.'
  if (content.length <= 160) return content
  return `${content.slice(0, 157)}...`
}

const buildSearchString = (searchParams: PageSearchParams): string => {
  const entries: [string, string][] = []

  for (const [key, rawValue] of Object.entries(searchParams || {})) {
    if (typeof rawValue === 'string') {
      entries.push([key, rawValue])
      continue
    }
    if (Array.isArray(rawValue)) {
      rawValue.forEach((value) => entries.push([key, value]))
    }
  }

  const query = new URLSearchParams(entries).toString()
  return query ? `?${query}` : ''
}

export async function generateMetadata({ params }: { params: Promise<PageParams> }): Promise<Metadata> {
  const { threadId: threadRef } = await params
  const threadId = extractThreadIdFromRef(threadRef)

  if (!threadId) {
    return {
      title: 'Discussion Not Found | WhisprSpace',
      robots: { index: false, follow: false },
    }
  }

  const thread = await getThreadForSeo(threadId)
  if (!thread) {
    return {
      title: 'Discussion Not Found | WhisprSpace',
      robots: { index: false, follow: false },
    }
  }

  const canonicalPath = buildThreadPath({ id: thread.id, title: thread.title || undefined })
  const canonicalUrl = new URL(canonicalPath, siteConfig.url).toString()
  const title = thread.title?.trim() || 'Untitled Discussion'
  const description = buildThreadDescription(thread)
  const isIndexable = siteConfig.indexingEnabled && isPublicIndexableThread(thread)

  return {
    title: `${title} | WhisprSpace`,
    description,
    metadataBase: new URL(siteConfig.url),
    alternates: { canonical: canonicalPath },
    robots: isIndexable
      ? { index: true, follow: true }
      : { index: false, follow: false, nocache: true },
    openGraph: {
      type: 'article',
      url: canonicalUrl,
      title,
      description,
      siteName: 'WhisprSpace',
      publishedTime: thread.created_at,
      modifiedTime: thread.updated_at,
      images: [
        {
          url: `${siteConfig.appUrl}/threads/${thread.id}/og`,
          secureUrl: `${siteConfig.appUrl}/threads/${thread.id}/og`,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      site: siteConfig.twitterHandle,
      creator: siteConfig.twitterHandle,
      images: [`${siteConfig.appUrl}/threads/${thread.id}/og`],
    },
    keywords: [
      'anonymous discussion',
      'public discussion',
      'whisprspace',
      thread.category || 'general',
    ],
  }
}

export default async function ThreadPage({ params, searchParams }: PageProps) {
  const { threadId: threadRef } = await params
  const resolvedSearchParams = await searchParams
  const threadId = extractThreadIdFromRef(threadRef)

  if (!threadId) {
    notFound()
  }

  const thread = await getThreadForSeo(threadId)
  if (!thread) {
    notFound()
  }

  const isIndexable = siteConfig.indexingEnabled && isPublicIndexableThread(thread)
  const canonicalPath = buildThreadPath({ id: thread.id, title: thread.title || undefined })

  if (isIndexable && !isCanonicalThreadRef(threadRef, { id: thread.id, title: thread.title || undefined })) {
    redirect(`${canonicalPath}${buildSearchString(resolvedSearchParams)}`)
  }

  const creator = normalizeCreator(thread.creator)
  const schemaOrg = isIndexable
    ? {
        '@context': 'https://schema.org',
        '@type': 'DiscussionForumPosting',
        headline: thread.title || 'Untitled Discussion',
        text: thread.content || '',
        datePublished: thread.created_at,
        dateModified: thread.updated_at,
        url: new URL(canonicalPath, siteConfig.url).toString(),
        author: {
          '@type': 'Person',
          name: creator?.anonymous_id || 'Anonymous',
        },
      }
    : null

  return (
    <>
      {schemaOrg ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaOrg) }}
        />
      ) : null}
      {isIndexable ? (
        <noscript>
          <article>
            <h1>{thread.title || 'Untitled Discussion'}</h1>
            <p>{thread.content || ''}</p>
          </article>
        </noscript>
      ) : null}
      <ThreadPageClient />
    </>
  )
}
