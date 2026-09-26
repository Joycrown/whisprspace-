'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { useUserStore } from '@/store/userStore'
import { StoriesApiError, storiesApi } from '@/lib/stories/api-client'
import { STORIES_FEED_PATH } from '@/lib/stories/config'
import { buildStoryPath } from '@/lib/stories/story-url'
import { CATEGORY_META, STORY_LIMITS, type StoryCategory, type StoryEpisode, type StoryStatus } from '@/lib/stories/types'
import StoryExport from './StoryExport'
import StoryShareButton from './StoryShareButton'

interface ManagedStory {
  id: string
  title: string
  category: StoryCategory
  is_episodic: boolean
  status: StoryStatus
  is_sensitive: boolean
  feature_consent: boolean
  cadence_label: string | null
  moderation_status: 'visible' | 'hidden' | 'removed'
  episode_count: number
}

const card = 'rounded-2xl border border-[#23232E] bg-[#12121A] p-5'

export default function StoryManager({ storyId }: { storyId: string }) {
  const router = useRouter()
  const session = useUserStore((state) => state.session)
  const sessionValidated = useUserStore((state) => state.sessionValidated)
  const [story, setStory] = useState<ManagedStory | null>(null)
  const [episodes, setEpisodes] = useState<StoryEpisode[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [episodeBody, setEpisodeBodyState] = useState('')
  const episodeDraftKey = `whs_story_episode_draft:${storyId}`
  const setEpisodeBody = useCallback((value: string) => {
    setEpisodeBodyState(value)
    try {
      if (value) localStorage.setItem(episodeDraftKey, value)
      else localStorage.removeItem(episodeDraftKey)
    } catch {}
  }, [episodeDraftKey])

  useEffect(() => {
    try {
      const saved = localStorage.getItem(episodeDraftKey)
      if (saved) setEpisodeBodyState(saved)
    } catch {}
  }, [episodeDraftKey])
  const [publishing, setPublishing] = useState(false)
  const [episodeError, setEpisodeError] = useState<string | null>(null)
  const [cadence, setCadence] = useState('')
  const [saving, setSaving] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [patchError, setPatchError] = useState<string | null>(null)
  const [titleDraft, setTitleDraft] = useState('')
  const [titleError, setTitleError] = useState<string | null>(null)
  const [titleSaved, setTitleSaved] = useState(false)
  const [editingEpisode, setEditingEpisode] = useState<number | null>(null)
  const [episodeDraft, setEpisodeDraft] = useState('')
  const [episodeEditError, setEpisodeEditError] = useState<string | null>(null)
  const [savedEpisode, setSavedEpisode] = useState<number | null>(null)

  const load = useCallback(async () => {
    try {
      const data = await storiesApi<{ story: ManagedStory; episodes: StoryEpisode[] }>(`/api/stories/${storyId}`)
      setStory(data.story)
      setEpisodes(data.episodes)
      setCadence(data.story.cadence_label ?? '')
      setTitleDraft(data.story.title)
    } catch (cause) {
      setLoadError(cause instanceof StoriesApiError && cause.status === 401 ? 'Sign in to manage your story.' : 'We couldn’t find this story on your account.')
    }
  }, [storyId])

  const [justClaimed, setJustClaimed] = useState(false)

  useEffect(() => {
    if (!sessionValidated) return
    const wantsClaim = new URLSearchParams(window.location.search).get('claim') === '1'
    const isRegistered = Boolean(session.isAuthenticated && session.user && !session.user.isAnonymous)
    if (!wantsClaim || !isRegistered) {
      void load()
      return
    }
    storiesApi(`/api/stories/${storyId}/claim`, { method: 'POST' })
      .then(() => {
        setJustClaimed(true)
        import('posthog-js').then(({ default: posthog }) => posthog.capture('story_claimed', { story_id: storyId })).catch(() => {})
      })
      .catch(() => {})
      .finally(() => {
        router.replace(window.location.pathname)
        void load()
      })
  }, [sessionValidated, session.user?.id, session.isAuthenticated, session.user?.isAnonymous, storyId, load, router])

  const patch = async (key: string, body: Record<string, unknown>, apply: Partial<ManagedStory>) => {
    setSaving(key)
    setPatchError(null)
    try {
      await storiesApi(`/api/stories/${storyId}`, { method: 'PATCH', body: JSON.stringify(body) })
      setStory((current) => (current ? { ...current, ...apply } : current))
    } catch (cause) {
      setPatchError(cause instanceof Error ? cause.message : 'Unable to update your story.')
    } finally {
      setSaving(null)
    }
  }

  const saveTitle = async () => {
    const title = titleDraft.trim()
    if (!story || title === story.title) return
    if (title.length < STORY_LIMITS.titleMin) {
      setTitleError(`Titles need at least ${STORY_LIMITS.titleMin} characters.`)
      return
    }
    setSaving('title')
    setTitleError(null)
    setTitleSaved(false)
    try {
      await storiesApi(`/api/stories/${storyId}`, { method: 'PATCH', body: JSON.stringify({ title }) })
      setStory((current) => (current ? { ...current, title } : current))
      setTitleDraft(title)
      setTitleSaved(true)
    } catch (cause) {
      setTitleError(cause instanceof Error ? cause.message : 'Unable to save the title.')
    } finally {
      setSaving(null)
    }
  }

  const startEpisodeEdit = (episode: StoryEpisode) => {
    setEditingEpisode(episode.number)
    setEpisodeDraft(episode.body)
    setEpisodeEditError(null)
    setSavedEpisode(null)
  }

  const saveEpisodeEdit = async (number: number) => {
    const body = episodeDraft.trim()
    const original = episodes.find((episode) => episode.number === number)
    if (!original) return
    if (body === original.body) {
      setEditingEpisode(null)
      return
    }
    if (body.length < STORY_LIMITS.bodyMin) {
      setEpisodeEditError(`Your story needs at least ${STORY_LIMITS.bodyMin} characters.`)
      return
    }
    setSaving(`episode-${number}`)
    setEpisodeEditError(null)
    try {
      const result = await storiesApi<{ editedAt: string }>(`/api/stories/${storyId}/episodes/${number}`, {
        method: 'PATCH',
        body: JSON.stringify({ body }),
      })
      setEpisodes((current) => current.map((episode) => (episode.number === number ? { ...episode, body, edited_at: result.editedAt } : episode)))
      setEditingEpisode(null)
      setSavedEpisode(number)
      import('posthog-js').then(({ default: posthog }) => posthog.capture('story_edited', { story_id: storyId, episode: number })).catch(() => {})
    } catch (cause) {
      setEpisodeEditError(cause instanceof Error ? cause.message : 'Unable to save your changes.')
    } finally {
      setSaving(null)
    }
  }

  const publishEpisode = async () => {
    const body = episodeBody.trim()
    if (body.length < STORY_LIMITS.bodyMin || publishing) return
    setPublishing(true)
    setEpisodeError(null)
    try {
      await storiesApi(`/api/stories/${storyId}/episodes`, { method: 'POST', body: JSON.stringify({ body }) })
      setEpisodeBody('')
      await load()
    } catch (cause) {
      setEpisodeError(cause instanceof Error ? cause.message : 'Unable to publish this episode.')
    } finally {
      setPublishing(false)
    }
  }

  const remove = async () => {
    setSaving('delete')
    try {
      await storiesApi(`/api/stories/${storyId}`, { method: 'DELETE' })
      router.replace(STORIES_FEED_PATH)
    } finally {
      setSaving(null)
    }
  }

  if (loadError) {
    return (
      <div className="px-6 py-20 text-center">
        <p className="text-base text-[#F2F2F6]">{loadError}</p>
        <Link href={STORIES_FEED_PATH} prefetch={false} className="mt-4 inline-block text-sm text-[#C4B5FD] underline">Back to stories</Link>
      </div>
    )
  }

  if (!story) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-[#5C5C6E]" />
      </div>
    )
  }

  const meta = CATEGORY_META[story.category]
  const path = buildStoryPath(story)
  const canAddEpisode = story.is_episodic && story.status === 'ongoing' && story.moderation_status !== 'removed'

  return (
    <div className="mx-auto w-full max-w-xl space-y-4 px-4 pb-16 pt-5">
      <Link href={path} prefetch={false} className="inline-flex items-center gap-1 text-xs text-[#8F8FA3] hover:text-[#F2F2F6]">
        <ArrowLeft className="h-3.5 w-3.5" /> View story
      </Link>
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#F97316]">{meta.tag} · {meta.label}</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-[-0.4px]">{story.title}</h1>
        <div className="mt-2 flex items-center justify-between gap-3">
          <p className="text-xs text-[#5C5C6E]">Only you can see this page.</p>
          {story.moderation_status === 'visible' && <StoryShareButton story={story} variant="pill" label="Share link" />}
        </div>
      </div>

      {justClaimed && (
        <p className="rounded-xl border border-[#5DCAA5]/30 bg-[#5DCAA5]/[0.08] px-4 py-3 text-sm text-[#7FE0BF]">
          Saved to your account. You&apos;ll find it here any time, and you&apos;ll hear when people comment.
        </p>
      )}

      {story.moderation_status !== 'visible' && (
        <p className="rounded-xl border border-[#E24B4A]/30 bg-[#E24B4A]/[0.07] px-4 py-3 text-sm text-[#F09595]">
          {story.moderation_status === 'hidden'
            ? 'Your story is hidden while our team reviews reports from readers.'
            : 'Your story was removed for breaking our community guidelines.'}
        </p>
      )}

      {story.moderation_status !== 'removed' && episodes.length > 0 && (
        <section className={`${card} space-y-4`}>
          <div>
            <h2 className="text-base font-medium">Edit your story</h2>
            <p className="mt-1 text-sm text-[#8F8FA3]">Fix typos or tidy things up. Readers see a small “edited” note.</p>
          </div>

          <div>
            <label htmlFor="story-title" className="text-xs text-[#8F8FA3]">Title</label>
            <div className="mt-1.5 flex gap-2">
              <input
                id="story-title"
                value={titleDraft}
                onChange={(event) => {
                  setTitleDraft(event.target.value.slice(0, STORY_LIMITS.titleMax))
                  setTitleSaved(false)
                }}
                className="h-10 min-w-0 flex-1 rounded-xl border border-[#2A2A38] bg-[#0A0A10] px-3 text-sm text-[#F2F2F6] focus:border-[#8B5CF6]/60 focus:outline-none"
              />
              <button
                onClick={saveTitle}
                disabled={saving === 'title' || titleDraft.trim() === story.title}
                className="h-10 rounded-xl border border-[#2A2A38] px-4 text-xs text-[#F2F2F6] disabled:opacity-40"
              >
                {saving === 'title' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
              </button>
            </div>
            {titleError && <p className="mt-1.5 text-xs text-[#F09595]">{titleError}</p>}
            {titleSaved && <p className="mt-1.5 text-xs text-[#7FE0BF]">Title updated.</p>}
          </div>

          <div className="space-y-2">
            {episodes.map((episode) => {
              const label = episodes.length > 1 ? `Episode ${episode.number}` : 'Your story'
              const isEditing = editingEpisode === episode.number
              return (
                <div key={episode.number} className="rounded-xl border border-[#23232E] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-[#F2F2F6]">{label}</span>
                    {!isEditing && (
                      <button
                        onClick={() => startEpisodeEdit(episode)}
                        disabled={editingEpisode !== null}
                        className="text-xs text-[#C4B5FD] disabled:opacity-40"
                      >
                        Edit
                      </button>
                    )}
                  </div>
                  {isEditing ? (
                    <>
                      <textarea
                        value={episodeDraft}
                        onChange={(event) => setEpisodeDraft(event.target.value.slice(0, STORY_LIMITS.bodyMax))}
                        rows={12}
                        autoFocus
                        className="mt-3 w-full resize-y rounded-xl border border-[#2A2A38] bg-[#0A0A10] px-3.5 py-3 text-[15px] leading-7 text-[#F2F2F6] focus:border-[#8B5CF6]/60 focus:outline-none"
                      />
                      {episodeEditError && <p className="mt-2 text-xs text-[#F09595]">{episodeEditError}</p>}
                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={() => setEditingEpisode(null)}
                          disabled={saving === `episode-${episode.number}`}
                          className="h-10 flex-1 rounded-xl border border-[#2A2A38] text-sm text-[#DFDFE7] disabled:opacity-40"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => saveEpisodeEdit(episode.number)}
                          disabled={saving === `episode-${episode.number}` || episodeDraft.trim().length < STORY_LIMITS.bodyMin}
                          className="flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#F97316] text-sm font-medium text-white disabled:opacity-40"
                        >
                          {saving === `episode-${episode.number}` && <Loader2 className="h-4 w-4 animate-spin" />}
                          Save changes
                        </button>
                      </div>
                    </>
                  ) : (
                    <p className="mt-1.5 line-clamp-2 text-xs leading-5 text-[#8F8FA3]">{episode.body}</p>
                  )}
                  {savedEpisode === episode.number && !isEditing && <p className="mt-1.5 text-xs text-[#7FE0BF]">Changes saved.</p>}
                </div>
              )
            })}
          </div>
        </section>
      )}

      {canAddEpisode && (
        <section className={card}>
          <h2 className="text-base font-medium">Add episode {story.episode_count + 1}</h2>
          <p className="mt-1 text-sm text-[#8F8FA3]">Followers are notified as soon as it’s published.</p>
          <textarea
            value={episodeBody}
            onChange={(event) => setEpisodeBody(event.target.value.slice(0, STORY_LIMITS.bodyMax))}
            rows={10}
            placeholder="What happened next?"
            className="mt-4 w-full resize-y rounded-xl border border-[#2A2A38] bg-[#0A0A10] px-3.5 py-3 text-[15px] leading-7 text-[#F2F2F6] placeholder:text-[#5C5C6E] focus:border-[#8B5CF6]/60 focus:outline-none"
          />
          {episodeError && <p className="mt-2 text-xs text-[#F09595]">{episodeError}</p>}
          <button
            onClick={publishEpisode}
            disabled={publishing || episodeBody.trim().length < STORY_LIMITS.bodyMin}
            className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#F97316] text-sm font-medium text-white disabled:opacity-40"
          >
            {publishing && <Loader2 className="h-4 w-4 animate-spin" />}
            Publish episode
          </button>
        </section>
      )}

      {story.is_episodic && (
        <section className={`${card} space-y-4`}>
          <div>
            <h2 className="text-base font-medium">Posting rhythm</h2>
            <p className="mt-1 text-sm text-[#8F8FA3]">Shown to readers as “Usually posts …”. It’s a note, not a promise.</p>
            <div className="mt-3 flex gap-2">
              <input
                value={cadence}
                onChange={(event) => setCadence(event.target.value.slice(0, STORY_LIMITS.cadenceMax))}
                placeholder="e.g. on Fridays"
                className="h-10 flex-1 rounded-xl border border-[#2A2A38] bg-[#0A0A10] px-3 text-sm text-[#F2F2F6] placeholder:text-[#5C5C6E] focus:outline-none"
              />
              <button
                onClick={() => patch('cadence', { cadence }, { cadence_label: cadence || null })}
                disabled={saving === 'cadence' || cadence === (story.cadence_label ?? '')}
                className="h-10 rounded-xl border border-[#2A2A38] px-4 text-xs text-[#F2F2F6] disabled:opacity-40"
              >
                Save
              </button>
            </div>
          </div>
          <button
            onClick={() => patch('status', { status: story.status === 'ongoing' ? 'finished' : 'ongoing' }, { status: story.status === 'ongoing' ? 'finished' : 'ongoing' })}
            disabled={saving === 'status'}
            className="h-10 w-full rounded-xl border border-[#2A2A38] text-sm text-[#DFDFE7] disabled:opacity-40"
          >
            {story.status === 'ongoing' ? 'Mark story as finished' : 'Reopen for new episodes'}
          </button>
          {patchError && <p className="text-xs leading-5 text-[#F09595]">{patchError}</p>}
        </section>
      )}

      <section className={`${card} space-y-3`}>
        <h2 className="text-base font-medium">Settings</h2>
        {([
          {
            key: 'consent',
            label: 'WhisprSpace may share this on her socials',
            hint: 'Anonymously, with no name attached. Turning this off stops any future features.',
            value: story.feature_consent,
            body: { featureConsent: !story.feature_consent },
            apply: { feature_consent: !story.feature_consent },
          },
        ] as const).map((setting) => (
          <button
            key={setting.key}
            onClick={() => patch(setting.key, setting.body, setting.apply)}
            disabled={saving === setting.key}
            className="flex w-full items-start gap-3 rounded-xl border border-[#23232E] p-3 text-left disabled:opacity-60"
          >
            <span className={`mt-0.5 flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors ${setting.value ? 'bg-[#8B5CF6]' : 'bg-[#2A2A38]'}`}>
              <span className={`h-4 w-4 rounded-full bg-white transition-transform ${setting.value ? 'translate-x-4' : ''}`} />
            </span>
            <span>
              <span className="block text-sm text-[#F2F2F6]">{setting.label}</span>
              <span className="mt-0.5 block text-xs leading-5 text-[#8F8FA3]">{setting.hint}</span>
            </span>
          </button>
        ))}
      </section>

      {story.moderation_status === 'visible' && episodes.length > 0 && (
        <StoryExport
          storyId={story.id}
          title={story.title}
          category={story.category}
          family={meta.family}
          episodes={episodes.map(({ number, body }) => ({ number, body }))}
          isPremium={Boolean(session.user?.isPremium)}
        />
      )}

      <section className={card}>
        {confirmDelete ? (
          <div className="space-y-3">
            <p className="text-sm text-[#F2F2F6]">Delete this story and its comments? This can’t be undone.</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDelete(false)} className="h-10 flex-1 rounded-xl border border-[#2A2A38] text-sm text-[#DFDFE7]">Keep it</button>
              <button onClick={remove} disabled={saving === 'delete'} className="h-10 flex-1 rounded-xl bg-[#E24B4A] text-sm font-medium text-white disabled:opacity-50">Delete</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setConfirmDelete(true)} className="text-sm text-[#F09595]">Delete story</button>
        )}
      </section>
    </div>
  )
}
