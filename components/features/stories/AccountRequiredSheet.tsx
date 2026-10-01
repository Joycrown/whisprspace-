'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, BookOpen, Check, Flag, MessageCircle, SmilePlus, X } from 'lucide-react'
import { authRedirectPath } from '@/lib/stories/api-client'
import { useUserStore } from '@/store/userStore'

export type AccountReason = 'comment' | 'react' | 'follow' | 'tell' | 'report'

const COPY: Record<AccountReason, { icon: typeof Bell; title: string; body: string }> = {
  comment: {
    icon: MessageCircle,
    title: 'Post your comment',
    body: 'Takes less than a minute. Nobody sees your name, email or photo.',
  },
  react: {
    icon: SmilePlus,
    title: 'Let the storyteller know',
    body: 'Create an account to react to stories and comments. Your reactions stay anonymous.',
  },
  follow: {
    icon: Bell,
    title: 'Never miss an episode',
    body: 'Create an account and we’ll let you know the moment the next episode is out.',
  },
  tell: {
    icon: BookOpen,
    title: 'Keep this story yours',
    body: 'Stories you come back to need an account, so you never lose access. You still post anonymously.',
  },
  report: {
    icon: Flag,
    title: 'Sign in to report comments',
    body: 'Reports on comments come from signed-in readers, so one person can’t hide someone else’s comment.',
  },
}

const PERKS: Partial<Record<AccountReason, string[]>> = {
  comment: ['You stay anonymous', 'Get notified when someone replies to you', 'React to stories and comments'],
  react: ['You stay anonymous', 'Comment and reply to other readers', 'Follow stories as they unfold'],
}

interface AccountRequiredSheetProps {
  reason: AccountReason
  returnTo: string
  preview?: string | null
  onClose: () => void
}

export default function AccountRequiredSheet({ reason, returnTo, preview, onClose }: AccountRequiredSheetProps) {
  const router = useRouter()
  const isGuest = useUserStore((state) => Boolean(state.session.user?.isAnonymous))
  const { icon: Icon, title, body: baseBody } = COPY[reason]
  const body = isGuest ? `You’re browsing as a guest. ${baseBody}` : baseBody
  const perks = PERKS[reason]
  const draft = preview?.trim()

  useEffect(() => {
    import('posthog-js').then(({ default: posthog }) => posthog.capture('story_signup_prompt_shown', { reason, has_draft: Boolean(draft) })).catch(() => {})
  }, [reason, draft])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-[1400] flex items-end justify-center bg-black/60 backdrop-blur-[2px] sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-sheet-title"
        className="w-full rounded-t-3xl border border-[#23232E] bg-[#12121A] p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-[#F2F2F6] shadow-2xl sm:max-w-md sm:rounded-3xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[#2A2A38] sm:hidden" />
        <div className="flex items-start justify-between gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#8B5CF6]/25 to-[#F97316]/25">
            <Icon className="h-5 w-5 text-[#C4B5FD]" />
          </span>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-[#5C5C6E] hover:bg-white/[0.05] hover:text-[#F2F2F6]">
            <X className="h-4 w-4" />
          </button>
        </div>
        <h2 id="account-sheet-title" className="mt-4 text-lg font-medium">{title}</h2>
        <p className="mt-1.5 text-sm leading-6 text-[#8F8FA3]">{body}</p>

        {draft && (
          <div className="mt-4 rounded-2xl border border-[#8B5CF6]/25 bg-[#8B5CF6]/[0.06] px-4 py-3">
            <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-[#C4B5FD]">Your comment</p>
            <p className="mt-1 line-clamp-3 whitespace-pre-wrap break-words text-sm leading-6 text-[#DFDFE7]">{draft}</p>
            <p className="mt-1.5 text-[11px] text-[#8F8FA3]">Saved on this device. It’ll be waiting when you’re back.</p>
          </div>
        )}

        {perks && (
          <ul className="mt-4 space-y-2">
            {perks.map((perk) => (
              <li key={perk} className="flex items-center gap-2.5 text-sm text-[#DFDFE7]">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#5DCAA5]/15">
                  <Check className="h-3 w-3 text-[#7FE0BF]" />
                </span>
                {perk}
              </li>
            ))}
          </ul>
        )}

        <button
          onClick={() => router.push(authRedirectPath('signup', returnTo))}
          className="mt-6 h-12 w-full rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#F97316] text-sm font-medium text-white active:scale-[0.98]"
        >
          {reason === 'comment' && draft ? 'Create an account & post' : 'Create an account'}
        </button>
        <button
          onClick={() => router.push(authRedirectPath('login', returnTo))}
          className="mt-2 h-11 w-full rounded-xl border border-[#2A2A38] text-sm text-[#DFDFE7] hover:bg-white/[0.03]"
        >
          I already have an account
        </button>
      </div>
    </div>
  )
}
