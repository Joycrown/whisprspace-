import Link from 'next/link'
import type { DiscussionClosure } from '@/lib/threads/closure'

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`

export default function ClosedDiscussion({ closure }: { closure: DiscussionClosure }) {
  const details = closure.state === 'closed' ? closure : null
  const stats = details
    ? [
        plural(details.participant_count, 'person joined in', 'people joined in'),
        plural(details.perspective_count, 'reply', 'replies'),
        plural(details.reaction_count, 'reaction', 'reactions'),
      ]
    : []
  const hadActivity = details ? details.perspective_count + details.reaction_count > 0 : false

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-[#121212] px-4 py-12 text-white">
      <div className="w-full max-w-xl rounded-2xl border border-gray-800 bg-[#1E1E1E] p-6 shadow-2xl md:p-8">
        <span className="inline-flex items-center rounded-full border border-gray-700 bg-gray-800/60 px-3 py-1 text-xs font-medium uppercase tracking-[0.14em] text-gray-300">
          Discussion closed
        </span>

        {details ? (
          <>
            <h1 className="mt-4 text-2xl font-semibold leading-snug tracking-tight md:text-3xl">
              {details.title?.trim() || 'Untitled discussion'}
            </h1>
            {details.content ? (
              <p className="mt-4 whitespace-pre-wrap break-words text-[15px] leading-7 text-gray-200">{details.content}</p>
            ) : null}
            <div className="mt-6 border-t border-gray-800 pt-5">
              {hadActivity ? (
                <ul className="flex flex-wrap gap-2">
                  {stats.map((stat) => (
                    <li key={stat} className="rounded-full bg-purple-500/10 px-3 py-1 text-sm text-purple-200">
                      {stat}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-400">It closed before anyone replied.</p>
              )}
              <p className="mt-4 text-sm leading-6 text-gray-400">
                This conversation has ended and its replies are gone. There are others happening right now.
              </p>
            </div>
          </>
        ) : (
          <>
            <h1 className="mt-4 text-2xl font-semibold tracking-tight">This discussion has closed</h1>
            <p className="mt-3 text-sm leading-6 text-gray-400">
              It&apos;s no longer available, but there are other conversations happening right now.
            </p>
          </>
        )}

        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <Link
            href="/discussions"
            prefetch={false}
            className="flex-1 rounded-lg bg-purple-600 px-4 py-2.5 text-center text-sm font-medium text-white transition-colors hover:bg-purple-700"
          >
            Join a live discussion
          </Link>
          <Link
            href="/discussions/create"
            prefetch={false}
            className="flex-1 rounded-lg border border-gray-700 px-4 py-2.5 text-center text-sm font-medium text-white transition-colors hover:bg-gray-800"
          >
            Start a new one
          </Link>
        </div>
      </div>
    </main>
  )
}
