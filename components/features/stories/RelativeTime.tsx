'use client'

import { useEffect, useState } from 'react'
import { formatDistanceToNowStrict } from 'date-fns'

const absolute = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

export default function RelativeTime({ iso, prefix = '' }: { iso: string; prefix?: string }) {
  const [label, setLabel] = useState(() => absolute(iso))

  useEffect(() => {
    const date = new Date(iso)
    const ageMs = Date.now() - date.getTime()
    setLabel(ageMs < 30 * 24 * 60 * 60 * 1000 ? `${formatDistanceToNowStrict(date)} ago` : absolute(iso))
  }, [iso])

  return (
    <time dateTime={iso} suppressHydrationWarning>
      {prefix}
      {label}
    </time>
  )
}
