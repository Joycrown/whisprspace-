'use client'

import { useCallback, useEffect, useState } from 'react'
import { ExternalLink, Loader2 } from 'lucide-react'
import { storiesApi } from '@/lib/stories/api-client'
import { buildStoryPath } from '@/lib/stories/story-url'
import { CATEGORY_META, type StoryCategory } from '@/lib/stories/types'

type Filter = 'review' | 'hidden' | 'removed' | 'consented' | 'recent'
type Action = 'restore' | 'hide' | 'remove' | 'mark_team' | 'unmark_team' | 'mark_sensitive'

interface AdminStory {
  id: string
  title: string
  category: StoryCategory
  excerpt: string
  moderation_status: 'visible' | 'hidden' | 'removed'
  report_count: number
  reply_count: number
  follower_count: number
  episode_count: number
  is_sensitive: boolean
  feature_consent: boolean
  is_team: boolean
  has_account: boolean
  created_at: string
  report_reasons: Record<string, number>
}

const FILTERS: Array<{ value: Filter; label: string }> = [
  { value: 'review', label: 'Needs review' },
  { value: 'hidden', label: 'Hidden' },
  { value: 'removed', label: 'Removed' },
  { value: 'consented', label: 'OK to feature' },
  { value: 'recent', label: 'All recent' },
]

const STATUS_STYLES: Record<AdminStory['moderation_status'], string> = {
  visible: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  hidden: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  removed: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
}

export default function StoriesModeration() {
  const [filter, setFilter] = useState<Filter>('review')
  const [stories, setStories] = useState<AdminStory[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (value: Filter) => {
    setLoading(true)
    setError(null)
    try {
      const data = await storiesApi<{ stories: AdminStory[] }>(`/api/admin/stories?filter=${value}`)
      setStories(data.stories)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load stories.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load(filter)
  }, [filter, load])

  const act = async (story: AdminStory, action: Action) => {
    setBusyId(story.id)
    try {
      await storiesApi(`/api/admin/stories/${story.id}`, { method: 'POST', body: JSON.stringify({ action }) })
      await load(filter)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Action failed.')
    } finally {
      setBusyId(null)
    }
  }

  const actionButton = 'rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700'

  return (
    <div className="space-y-4">
      <div className="flex gap-2 overflow-x-auto scrollbar-hide">
        {FILTERS.map((option) => (
          <button
            key={option.value}
            onClick={() => setFilter(option.value)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-sm ${filter === option.value ? 'bg-purple-600 text-white' : 'bg-white text-gray-600 dark:bg-gray-800 dark:text-gray-300'}`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-purple-600" />
        </div>
      ) : stories.length === 0 ? (
        <p className="py-12 text-center text-sm text-gray-500">Nothing here.</p>
      ) : (
        <ul className="space-y-3">
          {stories.map((story) => (
            <li key={story.id} className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className={`rounded-full px-2 py-0.5 font-semibold ${STATUS_STYLES[story.moderation_status]}`}>{story.moderation_status}</span>
                <span className="text-gray-500">{CATEGORY_META[story.category].tag} · {CATEGORY_META[story.category].label}</span>
                {story.report_count > 0 && <span className="text-red-600">{story.report_count} reports</span>}
                {story.feature_consent && <span className="text-purple-600">OK to feature</span>}
                {story.is_team && <span className="text-blue-600">Team</span>}
                {story.is_sensitive && <span className="text-orange-600">Sensitive</span>}
                <span className="text-gray-400">{story.has_account ? 'Account' : 'No account'}</span>
                <span className="ml-auto text-gray-400">{new Date(story.created_at).toLocaleDateString()}</span>
              </div>
              <h3 className="mt-2 font-semibold text-gray-900 dark:text-white">{story.title}</h3>
              <p className="mt-1 line-clamp-3 text-sm text-gray-600 dark:text-gray-300">{story.excerpt}</p>
              {Object.keys(story.report_reasons).length > 0 && (
                <p className="mt-2 text-xs text-gray-500">
                  Reasons: {Object.entries(story.report_reasons).map(([reason, count]) => `${reason.replace(/_/g, ' ')} (${count})`).join(', ')}
                </p>
              )}
              <p className="mt-1 text-xs text-gray-400">{story.reply_count} replies · {story.episode_count} episodes · {story.follower_count} followers</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <a href={buildStoryPath(story)} target="_blank" rel="noopener noreferrer" className={`${actionButton} inline-flex items-center gap-1`}>
                  Open <ExternalLink className="h-3 w-3" />
                </a>
                {story.moderation_status !== 'visible' && <button disabled={busyId === story.id} onClick={() => act(story, 'restore')} className={actionButton}>Restore</button>}
                {story.moderation_status === 'visible' && <button disabled={busyId === story.id} onClick={() => act(story, 'hide')} className={actionButton}>Hide</button>}
                {story.moderation_status !== 'removed' && <button disabled={busyId === story.id} onClick={() => act(story, 'remove')} className={`${actionButton} text-red-600 dark:text-red-400`}>Remove</button>}
                {!story.is_sensitive && <button disabled={busyId === story.id} onClick={() => act(story, 'mark_sensitive')} className={actionButton}>Mark sensitive</button>}
                <button disabled={busyId === story.id} onClick={() => act(story, story.is_team ? 'unmark_team' : 'mark_team')} className={actionButton}>
                  {story.is_team ? 'Unmark team' : 'Mark as team'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
