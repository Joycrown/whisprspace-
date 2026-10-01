'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { canGoBackInApp } from '@/lib/navigation/in-app-history'

interface BackButtonProps {
  fallbackHref: string
  label?: string
  className?: string
  iconClassName?: string
}

export default function BackButton({ fallbackHref, label = 'Back', className = '', iconClassName = 'h-3.5 w-3.5' }: BackButtonProps) {
  const router = useRouter()

  return (
    <Link
      href={fallbackHref}
      prefetch={false}
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return
        if (!canGoBackInApp()) return
        event.preventDefault()
        router.back()
      }}
      className={className}
    >
      <ArrowLeft className={iconClassName} />
      {label}
    </Link>
  )
}
