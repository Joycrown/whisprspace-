'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { BookOpen, Check, MessageCircle, MessagesSquare, Sparkles, User, X } from 'lucide-react'
import { FEATURE_GATES, type GatedFeature } from '@/lib/navigation/feature-gates'

const ICONS: Record<GatedFeature, typeof BookOpen> = {
  inbox: MessageCircle,
  discussions: MessagesSquare,
  'create-discussion': MessagesSquare,
  ask: Sparkles,
  profile: User,
}

export default function FeatureGateSheet({ feature, onClose }: { feature: GatedFeature; onClose: () => void }) {
  const gate = FEATURE_GATES[feature]
  const Icon = ICONS[feature]

  useEffect(() => {
    import('posthog-js').then(({ default: posthog }) => posthog.capture('feature_gate_shown', { feature })).catch(() => {})
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [feature, onClose])

  return (
    <div className="fixed inset-0 z-[1400] flex items-end justify-center bg-black/60 backdrop-blur-[2px] sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="feature-gate-title"
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
        <h2 id="feature-gate-title" className="mt-4 text-lg font-medium leading-snug">{gate.title}</h2>
        <p className="mt-1.5 text-sm leading-6 text-[#8F8FA3]">{gate.body}</p>
        <ul className="mt-4 space-y-2">
          {gate.perks.map((perk) => (
            <li key={perk} className="flex items-center gap-2.5 text-sm text-[#DFDFE7]">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#5DCAA5]/15">
                <Check className="h-3 w-3 text-[#7FE0BF]" />
              </span>
              {perk}
            </li>
          ))}
        </ul>
        <Link
          href={gate.signupHref}
          prefetch={false}
          onClick={onClose}
          className="mt-6 flex h-12 w-full items-center justify-center rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#F97316] text-sm font-medium text-white active:scale-[0.98]"
        >
          {gate.primaryLabel}
        </Link>
        <Link
          href={gate.loginHref}
          prefetch={false}
          onClick={onClose}
          className="mt-2 flex h-11 w-full items-center justify-center rounded-xl border border-[#2A2A38] text-sm text-[#DFDFE7] hover:bg-white/[0.03]"
        >
          I already have an account
        </Link>
        {gate.guestHref && (
          <Link href={gate.guestHref} prefetch={false} onClick={onClose} className="mt-3 block text-center text-xs text-[#8F8FA3] underline-offset-4 hover:text-[#F2F2F6] hover:underline">
            {gate.guestLabel}
          </Link>
        )}
      </div>
    </div>
  )
}
