'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Check, Crown, Loader2, ShieldCheck } from 'lucide-react'
import { useUserStore } from '@/store/userStore'
import PremiumPaymentForm from '@/components/features/premium/PremiumPaymentForm'
import { StoriesApiError, authRedirectPath, storiesApi } from '@/lib/stories/api-client'
import { STORIES_FEED_PATH } from '@/lib/stories/config'
import { buildStoryPath } from '@/lib/stories/story-url'
import {
  CATEGORY_META,
  FAMILY_LABELS,
  STORY_FAMILIES,
  STORY_LIMITS,
  categoriesForFamily,
  resolveIsEpisodic,
  storyRequiresAccount,
  type SeriesLimitState,
  type StoryCategory,
} from '@/lib/stories/types'
import AccountRequiredSheet from './AccountRequiredSheet'
import StoryExport from './StoryExport'
import StoryShareButton from './StoryShareButton'

type Step = 'category' | 'write' | 'consent' | 'done'

interface Draft {
  step: Step
  category: StoryCategory | null
  featureConsent: boolean
  title: string
  body: string
  isEpisodic: boolean
  cadence: string
}

interface CreatedStory {
  id: string
  title: string
  category: StoryCategory
  path: string
  hasAccount: boolean
}

const DRAFT_KEY = 'whs_story_draft'
const EMPTY_DRAFT: Draft = {
  step: 'category',
  category: null,
  featureConsent: false,
  title: '',
  body: '',
  isEpisodic: false,
  cadence: '',
}

const input = 'w-full rounded-xl border border-[#2A2A38] bg-[#0A0A10] px-3.5 text-[#F2F2F6] placeholder:text-[#5C5C6E] focus:border-[#8B5CF6]/60 focus:outline-none'

function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (value: boolean) => void; label: string; hint?: string }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="flex w-full items-start gap-3 rounded-xl border border-[#23232E] p-3 text-left">
      <span className={`mt-0.5 flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors ${checked ? 'bg-[#8B5CF6]' : 'bg-[#2A2A38]'}`}>
        <span className={`h-4 w-4 rounded-full bg-white transition-transform ${checked ? 'translate-x-4' : ''}`} />
      </span>
      <span>
        <span className="block text-sm text-[#F2F2F6]">{label}</span>
        {hint && <span className="mt-0.5 block text-xs leading-5 text-[#8F8FA3]">{hint}</span>}
      </span>
    </button>
  )
}

