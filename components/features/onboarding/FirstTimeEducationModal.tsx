'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import {
  ArrowLeft,
  ArrowRight,
  Crown,
  X,
  Sparkles,
  Globe,
  Inbox,
  User,
  ListPlus,
  Zap,
  MessageCircle,
  Bell,
  Settings2,
  ShieldCheck,
  CheckCircle2,
  PlusCircle
} from 'lucide-react'
import { useUserStore } from '@/store/userStore'
import { UserPreferences } from '@/types'

const ONBOARDING_VERSION = '2026-02-thread-guide-v2'

type GuidePoint = {
  text: string
  icon: React.ElementType
}

type GuideStep = {
  id: string
  title: string
  subtitle: string
  points: GuidePoint[]
  ctaLabel?: string
  ctaHref?: string
  mainIcon: React.ElementType
  color: string
}

const GUIDE_STEPS: GuideStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to WhisprSpace',
    subtitle: 'Your central hub for meaningful conversations.',
    mainIcon: Sparkles,
    color: 'from-indigo-600 via-purple-600 to-fuchsia-600',
    points: [
      { text: 'Discover & join public Discussions.', icon: Globe },
      { text: 'Private 1-on-1s in your Inbox.', icon: Inbox },
      { text: 'Manage your settings in Profile.', icon: User },
    ],
    ctaLabel: 'Explore Discussions',
    ctaHref: '/threads',
  },
  {
    id: 'create',
    title: 'Create & Share',
    subtitle: 'Start discussions exactly how you want them.',
    mainIcon: ListPlus,
    color: 'from-cyan-500 via-blue-600 to-indigo-700',
    points: [
      { text: 'Standard, Poll, or Premium formats.', icon: PlusCircle },
      { text: 'Set clear privacy controls.', icon: ShieldCheck },
      { text: 'Monetize with Premium access.', icon: Crown },
    ],
    ctaLabel: 'Create Discussion',
    ctaHref: '/threads/create',
  },
  {
    id: 'engage',
    title: 'Engage & Manage',
    subtitle: 'Stay active and always in control.',
    mainIcon: Zap,
    color: 'from-emerald-500 via-teal-600 to-cyan-700',
    points: [
      { text: 'Real-time typing & @mentions.', icon: MessageCircle },
      { text: 'Get instant push notifications.', icon: Bell },
      { text: 'Powerful moderation tools.', icon: Settings2 },
    ],
    ctaLabel: 'Manage Discussions',
    ctaHref: '/my-threads',
  },
]

