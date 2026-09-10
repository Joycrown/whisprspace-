'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Bookmark, Download, Loader2, MessageCircle, Share2, Star } from 'lucide-react'
import type { PromptCategory, PromptDetail, PromptResponse } from '@/lib/prompts/types'
import type { ThreadCategory } from '@/types'
import { promptApi } from '@/lib/prompts/api-client'
import { PROMPT_THREAD_DRAFT_KEY, type PromptThreadDraft } from '@/lib/prompts/open-floor'
import ResponsePicker from '@/components/features/prompts/ResponsePicker'
import PromptShareCard from '@/components/features/prompts/PromptShareCard'
import { useShareLink } from '@/lib/hooks/useShareLink'
import { ShareDropdown } from '@/components/features/inbox/ShareDropdown'
import { useUserStore } from '@/store/userStore'
import { useToast } from '@/components/ui/Toast'
import { buildPromptPath } from '@/lib/prompts/prompt-url'

const promptToThreadCategory: Record<PromptCategory, ThreadCategory> = {
  work: 'business',
  money: 'business',
  love: 'lifestyle',
  family: 'lifestyle',
  campus: 'education',
  general: 'general',
}

export default function ManagePromptPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const promptId = params.id
  const { session } = useUserStore()
  const { showToast } = useToast()
  const [detail, setDetail] = useState<PromptDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [changingId, setChangingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const shareButtonRef = useRef<HTMLButtonElement>(null)

  const promptUrl =
    typeof window === 'undefined'
      ? ''
      : `${window.location.origin}${buildPromptPath({ id: promptId, question: detail?.question })}`
  const {
    copied,
    showDropdown,
    dropdownPos,
    shareCardRef,
    isGeneratingCard,
    openDropdown,
    closeDropdown,
    copyLink,
    shareOnTwitter,
    shareOnFacebook,
    shareOnWhatsApp,
    shareOnLinkedIn,
    shareOnInstagram,
    shareViaEmail,
    downloadShareCard,
  } = useShareLink({
    link: promptUrl,
    shareText: detail
      ? `Answer this anonymously: "${detail.question}"`
      : 'Answer this anonymously on WhisprSpace.',
    downloadName: 'my-whisprspace-ask',
  })

  const load = useCallback(async () => {
    try {
      const result = await promptApi<{ prompt: PromptDetail }>(`/api/prompts/${promptId}`)
      setDetail(result.prompt)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load this prompt.')
    } finally { setLoading(false) }
  }, [promptId])

  useEffect(() => { load() }, [load])

  const toggle = async (response: PromptResponse) => {
    if (!detail) return
    setChangingId(response.id)
    try {
      const { response: updated } = await promptApi<{ response: PromptResponse }>(`/api/prompts/${promptId}/responses/${response.id}`, { method: 'PATCH', body: JSON.stringify({ isStarred: !response.is_starred }) })
      setDetail((current) => {
        if (!current) return current
        const responses = current.responses
          .map((item) => item.id === updated.id ? updated : item)
          .sort((a, b) => {
            if (a.is_starred !== b.is_starred) return a.is_starred ? -1 : 1
            if (a.is_starred && b.is_starred) return (a.starred_at || '').localeCompare(b.starred_at || '')
            return a.created_at.localeCompare(b.created_at)
          })
        return { ...current, responses }
      })
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to update the highlight.') } finally { setChangingId(null) }
  }

  const save = async () => {
    if (!detail || saving || detail.is_saved) return

    if (!session.user?.isPremium) {
      showToast({ type: 'warning', title: 'Premium feature', message: 'Upgrade to save this ask permanently.', duration: 7000 })
      return
    }

    setSaving(true)
    try {
      await promptApi(`/api/prompts/${promptId}`, { method: 'PATCH', body: JSON.stringify({ saved: true }) })
      setDetail((current) => current ? { ...current, is_saved: true } : current)
      showToast({ type: 'success', title: 'Ask saved', message: 'This ask will never be cleaned up.' })
    } catch (cause) {
      showToast({ type: 'error', title: 'Failed to save', message: cause instanceof Error ? cause.message : 'Could not save this ask.' })
    } finally { setSaving(false) }
  }

  const openSharePicker = () => {
    if (!shareButtonRef.current) return
    openDropdown(shareButtonRef.current.getBoundingClientRect())
  }

  const openFloor = () => {
    if (!detail || !starred.length) return
    const draft: PromptThreadDraft = {
      promptId,
      form: {
        title: detail.question,
        content: 'A curated collection of anonymous answers. Join the discussion.',
        category: promptToThreadCategory[detail.category],
        type: 'text',
        isPremium: false,
        privacy: 'public',
        tags: [],
      },
    }
    localStorage.setItem(PROMPT_THREAD_DRAFT_KEY, JSON.stringify(draft))
    router.push('/threads/create?from=prompt')
  }

  if (loading) return <div className="min-h-screen bg-[#0A0A10] text-center text-[#8F8FA3]"><Loader2 className="mx-auto mt-28 h-6 w-6 animate-spin" /></div>
  if (!detail) return <div className="min-h-screen bg-[#0A0A10] p-8 text-center text-[#F2F2F6]"><p>{error || 'Prompt not found.'}</p><button onClick={() => router.push('/inbox')} className="mt-4 text-sm text-[#C4B5FD]">Back to inbox</button></div>
  const starred = detail.responses.filter((response) => response.is_starred)

  const creatorName = session.user?.username || session.user?.anonymousId || 'me'

  return <main className="min-h-screen bg-[#0A0A10] px-4 py-8 text-[#F2F2F6]"><div className="mx-auto max-w-2xl"><Link href="/inbox" className="mb-6 inline-flex items-center gap-1 text-sm text-[#8F8FA3] hover:text-white"><ArrowLeft className="h-4 w-4" /> Inbox</Link><div className="rounded-2xl border border-[#23232E] bg-[#12121A] p-5 md:p-7"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-medium uppercase tracking-[0.17em] text-[#C4B5FD]">Private ask</p><h1 className="mt-2 text-2xl font-medium leading-snug">{detail.question}</h1></div><span className="shrink-0 rounded-full bg-[#8B5CF6]/10 px-3 py-1 text-xs text-[#C4B5FD]">{detail.response_count} answers</span></div><p className="mt-4 text-sm text-[#8F8FA3]">{new Date(detail.expires_at).getTime() > Date.now() ? `Closes ${new Date(detail.expires_at).toLocaleString()}` : detail.is_saved ? 'Closed · Saved permanently' : 'Closed'}</p><div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4"><button ref={shareButtonRef} onClick={openSharePicker} className="flex min-h-10 items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-[#2A2A38] px-2 py-2 text-xs hover:border-[#8B5CF6]/50 sm:text-sm"><Share2 className="h-4 w-4 shrink-0" />{copied ? 'Copied' : 'Share'}</button>{!detail.is_saved && <button onClick={save} disabled={saving} className={`flex min-h-10 items-center justify-center gap-2 whitespace-nowrap rounded-xl border px-2 py-2 text-xs sm:text-sm ${session.user?.isPremium ? 'border-[#5DCAA5]/30 bg-[#5DCAA5]/10 text-[#5DCAA5] hover:bg-[#5DCAA5]/20' : 'border-[#2A2A38] text-[#5C5C6E]'}`}><Bookmark className="h-4 w-4 shrink-0" />{saving ? 'Saving…' : 'Save ask'}{!session.user?.isPremium && <span className="text-[10px] text-[#EF9F27]">Premium</span>}</button>}<button onClick={openFloor} disabled={!starred.length} className="flex min-h-10 items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-[#F97316]/35 px-2 py-2 text-xs text-[#FCA46A] hover:border-[#F97316]/70 disabled:opacity-40 sm:text-sm"><MessageCircle className="h-4 w-4 shrink-0" />Open for discussion</button><Link href={`/curiosity-ask/${promptId}/export`} className={`flex min-h-10 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-2 py-2 text-xs sm:text-sm ${starred.length ? 'bg-gradient-to-r from-[#8B5CF6] to-[#F97316] text-white' : 'pointer-events-none bg-white/[0.04] text-[#5C5C6E]'}`}><Download className="h-4 w-4 shrink-0" />Export {starred.length ? `(${starred.length})` : ''}</Link></div></div>{error && <p className="mt-4 rounded-xl border border-red-400/25 bg-red-400/10 px-4 py-3 text-sm text-red-200">{error}</p>}<div className="mt-8 flex items-center justify-between"><div><h2 className="text-lg font-medium">Choose highlights</h2><p className="mt-1 text-sm text-[#8F8FA3]">Nothing is selected for you. Star the answers you want to keep, export, or open as a discussion.</p></div><Star className="h-5 w-5 text-[#FCA46A]" /></div><div className="mt-4 max-h-[60vh] overflow-y-auto pr-1"><ResponsePicker responses={detail.responses} changingId={changingId} onToggle={toggle} /></div></div>

    {showDropdown && (
      <ShareDropdown
        position={dropdownPos}
        onClose={closeDropdown}
        onCopyLink={copyLink}
        onTwitter={shareOnTwitter}
        onFacebook={shareOnFacebook}
        onWhatsApp={shareOnWhatsApp}
        onLinkedIn={shareOnLinkedIn}
        onInstagram={shareOnInstagram}
        onEmail={() => shareViaEmail('Answer this anonymously')}
        onDownloadCard={downloadShareCard}
        isGeneratingCard={isGeneratingCard}
      />
    )}

    <div className="pointer-events-none fixed -left-[2000px] top-0">
      <PromptShareCard ref={shareCardRef} question={detail.question} creatorName={creatorName} expiresAt={detail.expires_at} promptUrl={promptUrl} />
    </div>
  </main>
}