export default function StoryComposer() {
  const session = useUserStore((state) => state.session)
  const sessionValidated = useUserStore((state) => state.sessionValidated)
  const isRegistered = Boolean(sessionValidated && session.isAuthenticated && session.user && !session.user.isAnonymous)
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT)
  const [hydrated, setHydrated] = useState(false)
  const [needsAccount, setNeedsAccount] = useState(false)
  const [submitting, setSubmitting] = useState<'agree' | 'decline' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<CreatedStory | null>(null)
  const [submittedBody, setSubmittedBody] = useState('')
  const [checking, setChecking] = useState(false)
  const [limitState, setLimitState] = useState<SeriesLimitState | null>(null)
  const [showPremium, setShowPremium] = useState(false)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [confirmReset, setConfirmReset] = useState(false)
  const draftRef = useRef(draft)
  const saveTimerRef = useRef<number | null>(null)
  draftRef.current = draft

  useEffect(() => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY)
      if (saved) {
        const parsed = { ...EMPTY_DRAFT, ...(JSON.parse(saved) as Partial<Draft>) }
        setDraft({ ...parsed, step: !parsed.category ? 'category' : parsed.step === 'done' || parsed.step === 'consent' ? 'write' : parsed.step })
      }
    } catch {}
    setHydrated(true)
  }, [])

  const persistDraft = useCallback(() => {
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }
    const current = draftRef.current
    if (current.step === 'done') return
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(current))
      setSaveState('saved')
    } catch {
      setSaveState('idle')
    }
  }, [])

  useEffect(() => {
    if (!hydrated || draft.step === 'done') return
    setSaveState('saving')
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current)
    saveTimerRef.current = window.setTimeout(persistDraft, 500)
  }, [draft, hydrated, persistDraft])

  useEffect(() => {
    if (!hydrated) return
    const flush = () => persistDraft()
    const onVisibility = () => { if (document.visibilityState === 'hidden') persistDraft() }
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', onVisibility)
      persistDraft()
    }
  }, [hydrated, persistDraft])

  const startOver = () => {
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current)
    localStorage.removeItem(DRAFT_KEY)
    setDraft(EMPTY_DRAFT)
    setError(null)
    setConfirmReset(false)
    setSaveState('idle')
  }

  const update = (patch: Partial<Draft>) => setDraft((current) => ({ ...current, ...patch }))
  const meta = draft.category ? CATEGORY_META[draft.category] : null
  const requiresAccount = draft.category ? storyRequiresAccount(draft.category, draft.isEpisodic) : false

  const chooseCategory = (category: StoryCategory) => {
    const isEpisodic = resolveIsEpisodic(category, false)
    update({ category, isEpisodic, step: 'write' })
    if (sessionValidated && !isRegistered && storyRequiresAccount(category, isEpisodic)) setNeedsAccount(true)
  }

  const loadLimits = useCallback(async () => {
    try {
      setLimitState(await storiesApi<SeriesLimitState>('/api/stories/limits'))
    } catch {
      setLimitState(null)
    }
  }, [])

  const wantsSeries = draft.step === 'write' && draft.isEpisodic
  useEffect(() => {
    if (isRegistered && wantsSeries) void loadLimits()
  }, [isRegistered, wantsSeries, loadLimits])

  const limitReached = Boolean(
    draft.isEpisodic && limitState && limitState.limit !== null && limitState.ongoing.length >= limitState.limit
  )

  const setEpisodic = (value: boolean) => {
    update({ isEpisodic: value })
    if (value && sessionValidated && !isRegistered) setNeedsAccount(true)
  }

  const titleLength = draft.title.trim().length
  const bodyLength = draft.body.trim().length
  const canSubmit = useMemo(
    () =>
      Boolean(draft.category) &&
      titleLength >= STORY_LIMITS.titleMin &&
      titleLength <= STORY_LIMITS.titleMax &&
      bodyLength >= STORY_LIMITS.bodyMin &&
      bodyLength <= STORY_LIMITS.bodyMax &&
      (!requiresAccount || isRegistered) &&
      !limitReached,
    [draft.category, titleLength, bodyLength, requiresAccount, isRegistered, limitReached]
  )

  const buildPayload = (featureConsent: boolean) => ({
    category: draft.category,
    title: draft.title.trim(),
    body: draft.body.trim(),
    isEpisodic: draft.isEpisodic,
    cadence: draft.cadence.trim(),
    featureConsent,
  })

  const handleCheckError = (cause: unknown) => {
    if (cause instanceof StoriesApiError && cause.code === 'account_required') setNeedsAccount(true)
    else if (cause instanceof StoriesApiError && cause.code === 'series_limit') setLimitState((cause.details as { limit?: SeriesLimitState })?.limit ?? null)
    else setError(cause instanceof Error ? cause.message : 'Something went wrong. Please try again.')
  }

  const goToConsent = async () => {
    if (!canSubmit || submitting || checking) return
    if (requiresAccount && !isRegistered) {
      setNeedsAccount(true)
      return
    }
    setError(null)
    setChecking(true)
    try {
      await storiesApi('/api/stories', { method: 'POST', body: JSON.stringify({ ...buildPayload(false), validateOnly: true }) })
      persistDraft()
      update({ step: 'consent' })
    } catch (cause) {
      handleCheckError(cause)
    } finally {
      setChecking(false)
    }
  }

  const submit = async (featureConsent: boolean) => {
    if (!canSubmit || submitting || !draft.category) return
    update({ featureConsent })
    setSubmitting(featureConsent ? 'agree' : 'decline')
    setError(null)
    try {
      const { story } = await storiesApi<{ story: CreatedStory }>('/api/stories', {
        method: 'POST',
        body: JSON.stringify(buildPayload(featureConsent)),
      })
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current)
      setSubmittedBody(draft.body.trim())
      setCreated(story)
      localStorage.removeItem(DRAFT_KEY)
      update({ step: 'done' })
      import('posthog-js').then(({ default: posthog }) => posthog.capture('story_submitted', { category: story.category, episodic: draft.isEpisodic, feature_consent: featureConsent, has_account: story.hasAccount })).catch(() => {})
    } catch (cause) {
      if (cause instanceof StoriesApiError && cause.code === 'account_required') {
        update({ step: 'write' })
        handleCheckError(cause)
      } else {
        setError(cause instanceof Error ? cause.message : 'We couldn’t share your story. Your draft is safe, please try again.')
      }
    } finally {
      setSubmitting(null)
    }
  }

  if (!hydrated) return <div className="min-h-screen bg-[#0A0A10]" />

  return (
    <div className="min-h-screen bg-[#0A0A10] text-[#F2F2F6]">
      <div className="mx-auto w-full max-w-xl px-4 pb-16 pt-5">
        <div className="flex items-center justify-between">
          {draft.step === 'category' || draft.step === 'done' ? (
            <Link href={STORIES_FEED_PATH} prefetch={false} className="inline-flex items-center gap-1 text-xs text-[#8F8FA3] hover:text-[#F2F2F6]">
              <ArrowLeft className="h-3.5 w-3.5" /> Stories
            </Link>
          ) : (
            <button onClick={() => { if (!submitting) update({ step: draft.step === 'consent' ? 'write' : 'category' }) }} className="inline-flex items-center gap-1 text-xs text-[#8F8FA3] hover:text-[#F2F2F6]">
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </button>
          )}
          {draft.step !== 'done' && (
            <span className="flex items-center gap-3 text-[11px] text-[#5C5C6E]">
              {draft.step === 'write' && saveState !== 'idle' && (
                <span className={saveState === 'saved' ? 'text-[#5DCAA5]' : ''}>{saveState === 'saved' ? 'Draft saved' : 'Saving…'}</span>
              )}
              <span>Step {draft.step === 'category' ? 1 : draft.step === 'write' ? 2 : 3} of 3</span>
            </span>
          )}
        </div>

        {draft.step === 'category' && (
          <section className="mt-6">
            <h1 className="text-2xl font-semibold tracking-[-0.4px]">Tell your story</h1>
            <p className="mt-2 text-sm leading-6 text-[#8F8FA3]">Shared anonymously. Readers can relate, react, and comment.</p>
            {STORY_FAMILIES.map((family) => (
              <div key={family} className="mt-7">
                <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#5C5C6E]">{FAMILY_LABELS[family]}</h2>
                <div className="mt-2.5 space-y-2">
                  {categoriesForFamily(family).map((category) => (
                    <button
                      key={category}
                      onClick={() => chooseCategory(category)}
                      className="w-full rounded-2xl border border-[#23232E] bg-[#12121A] p-4 text-left transition-colors hover:border-[#8B5CF6]/45"
                    >
                      <span className="block text-[15px] font-medium">{CATEGORY_META[category].label}</span>
                      <span className="mt-1 block text-sm leading-5 text-[#8F8FA3]">{CATEGORY_META[category].description}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </section>
        )}

        {draft.step === 'write' && meta && draft.category && (
          <section className="mt-6 space-y-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#F97316]">{meta.tag} · {meta.label}</p>
              <p className="mt-2 text-sm leading-6 text-[#8F8FA3]">Shared anonymously. Readers can relate, react, and comment.</p>
            </div>

            <div>
              <input
                value={draft.title}
                onChange={(event) => update({ title: event.target.value.slice(0, STORY_LIMITS.titleMax) })}
                placeholder="Give it a title"
                className={`${input} h-12 text-base`}
              />
              <p className="mt-1 text-right text-[11px] text-[#5C5C6E]">{titleLength}/{STORY_LIMITS.titleMax}</p>
            </div>

            <div>
              <textarea
                value={draft.body}
                onChange={(event) => update({ body: event.target.value.slice(0, STORY_LIMITS.bodyMax) })}
                placeholder={meta.family === 'true_story' ? 'What happened? Take your time.' : draft.category === 'poetry' ? 'Your poem…' : 'Once upon a time…'}
                rows={12}
                className={`${input} resize-y py-3 text-[15px] leading-7`}
              />
              <p className="mt-1 text-right text-[11px] text-[#5C5C6E]">{bodyLength.toLocaleString()}/{STORY_LIMITS.bodyMax.toLocaleString()}</p>
            </div>

            {meta.episodic && draft.category !== 'live_story' && (
              <Toggle
                checked={draft.isEpisodic}
                onChange={setEpisodic}
                label="Tell it in episodes"
                hint="Come back and add new parts over time. Readers can follow to hear when a new episode is out."
              />
            )}
            {draft.isEpisodic && (
              <input
                value={draft.cadence}
                onChange={(event) => update({ cadence: event.target.value.slice(0, STORY_LIMITS.cadenceMax) })}
                placeholder="When do you plan to post? e.g. on Fridays (optional)"
                className={`${input} h-11 text-sm`}
              />
            )}

            {requiresAccount && sessionValidated && !isRegistered && (
              <p className="rounded-xl border border-[#8B5CF6]/30 bg-[#8B5CF6]/[0.07] px-3 py-2.5 text-xs leading-5 text-[#C4B5FD]">
                Stories you come back to need an account. Your draft is saved.{' '}
                <button className="underline" onClick={() => setNeedsAccount(true)}>Create one</button>
              </p>
            )}
            {limitReached && limitState && (
              <div className="rounded-2xl border border-[#8B5CF6]/35 bg-[#8B5CF6]/[0.07] p-4">
                <p className="text-sm font-medium text-[#F2F2F6]">You have {limitState.ongoing.length} ongoing stories</p>
                <p className="mt-1 text-xs leading-5 text-[#B9B9C6]">
                  Free accounts can keep {limitState.limit} stories going at a time. Mark one as finished to start another, or go Premium for unlimited.
                  {draft.category === 'fiction' && ' You can also switch off episodes and share this as one piece.'}
                </p>
                <ul className="mt-3 space-y-1.5">
                  {limitState.ongoing.map((story) => (
                    <li key={story.id}>
                      <Link href={`${buildStoryPath(story)}/manage`} prefetch={false} className="text-xs text-[#C4B5FD] underline-offset-2 hover:underline">
                        {story.title}
                      </Link>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => setShowPremium(true)}
                  className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#F97316] px-4 text-sm font-medium text-white"
                >
                  <Crown className="h-4 w-4" />
                  Go Premium
                </button>
              </div>
            )}
            {error && <p className="text-sm text-[#F09595]">{error}</p>}

            <button
              onClick={goToConsent}
              disabled={!canSubmit || Boolean(submitting) || checking}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#F97316] text-sm font-medium text-white disabled:opacity-40"
            >
              {checking && <Loader2 className="h-4 w-4 animate-spin" />}
              {checking ? 'Posting your story…' : 'Share my story'}
            </button>
            <div className="text-center">
              {confirmReset ? (
                <p className="text-xs text-[#8F8FA3]">
                  Delete this draft?{' '}
                  <button onClick={startOver} className="text-[#F09595] underline">Yes, start over</button>{' '}
                  <button onClick={() => setConfirmReset(false)} className="underline">Keep it</button>
                </p>
              ) : (
                <button onClick={() => setConfirmReset(true)} className="text-xs text-[#5C5C6E] hover:text-[#8F8FA3]">
                  Start over
                </button>
              )}
            </div>
          </section>
        )}

        {draft.step === 'consent' && meta && (
          <section className="mt-10 text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#8B5CF6]/25 to-[#F97316]/25">
              <ShieldCheck className="h-6 w-6 text-[#C4B5FD]" />
            </span>
            <h1 className="mt-5 text-xl font-semibold">WhisprSpace may share this on her socials</h1>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[#8F8FA3]">
              If your story is picked, we may feature it on our Instagram, TikTok or X, anonymously, with no name attached. It always appears in the WhisprSpace feed either way.
            </p>
            <button
              onClick={() => submit(true)}
              disabled={Boolean(submitting)}
              className="mt-8 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#F97316] text-sm font-medium text-white active:scale-[0.98] disabled:opacity-60"
            >
              {submitting === 'agree' && <Loader2 className="h-4 w-4 animate-spin" />}
              I agree & share my story
            </button>
            <button
              onClick={() => submit(false)}
              disabled={Boolean(submitting)}
              className="mt-4 inline-flex items-center gap-2 text-sm text-[#8F8FA3] underline-offset-4 hover:text-[#F2F2F6] hover:underline disabled:opacity-60"
            >
              {submitting === 'decline' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Share without featuring
            </button>
            {error && <p className="mt-4 text-sm text-[#F09595]">{error}</p>}
          </section>
        )}


        {draft.step === 'done' && created && (
          <section className="mt-8">
            <div className="text-center">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#5DCAA5]/15">
                <Check className="h-7 w-7 text-[#5DCAA5]" />
              </span>
              <h1 className="mt-5 text-2xl font-semibold">Your story is live</h1>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[#8F8FA3]">
                People can now read it and join the conversation, and no one knows it was you.
              </p>
              <div className="mx-auto mt-6 max-w-sm space-y-2">
                <StoryShareButton story={created} variant="primary" label="Share your story link" />
                <Link href={created.path} prefetch={false} className="flex h-11 w-full items-center justify-center rounded-xl border border-[#2A2A38] text-sm text-[#F2F2F6] hover:border-[#8B5CF6]/50">
                  View your story
                </Link>
              </div>
            </div>
            <div className="mt-8 rounded-2xl border border-[#23232E] bg-[#12121A] p-5">
              {!created.hasAccount && (
                <div className="mb-5 rounded-xl border border-[#8B5CF6]/35 bg-gradient-to-br from-[#8B5CF6]/[0.12] to-[#F97316]/[0.08] p-4">
                  <p className="text-sm font-medium text-[#F2F2F6]">Don&apos;t lose this story</p>
                  <p className="mt-1 text-xs leading-5 text-[#B9B9C6]">
                    Create an account and it&apos;s saved to your page. See every reply, download your slides any time, and still stay anonymous.
                  </p>
                  <Link
                    href={authRedirectPath('signup', `${created.path}/manage?claim=1`)}
                    prefetch={false}
                    onClick={() => { import('posthog-js').then(({ default: posthog }) => posthog.capture('story_claim_prompt_clicked', { story_id: created.id })).catch(() => {}) }}
                    className="mt-3 flex h-11 w-full items-center justify-center rounded-xl bg-white text-sm font-semibold text-[#0A0A10] active:scale-[0.98]"
                  >
                    Save my story
                  </Link>
                </div>
              )}
              <h2 className="text-base font-medium">Share it on your own pages</h2>
              <p className="mt-1 text-sm leading-6 text-[#8F8FA3]">
                {created.hasAccount
                  ? 'Download ready-to-post slides now, or any time later from your story page.'
                  : 'Download ready-to-post slides now, or save your story above to get them any time.'}
              </p>
              <div className="mt-4">
                <StoryExport
                  compact
                  storyId={created.id}
                  title={created.title}
                  category={created.category}
                  family={CATEGORY_META[created.category].family}
                  episodes={[{ number: 1, body: submittedBody }]}
                  isPremium={Boolean(session.user?.isPremium)}
                />
              </div>
            </div>
            <button onClick={() => { setCreated(null); setDraft(EMPTY_DRAFT) }} className="mt-6 w-full text-center text-sm text-[#8F8FA3] hover:text-[#F2F2F6]">
              Tell another story
            </button>
          </section>
        )}
      </div>
      {needsAccount && <AccountRequiredSheet reason="tell" returnTo="/stories/new" onClose={() => setNeedsAccount(false)} />}
      {showPremium && (
        <PremiumPaymentForm
          onSuccess={() => { setShowPremium(false); void loadLimits() }}
          onCancel={() => setShowPremium(false)}
        />
      )}
    </div>
  )
}
