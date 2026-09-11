import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import PromptDrop from '@/components/features/prompts/PromptDrop'
import { supabaseAdmin } from '@/lib/core/supabase/admin-client'
import { siteConfig } from '@/lib/seo'
import { buildPromptPath, extractPromptIdFromRef, isCanonicalPromptRef } from '@/lib/prompts/prompt-url'

export const dynamic = 'force-dynamic'

interface PromptPageProps {
  params: Promise<{ id: string }>
}

async function getPublicPrompt(ref: string) {
  const promptId = extractPromptIdFromRef(ref)
  if (!promptId) return null

  const { data } = await supabaseAdmin
    .from('prompts')
    .select('id, question, expires_at, deleted_at')
    .eq('id', promptId)
    .maybeSingle()

  if (!data || data.deleted_at) return null
  return data
}

const isIndexablePrompt = (prompt: { expires_at: string } | null): boolean => {
  if (!prompt) return false
  return new Date(prompt.expires_at).getTime() > Date.now()
}

export async function generateMetadata({ params }: PromptPageProps): Promise<Metadata> {
  const { id } = await params
  const prompt = await getPublicPrompt(id)
  if (!prompt) return { title: 'Ask not found', robots: { index: false, follow: false } }

  const canonicalPath = buildPromptPath({ id: prompt.id, question: prompt.question })
  const url = `${siteConfig.appUrl}${canonicalPath}`
  const description = 'Answer anonymously on WhisprSpace. No name. No trace.'
  const ogImageUrl = `${siteConfig.appUrl}/curiosity-ask/${prompt.id}/og`
  const isIndexable = siteConfig.indexingEnabled && isIndexablePrompt(prompt)

  return {
    title: prompt.question,
    description,
    alternates: { canonical: canonicalPath },
    robots: isIndexable
      ? { index: true, follow: true }
      : { index: false, follow: true, googleBot: { index: false, follow: true, noimageindex: false } },
    openGraph: {
      title: prompt.question,
      description,
      url,
      siteName: siteConfig.name,
      type: 'website',
      images: [{ url: ogImageUrl, secureUrl: ogImageUrl, type: 'image/png', width: 1200, height: 630, alt: prompt.question }],
    },
    twitter: { card: 'summary_large_image', title: prompt.question, description, images: [ogImageUrl] },
  }
}

export default async function PromptPage({ params }: PromptPageProps) {
  const { id } = await params
  const prompt = await getPublicPrompt(id)
  if (!prompt) notFound()

  // Redirect legacy/raw-UUID links (and stale slugs after a question edit) to the
  // canonical slugged URL — keeps a single indexable URL per ask for SEO, while
  // old shared links (bare UUID) still resolve via extractPromptIdFromRef above.
  if (!isCanonicalPromptRef(id, { id: prompt.id, question: prompt.question })) {
    redirect(buildPromptPath({ id: prompt.id, question: prompt.question }))
  }

  const expired = new Date(prompt.expires_at).getTime() <= Date.now()
  if (expired) {
    return <div className="min-h-screen bg-[#0A0A10] px-5 py-20 text-center text-[#F2F2F6]"><p className="text-2xl font-medium">This prompt has closed.</p><p className="mt-2 text-sm text-[#8F8FA3]">The answers are private to its creator.</p></div>
  }

  return <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0A0A10] px-4 py-12"><div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(ellipse 60% 45% at 50% 0%, rgba(139,92,246,0.14), transparent 70%)' }} /><div className="relative w-full"><PromptDrop promptId={prompt.id} question={prompt.question} expiresAt={prompt.expires_at} /></div></main>
}
