'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ThreadSummaryCard } from '@/components/features/threads/ThreadSummaryCard'
import { useUserStore } from '@/store/userStore'
import * as rawAuth from '@/lib/core/supabase/raw-auth'
import { Loader2 } from 'lucide-react'

interface ThreadSummary {
  id: string
  thread_id: string
  participant_count: number
  perspective_count: number
  reaction_count: number
  duration_hours: number
  created_at: string
}

export default function SummaryPage() {
  const params = useParams()
  const router = useRouter()
  const summaryId = params.summaryId as string
  const { session, sessionValidated } = useUserStore()

  const [summary, setSummary] = useState<ThreadSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!sessionValidated) return

    if (!session?.user?.id) {
      router.replace('/auth')
      return
    }

    const fetchSummary = async () => {
      try {
        const token = await rawAuth.getValidAccessToken()

        if (!token) {
          router.replace('/auth')
          return
        }

        const res = await fetch(`/api/summaries/${summaryId}`, {
          headers: { Authorization: `Bearer ${token}` },
        })

        if (!res.ok) {
          setNotFound(true)
          setLoading(false)
          return
        }

        const { summary: data } = await res.json()
        setSummary(data)
      } catch {
        setNotFound(true)
      } finally {
        setLoading(false)
      }
    }

    fetchSummary()
  }, [sessionValidated, session?.user?.id, summaryId, router])

  if (!sessionValidated || loading) {
    return (
      <div className="min-h-screen bg-[#0d0d0d] flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-gray-600 animate-spin" />
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-[#0d0d0d] flex items-center justify-center p-6 text-center">
        <div>
          <p className="text-gray-600 text-sm tracking-widest uppercase mb-4"
             style={{ fontFamily: 'monospace' }}>WhisprSpace</p>
          <p className="text-white text-xl mb-2">This summary doesn't exist.</p>
          <p className="text-gray-600 text-sm">It may belong to a different account.</p>
        </div>
      </div>
    )
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 md:p-8 relative overflow-hidden"
      style={{ backgroundColor: 'var(--color-bg-primary)' }}
    >
      {/* Atmospheric glow — same language as the modal */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 70% 50% at 50% 30%, rgba(109,40,217,0.12) 0%, transparent 65%)',
        }}
      />
      <div className="relative w-full">
        {summary && <ThreadSummaryCard summary={summary} />}
      </div>
    </div>
  )
}
