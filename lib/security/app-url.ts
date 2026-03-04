import { NextRequest } from 'next/server'

const normalizeUrl = (raw: string): string | null => {
  const trimmed = String(raw || '').trim()
  if (!trimmed) return null

  try {
    const parsed = new URL(trimmed)
    return `${parsed.protocol}//${parsed.host}`
  } catch {
    if (/^localhost(?::\d+)?$/i.test(trimmed)) {
      return `http://${trimmed}`
    }
    if (/^[a-z0-9.-]+\.[a-z]{2,}(?::\d+)?$/i.test(trimmed)) {
      return `https://${trimmed}`
    }
    return null
  }
}

const getAllowedOrigins = (): string[] => {
  const sources = [process.env.ALLOWED_APP_ORIGINS, process.env.NEXT_PUBLIC_SITE_URL]
  const parsed = sources
    .flatMap((value) => String(value || '').split(','))
    .map((value) => normalizeUrl(value))
    .filter((value): value is string => Boolean(value))

  return [...new Set(parsed)]
}

export const getTrustedAppBaseUrl = (request: NextRequest): string => {
  const configured =
    normalizeUrl(process.env.NEXT_PUBLIC_APP_URL || '') ||
    normalizeUrl(process.env.APP_URL || '') ||
    normalizeUrl(process.env.SITE_URL || '')

  if (configured) {
    return configured
  }

  const requestOrigin = normalizeUrl(request.headers.get('origin') || '')
  if (!requestOrigin) {
    return process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : ''
  }

  if (process.env.NODE_ENV !== 'development') {
    const allowlist = getAllowedOrigins()
    if (allowlist.length > 0 && !allowlist.includes(requestOrigin)) {
      return ''
    }
  }

  return requestOrigin
}
