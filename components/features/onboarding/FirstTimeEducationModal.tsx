'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Crown,
  Lock,
  MessageSquare,
  PlusCircle,
  Shield,
  X,
} from 'lucide-react'
import { useUserStore } from '@/store/userStore'
import { UserPreferences } from '@/types'

const ONBOARDING_VERSION = '2026-02-thread-guide-v1'

type GuideStep = {
  id: string
  title: string
  subtitle: string
  points: string[]
  ctaLabel?: string
  ctaHref?: string
}

const GUIDE_STEPS: GuideStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to WhisprSpace',
    subtitle: 'This short guide helps new users navigate quickly.',
    points: [
      'Use Threads as your main hub for conversations.',
      'Use Inbox for direct messages and private conversations.',
      'Use Profile to control preferences and notification settings.',
    ],
    ctaLabel: 'Open Threads Feed',
    ctaHref: '/threads',
  },
  {
    id: 'create',
    title: 'Create Threads',
    subtitle: 'Start a thread from the create screen and pick a format.',
    points: [
      'Text thread: normal discussion with replies and reactions.',
      'Poll thread: add options, then let participants vote.',
      'Premium thread: set a price for paid access.',
    ],
    ctaLabel: 'Go To Create Thread',
    ctaHref: '/threads/create',
  },
  {
    id: 'privacy',
    title: 'Choose Thread Privacy',
    subtitle: 'Every thread should have the right visibility.',
    points: [
      'Public: anyone can discover and join.',
      'Private or Invite-only: access requires invitation.',
      'For private sharing, use the generated invite link in management.',
    ],
  },
  {
    id: 'premium',
    title: 'Understand Premium Threads',
    subtitle: 'Premium threads are paid-access conversations.',
    points: [
      'Set the price while creating or editing premium thread settings.',
      'Only confirmed payment unlocks full access.',
      'You can still grant free access using invite paths when needed.',
    ],
  },
  {
    id: 'manage',
    title: 'Manage Your Threads',
    subtitle: 'Use the thread sidebar and manage panel for controls.',
    points: [
      'Invite participants and manage membership.',
      'Lock, save, extend, or delete threads when necessary.',
      'Remove or moderate participants if rules are violated.',
    ],
    ctaLabel: 'Open My Threads',
    ctaHref: '/my-threads',
  },
  {
    id: 'messaging',
    title: 'Messaging And Mentions',
    subtitle: 'Stay active with mentions and realtime typing updates.',
    points: [
      'Type @ to mention participants quickly from the composer.',
      'Use notifications to track replies, mentions, invites, and updates.',
      'Typing indicators show who is actively writing in threads and DMs.',
    ],
  },
]

const stepIcons = [BookOpen, PlusCircle, Lock, Crown, Shield, MessageSquare]

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
  const Icon = stepIcons[stepIndex] || BookOpen
  const isLastStep = stepIndex === GUIDE_STEPS.length - 1

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[1400] bg-black/70 backdrop-blur-sm modal-safe-overlay flex items-center justify-center p-4">
      <div className="w-full max-w-3xl rounded-2xl border border-slate-700 bg-[#0E1422] text-white shadow-2xl modal-safe-panel overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-700 px-5 py-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-9 w-9 rounded-full bg-indigo-500/20 border border-indigo-400/40 flex items-center justify-center flex-shrink-0">
              <Icon className="h-4 w-4 text-indigo-300" />
            </div>
            <div className="min-w-0">
              <p className="text-sm text-slate-300">First-time guide</p>
              <p className="text-sm font-semibold truncate">
                Step {stepIndex + 1} of {GUIDE_STEPS.length}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => markOnboardingSeen(true)}
            disabled={isSaving}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/60 transition-colors disabled:opacity-50"
            aria-label="Skip onboarding"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 pt-4">
          <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-cyan-400 transition-all duration-300"
              style={{ width: `${((stepIndex + 1) / GUIDE_STEPS.length) * 100}%` }}
            />
          </div>
        </div>

        <div className="px-5 py-6">
          <h2 className="text-2xl font-bold">{currentStep.title}</h2>
          <p className="mt-2 text-slate-300">{currentStep.subtitle}</p>

          <div className="mt-5 space-y-3">
            {currentStep.points.map((point) => (
              <div
                key={point}
                className="rounded-lg border border-slate-700 bg-slate-900/40 px-3 py-2 text-sm text-slate-200"
              >
                {point}
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-slate-700 px-5 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setStepIndex((prev) => Math.max(0, prev - 1))}
              disabled={stepIndex === 0 || isSaving}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-600 px-3 py-2 text-sm text-slate-100 hover:bg-slate-700/50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>

            {currentStep.ctaHref && currentStep.ctaLabel && (
              <button
                type="button"
                onClick={() => router.push(currentStep.ctaHref!)}
                disabled={isSaving}
                className="inline-flex items-center gap-2 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-100 hover:bg-cyan-500/20"
              >
                {currentStep.ctaLabel}
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => markOnboardingSeen(true)}
              disabled={isSaving}
              className="rounded-lg border border-slate-600 px-3 py-2 text-sm text-slate-200 hover:bg-slate-700/50 disabled:opacity-50"
            >
              Skip Tour
            </button>

            {!isLastStep ? (
              <button
                type="button"
                onClick={() => setStepIndex((prev) => Math.min(GUIDE_STEPS.length - 1, prev + 1))}
                disabled={isSaving}
                className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-600 to-cyan-500 px-4 py-2 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-50"
              >
                Next
                <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => markOnboardingSeen(false)}
                disabled={isSaving}
                className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-green-600 to-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-50"
              >
                Finish Guide
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default FirstTimeEducationModal
