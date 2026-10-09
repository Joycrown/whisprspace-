'use client'

import { useEffect } from 'react'

export default function AskViewBeacon({ askId }: { askId: string }) {
  useEffect(() => {
    const storageKey = `ask-viewed:${askId}`
    try {
      if (localStorage.getItem(storageKey)) return
    } catch {}

    fetch(`/api/prompts/${askId}/view`, { method: 'POST', keepalive: true })
      .then((response) => {
        if (!response.ok) return
        try {
          localStorage.setItem(storageKey, '1')
        } catch {}
      })
      .catch(() => {})
  }, [askId])

  return null
}