const FirstTimeEducationModal: React.FC = () => {
  const router = useRouter()
  const pathname = usePathname()
  const { session, sessionValidated, updatePreferences } = useUserStore()

  const [isOpen, setIsOpen] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)
  const [isSaving, setIsSaving] = useState(false)

  const userId = session.user?.id || null
  const preferences = session.user?.preferences

  const storageKey = useMemo(() => {
    if (!userId) return null
    return `whispr_onboarding_seen:${ONBOARDING_VERSION}:${userId}`
  }, [userId])

  const shouldSkipRoute = useMemo(() => {
    if (!pathname) return false
    return (
      pathname.startsWith('/auth') ||
      pathname.startsWith('/api') ||
      pathname.startsWith('/invite/')
    )
  }, [pathname])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!sessionValidated || !userId || !storageKey || shouldSkipRoute) {
      setIsOpen(false)
      return
    }

    const doneInPreferences =
      preferences?.education?.onboardingVersion === ONBOARDING_VERSION
    const doneInLocal = window.localStorage.getItem(storageKey) === 'done'

    if (doneInPreferences || doneInLocal) {
      if (!doneInLocal) {
        window.localStorage.setItem(storageKey, 'done')
      }
      setIsOpen(false)
      return
    }

    setIsOpen(true)
  }, [
    sessionValidated,
    userId,
    storageKey,
    shouldSkipRoute,
    preferences?.education?.onboardingVersion,
  ])

  const markOnboardingSeen = async (skipped: boolean) => {
    if (typeof window !== 'undefined' && storageKey) {
      window.localStorage.setItem(storageKey, 'done')
    }

    if (!session.user || !preferences) {
      setIsOpen(false)
      return
    }

    const nextPreferences: UserPreferences = {
      ...preferences,
      education: {
        ...(preferences.education || {}),
        onboardingVersion: ONBOARDING_VERSION,
        onboardingCompletedAt: new Date().toISOString(),
        onboardingSkipped: skipped,
      },
    }

    setIsSaving(true)
    setIsOpen(false)
    try {
      await updatePreferences(nextPreferences)
    } finally {
      setIsSaving(false)
    }
  }

  const currentStep = GUIDE_STEPS[stepIndex]
  const isLastStep = stepIndex === GUIDE_STEPS.length - 1

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[1400] bg-black/80 backdrop-blur-md modal-safe-overlay flex items-center justify-center p-4">
      <div className="w-full max-w-4xl rounded-3xl border border-slate-700/50 bg-[#0A0F1C] text-white shadow-2xl modal-safe-panel flex flex-col md:flex-row overflow-hidden relative min-h-[500px]">

        {/* Close Button positioned absolutely */}
        <button
          type="button"
          onClick={() => markOnboardingSeen(true)}
          disabled={isSaving}
          className="absolute top-4 right-4 z-50 p-2.5 rounded-full bg-black/20 hover:bg-black/40 text-white/70 hover:text-white backdrop-blur-md transition-all disabled:opacity-50"
          aria-label="Skip onboarding"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Left Visual Area - Hidden on mobile, shown on md+ */}
        <div className={`hidden md:flex flex-col relative w-2/5 p-8 transition-colors duration-700 bg-gradient-to-br ${currentStep.color}`}>
          <div className="absolute inset-0 bg-black/10 backdrop-blur-2xl mix-blend-overlay" />
          <div className="absolute -top-24 -left-24 w-64 h-64 bg-white/20 rounded-full blur-3xl" />
          <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-black/40 rounded-full blur-3xl" />

          <div className="relative z-10 flex-1 flex flex-col items-center justify-center gap-6 mt-4">
            <div className="w-32 h-32 rounded-[2rem] bg-white/10 shadow-[0_0_40px_rgba(255,255,255,0.15)] backdrop-blur-xl flex items-center justify-center border border-white/20 transform transition-all duration-500 hover:rotate-6 hover:scale-105">
              <currentStep.mainIcon className="h-16 w-16 text-white drop-shadow-md" strokeWidth={1.5} />
            </div>
            {/* Progress dots */}
            <div className="flex gap-2 mt-8">
              {GUIDE_STEPS.map((_, i) => (
                <div key={i} className={`h-2 rounded-full transition-all duration-300 ${i === stepIndex ? 'w-8 bg-white' : 'w-2 bg-white/30'}`} />
              ))}
            </div>
          </div>
        </div>

        {/* Mobile-only visual header */}
        <div className={`md:hidden flex flex-col items-center justify-center h-48 w-full relative overflow-hidden bg-gradient-to-br ${currentStep.color} transition-colors duration-700`}>
          <div className="absolute inset-0 bg-black/10 backdrop-blur-2xl mix-blend-overlay" />
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/20 rounded-full blur-2xl" />
          <div className="relative z-10 w-20 h-20 rounded-2xl bg-white/10 shadow-lg backdrop-blur-xl flex items-center justify-center border border-white/20">
            <currentStep.mainIcon className="h-10 w-10 text-white drop-shadow-md" strokeWidth={1.5} />
          </div>
        </div>

        {/* Right Content Area */}
        <div className="flex-1 flex flex-col relative w-full md:w-3/5 bg-slate-900 md:bg-transparent">
          <div className="flex-1 px-6 py-8 md:p-12 flex flex-col justify-center">

            {/* Mobile Progress Dots */}
            <div className="flex md:hidden gap-1.5 mb-6">
              {GUIDE_STEPS.map((_, i) => (
                <div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${i === stepIndex ? 'w-6 bg-indigo-500' : 'w-1.5 bg-slate-700'}`} />
              ))}
            </div>

            <h2 className="text-3xl font-extrabold tracking-tight text-white mb-3">
              {currentStep.title}
            </h2>
            <p className="text-slate-400 text-lg mb-8 max-w-sm">
              {currentStep.subtitle}
            </p>

            <div className="space-y-4 mb-8">
              {currentStep.points.map((point, idx) => (
                <div key={idx} className="flex items-center gap-4 group">
                  <div className="flex-shrink-0 p-3 rounded-2xl bg-white/5 border border-white/10 group-hover:bg-white/10 group-hover:scale-110 transition-all duration-300">
                    <point.icon className="h-6 w-6 text-indigo-300 group-hover:text-indigo-200" strokeWidth={1.5} />
                  </div>
                  <span className="text-slate-200 font-medium text-lg leading-snug">
                    {point.text}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-auto pt-8 flex items-center justify-between border-t border-slate-800/80">
              <button
                type="button"
                onClick={() => setStepIndex((prev) => Math.max(0, prev - 1))}
                disabled={stepIndex === 0 || isSaving}
                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all duration-300 ${stepIndex === 0
                  ? 'opacity-0 pointer-events-none'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>

              <div className="flex items-center gap-3">
                {!isLastStep ? (
                  <button
                    type="button"
                    onClick={() => setStepIndex((prev) => Math.min(GUIDE_STEPS.length - 1, prev + 1))}
                    disabled={isSaving}
                    className="inline-flex items-center gap-2 group rounded-xl bg-white text-black px-6 py-3 font-semibold hover:bg-slate-200 transition-all duration-300 disabled:opacity-50"
                  >
                    Next
                    <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => markOnboardingSeen(false)}
                    disabled={isSaving}
                    className="inline-flex items-center gap-2 group rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-500 px-6 py-3 font-bold text-white shadow-lg shadow-indigo-500/25 hover:opacity-90 hover:scale-105 transition-all duration-300 disabled:opacity-50"
                  >
                    Finish Guide
                    <CheckCircle2 className="h-5 w-5" />
                  </button>
                )}
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  )
}

export default FirstTimeEducationModal

