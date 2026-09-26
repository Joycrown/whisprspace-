export const STORY_CATEGORIES = ['live_story', 'regret', 'bad_experience', 'fiction', 'poetry'] as const
export type StoryCategory = (typeof STORY_CATEGORIES)[number]

export const STORY_FAMILIES = ['true_story', 'fiction_poetry'] as const
export type StoryFamily = (typeof STORY_FAMILIES)[number]

export const STORY_SORTS = ['fresh', 'discussed'] as const
export type StorySort = (typeof STORY_SORTS)[number]

export const STORY_STATUSES = ['ongoing', 'finished'] as const
export type StoryStatus = (typeof STORY_STATUSES)[number]

export const STORY_REPORT_REASONS = [
  { value: 'personal_info', label: 'Shares someone’s personal details' },
  { value: 'harassment', label: 'Targets or harasses someone' },
  { value: 'self_harm', label: 'Self-harm content without a warning' },
  { value: 'sexual_content', label: 'Explicit sexual content' },
  { value: 'hate_speech', label: 'Hate speech' },
  { value: 'mislabelled', label: 'Labelled as a true story but isn’t' },
  { value: 'spam', label: 'Spam' },
  { value: 'other', label: 'Something else' },
] as const
export type StoryReportReason = (typeof STORY_REPORT_REASONS)[number]['value']

export const STORY_LIMITS = {
  titleMin: 3,
  titleMax: 120,
  bodyMin: 20,
  bodyMax: 20000,
  cadenceMax: 40,
  replyMax: 1000,
} as const

export const FAMILY_LABELS: Record<StoryFamily, string> = {
  true_story: 'True Story',
  fiction_poetry: 'Fiction & Poetry',
}

export const CATEGORY_META: Record<
  StoryCategory,
  { label: string; tag: string; family: StoryFamily; description: string; episodic: boolean }
> = {
  live_story: {
    label: 'Everyday Events',
    tag: 'TRUE STORY',
    family: 'true_story',
    description: 'Something happening in your life or around you right now. Add to it as it unfolds.',
    episodic: true,
  },
  regret: {
    label: 'Regrets',
    tag: 'TRUE STORY',
    family: 'true_story',
    description: 'What you wish you’d known, or wish you’d done differently.',
    episodic: false,
  },
  bad_experience: {
    label: 'Bad Experiences',
    tag: 'TRUE STORY',
    family: 'true_story',
    description: 'Something that went wrong, and what it taught you.',
    episodic: false,
  },
  fiction: {
    label: 'Fiction',
    tag: 'FICTION',
    family: 'fiction_poetry',
    description: 'A story you made up. One piece, or a series told in episodes.',
    episodic: true,
  },
  poetry: {
    label: 'Poetry',
    tag: 'POEM',
    family: 'fiction_poetry',
    description: 'A poem, in your own words.',
    episodic: false,
  },
}

export function categoriesForFamily(family: StoryFamily): StoryCategory[] {
  return STORY_CATEGORIES.filter((category) => CATEGORY_META[category].family === family)
}

export function storyRequiresAccount(category: StoryCategory, isEpisodic: boolean): boolean {
  return category === 'live_story' || isEpisodic
}

export const FREE_ONGOING_SERIES_LIMIT = 2

export function resolveIsEpisodic(category: StoryCategory, requested: boolean): boolean {
  if (category === 'live_story') return true
  return requested && CATEGORY_META[category].episodic
}

export interface SeriesLimitState {
  isPremium: boolean
  limit: number | null
  ongoing: Array<{ id: string; title: string }>
}

export interface StoryFeedItem {
  id: string
  title: string
  category: StoryCategory
  family: StoryFamily
  excerpt: string
  is_episodic: boolean
  status: StoryStatus
  is_sensitive: boolean
  episode_count: number
  reply_count: number
  follower_count: number
  last_episode_at: string
  created_at: string
  reaction_counts?: Partial<Record<'like' | 'love' | 'laugh' | 'sad' | 'angry', number>>
}

export interface StoryFeedPage {
  items: StoryFeedItem[]
  nextCursor: string | null
}

export interface StoryEpisode {
  number: number
  body: string
  published_at: string
  edited_at?: string | null
}

export const STORY_REACTIONS = ['like', 'love', 'laugh', 'sad', 'angry'] as const
export type StoryReaction = (typeof STORY_REACTIONS)[number]
export type ReactionCounts = Partial<Record<StoryReaction, number>>

export const REACTION_EMOJI: Record<StoryReaction, { emoji: string; label: string }> = {
  like: { emoji: '👍', label: 'Like' },
  love: { emoji: '❤️', label: 'Love' },
  laugh: { emoji: '😂', label: 'Haha' },
  sad: { emoji: '😢', label: 'Sad' },
  angry: { emoji: '😡', label: 'Angry' },
}

export function isStoryReaction(value: unknown): value is StoryReaction {
  return typeof value === 'string' && (STORY_REACTIONS as readonly string[]).includes(value)
}

export interface StoryPageData extends StoryFeedItem {
  cadence_label: string | null
  updated_at: string
  reaction_counts?: ReactionCounts
  thread_id: string
  episodes: StoryEpisode[]
}

export interface StoryReply {
  id: string
  content: string
  created_at: string
  avatar_seed: string
  is_edited?: boolean
  parent_id?: string | null
  parent_content?: string | null
  parent_avatar_seed?: string | null
  reaction_counts?: ReactionCounts
}

export interface StoryRepliesPage {
  items: StoryReply[]
  nextCursor: string | null
}

export interface StoryViewerState {
  isAuthor: boolean
  isFollowing: boolean
  canParticipate: boolean
  featureConsent: boolean | null
  myReaction?: StoryReaction | null
  reactionCounts?: ReactionCounts
}

export const LIVE_WINDOW_DAYS = 14

export function isStoryLive(story: Pick<StoryFeedItem, 'is_episodic' | 'category' | 'status' | 'last_episode_at'>): boolean {
  if (story.status === 'finished') return false
  if (!story.is_episodic && story.category !== 'live_story') return false
  return Date.now() - new Date(story.last_episode_at).getTime() < LIVE_WINDOW_DAYS * 24 * 60 * 60 * 1000
}
