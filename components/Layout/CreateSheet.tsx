'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronRight, MessagesSquare, PenLine, Sparkles, X } from 'lucide-react'
import type { GatedFeature } from '@/lib/navigation/feature-gates'

interface CreateOption {
  key: string
  icon: typeof PenLine
  title: string
  body: string
  href: string
  gate: GatedFeature | null
}

interface CreateSheetProps {
  onClose: () => void
  onGate: (feature: GatedFeature) => void
  gateFor: (feature: GatedFeature) => GatedFeature | null
}

export default function CreateSheet({ onClose, onGate, gateFor }: CreateSheetProps) {
  const router = useRouter()

  const options: CreateOption[] = [
    {
      key: 'story',
      icon: PenLine,
      title: 'Tell a story',
      body: 'Something that happened, a regret, fiction or a poem. Anonymous.',
      href: '/stories/new',
      gate: null,
    },
    {
      key: 'discussion',
      icon: MessagesSquare,
      title: 'Start a discussion',
      body: 'Ask everyone anything. It closes after 48 hours.',
      href: '/discussions/create',
      gate: gateFor('create-discussion'),
    },
    {
      key: 'ask',
      icon: Sparkles,
      title: 'Curiosity Ask',
      body: 'Ask your friends one question and collect honest, anonymous answers.',
      href: '/curiosity-ask',
      gate: gateFor('ask'),
    },
  ]

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const choose = (option: CreateOption) => {
    onClose()
    if (option.gate) onGate(option.gate)
    else router.push(option.href)
  }

  return (
    <div className="fixed inset-0 z-[1350] flex items-end justify-center bg-black/60 backdrop-blur-[2px] sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-sheet-title"
        className="w-full rounded-t-3xl border border-[#23232E] bg-[#12121A] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-[#F2F2F6] shadow-2xl sm:max-w-md sm:rounded-3xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[#2A2A38] sm:hidden" />
        <div className="flex items-center justify-between">
          <h2 id="create-sheet-title" className="text-lg font-medium">What do you want to share?</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-[#5C5C6E] hover:bg-white/[0.05] hover:text-[#F2F2F6]">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-4 space-y-2">
          {options.map((option) => (
            <button
              key={option.key}
              onClick={() => choose(option)}
              className="flex w-full items-center gap-3.5 rounded-2xl border border-[#23232E] bg-[#0D0D14] p-4 text-left transition-colors hover:border-[#8B5CF6]/45 active:scale-[0.99]"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#8B5CF6]/25 to-[#F97316]/25">
                <option.icon className="h-5 w-5 text-[#C4B5FD]" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-medium">{option.title}</span>
                <span className="mt-0.5 block text-xs leading-5 text-[#8F8FA3]">{option.body}</span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-[#5C5C6E]" />
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
