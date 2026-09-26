import { ArrowRight, MessageCircle } from 'lucide-react'
import { buildStoryPath } from '@/lib/stories/story-url'
import { CATEGORY_META, REACTION_EMOJI, STORY_REACTIONS, type ReactionCounts, type StoryCategory, type StoryFeedItem } from '@/lib/stories/types'

interface MarketingStoriesStripProps {
  stories: StoryFeedItem[]
  appUrl: string
  storiesHref: string
}

interface StripCard {
  key: string
  href: string
  category: StoryCategory
  title: string
  excerpt: string
  comments: number
  reactions: ReactionCounts
  episode?: number
  blurred?: boolean
}

const SHOWCASE: Omit<StripCard, 'href'>[] = [
  {
    key: 'example-landlord',
    category: 'live_story',
    title: 'My landlord gave us 7 days to leave. Day 3.',
    excerpt: 'We found a place this morning. Then the agent said something that made my mum sit down on the floor…',
    comments: 184,
    reactions: { sad: 312, love: 140, angry: 96 },
    episode: 3,
  },
  {
    key: 'example-dad',
    category: 'regret',
    title: 'I never told my dad I didn’t finish uni',
    excerpt: 'He framed a photo from a graduation that never happened. It’s still in the living room, and he shows every visitor.',
    comments: 263,
    reactions: { sad: 540, love: 221, like: 48 },
  },
  {
    key: 'example-rumour',
    category: 'bad_experience',
    title: 'The person spreading the rumour was my best friend',
    excerpt: 'For two years I defended her to everyone. Then I saw her phone screen light up with my name on it.',
    comments: 317,
    reactions: { angry: 402, sad: 188, love: 63 },
  },
  {
    key: 'example-phone',
    category: 'fiction',
    title: 'The last voice note on her phone',
    excerpt: 'Police said she’d been gone for three days. The voice note was sent this morning.',
    comments: 96,
    reactions: { love: 205, sad: 77, laugh: 12 },
    episode: 5,
  },
  {
    key: 'example-startup',
    category: 'regret',
    title: 'I turned down a job at a startup that’s now worth millions',
    excerpt: 'They offered shares instead of a bigger salary. I laughed and took the bank job. I still check their news every week.',
    comments: 141,
    reactions: { sad: 260, laugh: 150, like: 74 },
  },
  {
    key: 'example-poem',
    category: 'poetry',
    title: 'Letters I will never send',
    excerpt: 'To the version of me who waited by the gate: he wasn’t coming, and you were never the reason…',
    comments: 72,
    reactions: { love: 388, sad: 190 },
  },
]

function topReactions(reactions: ReactionCounts | undefined) {
  return STORY_REACTIONS.map((reaction) => ({ reaction, count: reactions?.[reaction] ?? 0 }))
    .filter((entry) => entry.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)
}

export default function MarketingStoriesStrip({ stories, appUrl, storiesHref }: MarketingStoriesStripProps) {
  const real: StripCard[] = stories.map((story) => ({
    key: story.id,
    href: `${appUrl}${buildStoryPath(story)}`,
    category: story.category,
    title: story.title,
    excerpt: story.excerpt,
    comments: story.reply_count,
    reactions: story.reaction_counts ?? {},
    episode: story.is_episodic && story.episode_count > 1 ? story.episode_count : undefined,
    blurred: story.is_sensitive,
  }))
  const cards = [...real, ...SHOWCASE.map((card) => ({ ...card, href: storiesHref }))].slice(0, 6)

  return (
    <section className="py-16" aria-labelledby="latest-stories-heading">
      <div className="mx-auto max-w-6xl px-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-orange-500">Real stories. No names.</p>
            <h2 id="latest-stories-heading" className="mt-2 text-3xl font-bold text-gray-900 lg:text-4xl">Stories people couldn&apos;t tell anywhere else</h2>
          </div>
          <a href={storiesHref} className="hidden items-center gap-1 text-sm font-semibold text-purple-600 hover:text-purple-700 sm:inline-flex">
            Read all stories <ArrowRight className="h-4 w-4" />
          </a>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => {
            const meta = CATEGORY_META[card.category]
            const reactions = topReactions(card.reactions)
            return (
              <a
                key={card.key}
                href={card.href}
                className="group flex flex-col rounded-2xl border border-gray-200 bg-white p-5 transition-shadow hover:shadow-lg"
              >
                <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.1em]">
                  <span className={meta.family === 'true_story' ? 'text-emerald-600' : 'text-purple-600'}>{meta.tag}</span>
                  <span className="text-gray-400">·</span>
                  <span className="font-medium normal-case tracking-normal text-gray-500">{meta.label}</span>
                  {card.episode && (
                    <span className="ml-auto rounded-full bg-orange-50 px-2 py-0.5 font-semibold normal-case tracking-normal text-orange-600">
                      Episode {card.episode}
                    </span>
                  )}
                </div>
                <h3 className="mt-3 text-lg font-semibold leading-snug text-gray-900 group-hover:text-purple-700">{card.title}</h3>
                <div className="flex-1">
                  <p className={`mt-2 line-clamp-3 text-sm leading-6 text-gray-600 ${card.blurred ? 'blur-[3px]' : ''}`}>{card.excerpt}</p>
                </div>
                <div className="mt-4 flex items-center gap-2 text-xs text-gray-600">
                  {reactions.length > 0
                    ? reactions.map(({ reaction, count }) => (
                        <span key={reaction} className="inline-flex items-center gap-1 rounded-full bg-gray-50 px-2 py-1 ring-1 ring-gray-200">
                          <span className="text-sm leading-none">{REACTION_EMOJI[reaction].emoji}</span>
                          <span className="tabular-nums">{count}</span>
                        </span>
                      ))
                    : (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-50 px-2.5 py-1 font-medium text-purple-700 ring-1 ring-purple-100">
                          <span className="text-sm leading-none">{REACTION_EMOJI.love.emoji}{REACTION_EMOJI.sad.emoji}{REACTION_EMOJI.like.emoji}</span>
                          Be the first to react
                        </span>
                      )}
                  <span className="ml-auto inline-flex items-center gap-1 text-gray-500">
                    <MessageCircle className="h-3.5 w-3.5" />
                    {card.comments} {card.comments === 1 ? 'comment' : 'comments'}
                  </span>
                </div>
              </a>
            )
          })}
        </div>
        <a
          href={storiesHref}
          className="mt-8 flex h-12 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-purple-500 to-orange-500 text-base font-semibold text-white sm:hidden"
        >
          Read all stories <ArrowRight className="h-4 w-4" />
        </a>
      </div>
    </section>
  )
}
