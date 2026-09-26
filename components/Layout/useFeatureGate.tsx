'use client'

import { useCallback, useMemo, useState } from 'react'
import { useUserStore } from '@/store/userStore'
import { gateFor as resolveGate, type GatedFeature, type NavViewer } from '@/lib/navigation/feature-gates'
import FeatureGateSheet from './FeatureGateSheet'
import CreateSheet from './CreateSheet'

export function useFeatureGate() {
  const session = useUserStore((state) => state.session)
  const sessionValidated = useUserStore((state) => state.sessionValidated)
  const [gate, setGate] = useState<GatedFeature | null>(null)
  const [createOpen, setCreateOpen] = useState(false)

  const viewer = useMemo<NavViewer>(() => ({
    hasSession: Boolean(session.isAuthenticated && session.user),
    isRegistered: Boolean(sessionValidated && session.isAuthenticated && session.user && !session.user.isAnonymous),
  }), [session.isAuthenticated, session.user, sessionValidated])

  const gateFor = useCallback((feature: GatedFeature) => resolveGate(feature, viewer), [viewer])

  const guard = useCallback((feature: GatedFeature, event?: { preventDefault: () => void }) => {
    const blocked = resolveGate(feature, viewer)
    if (!blocked) return false
    event?.preventDefault()
    setGate(blocked)
    return true
  }, [viewer])

  const sheets = (
    <>
      {createOpen && <CreateSheet onClose={() => setCreateOpen(false)} onGate={setGate} gateFor={gateFor} />}
      {gate && <FeatureGateSheet feature={gate} onClose={() => setGate(null)} />}
    </>
  )

  return { viewer, guard, openCreate: () => setCreateOpen(true), sheets }
}
