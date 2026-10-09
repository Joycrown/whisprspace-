import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import AskViewBeacon from '@/components/features/prompts/AskViewBeacon'
import AskViewCount from '@/components/features/prompts/AskViewCount'
import PromptDrop from '@/components/features/prompts/PromptDrop'
import PublicAskResponses from '@/components/features/prompts/PublicAskResponses'
import { siteConfig } from '@/lib/seo'
import { describeWindow, getPublicAskWindowHours } from '@/lib/prompts/config'
import { getPublicAsk, getPublicAskResponses, isAskClosed } from '@/lib/prompts/public'
import type { PublicAsk, PublicAskResponsesPage } from '@/lib/prompts/public-types'
import { buildPromptPath, extractPromptIdFromRef, isCanonicalPromptRef } from '@/lib/prompts/prompt-url'

export const dynamic = 'force-dynamic'

interface PromptPageProps {
  params: Promise<{ id: string }>
}

const CREATE_ASK_HREF = '/auth?force=1&view=signup&reason=prompt&redirect=%2Fcuriosity-ask%2Fcreate'

async function loadAsk(ref: string): Promise<PublicAsk | null> {
  const askId = extractPromptIdFromRef(ref)
  if (!askId) return null
  try {
    const ask = await getPublicAsk(askId)
    return ask && !ask.deleted_at ? ask : null
  } catch (error) {
    console.error('[CuriosityAsk] Failed to load ask:', error instanceof Error ? error.message : error)
    return null
  }
}

const isIndexableAsk = (ask: PublicAsk) => ask.is_official && !isAskClosed(ask)

export async function generateMetadata({ params }: PromptPageProps): Promise<Metadata> {
  const { id } = await params
  const ask = await loadAsk(id)
  if (!ask) return { title: 'Ask not found', robots: { index: false, follow: false } }

  const canonicalPath = buildPromptPath({ id: ask.id, question: ask.question })
  const url = `${siteConfig.appUrl}${canonicalPath}`
  const description = ask.mode === 'open'
    ? 'Answer anonymously and see what everyone else said on WhisprSpace.'
    : 'Answer anonymously on WhisprSpace. No name. No trace.'
  const ogImageUrl = `${siteConfig.appUrl}/curiosity-ask/${ask.id}/og`
  const isIndexable = siteConfig.indexingEnabled && isIndexableAsk(ask)

  return {
    title: ask.question,
    description,
    alternates: { canonical: canonicalPath },
    robots: isIndexable
      ? { index: true, follow: true }
      : { index: false, follow: true, googleBot: { index: false, follow: true, noimageindex: false } },
    openGraph: {
      title: ask.question,
      description,
      url,
      siteName: siteConfig.name,
      type: 'website',
      images: [{ url: ogImageUrl, secureUrl: ogImageUrl, type: 'image/png', width: 1200, height: 630, alt: ask.question }],
    },
    twitter: { card: 'summary_large_image', title: ask.question, description, images: [ogImageUrl] },
  }
}

export default async function PromptPage({ params }: PromptPageProps) {
  const { id } = await params
  const ask = await loadAsk(id)
  if (!ask) notFound()

  if (!isCanonicalPromptRef(id, { id: ask.id, question: ask.question })) {
    redirect(buildPromptPath({ id: ask.id, question: ask.question }))
  }

  const closed = isAskClosed(ask)
  const isPublic = ask.mode === 'open'
  const options = Array.isArray(ask.options) ? ask.options : null

  let firstPage: PublicAskResponsesPage = { items: [], nextCursor: null }
  if (isPublic) {
    try {
      firstPage = await getPublicAskResponses(ask.id, 'latest', null)
    } catch (error) {
      console.error('[CuriosityAsk] Failed to load public answers:', error instanceof Error ? error.message : error)
    }
  }
  const windowLabel = isPublic && ask.expires_at ? describeWindow(await getPublicAskWindowHours()) : null

  return (
    <main className={`relative flex min-h-screen justify-center overflow-hidden bg-[#0A0A10] px-4 py-12 ${isPublic ? 'items-start' : 'items-center'}`}>
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(ellipse 60% 45% at 50% 0%, rgba(139,92,246,0.14), transparent 70%)' }} />
      <AskViewBeacon askId={ask.id} />
      <div className="relative w-full space-y-8">
        {closed ? (
          <div className="mx-auto w-full max-w-lg rounded-2xl border border-[#23232E] bg-[#12121A] p-6 text-center md:p-8">
            <div className="flex items-center justify-center gap-3 text-xs">
              <p className="font-medium uppercase tracking-[0.18em] text-[#C4B5FD]">This ask has closed</p>
              <AskViewCount count={ask.view_count} className="text-[#8F8FA3]" />
            </div>
            <h1 className="mt-3 text-2xl font-medium leading-snug tracking-tight text-[#F2F2F6]">{ask.question}</h1>
            <p className="mt-3 text-sm text-[#8F8FA3]">
              {isPublic ? 'It’s no longer taking answers. Here’s what people said.' : 'The answers are private to its creator.'}
            </p>
            <Link
              href={CREATE_ASK_HREF}
              prefetch={false}
              className="mt-6 flex h-12 w-full items-center justify-center rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#F97316] text-sm font-medium text-white"
            >
              Create your own curiosity ask
            </Link>
          </div>
        ) : (
          <PromptDrop
            promptId={ask.id}
            question={ask.question}
            expiresAt={ask.expires_at}
            responseFormat={ask.response_format}
            options={options}
            isPublic={isPublic}
            windowLabel={windowLabel}
            viewCount={ask.view_count}
          />
        )}

        {isPublic && (
          <PublicAskResponses
            key={ask.response_count}
            askId={ask.id}
            responseFormat={ask.response_format}
            options={options}
            tally={ask.tally}
            correctOptionIndex={ask.correct_option_index}
            closed={closed}
            initialPage={firstPage}
          />
        )}
      </div>
    </main>
  )
}
