import { NextRequest, NextResponse } from 'next/server'

type RateLimitBucket = {
  count: number
  resetAt: number
}

type RateLimitInput = {
  request: NextRequest
  namespace: string
  max: number
  windowMs: number
  identifier?: string
}

type RateLimitResult =
  | { allowed: true; headers: HeadersInit }
  | { allowed: false; response: NextResponse }

declare global {
  // eslint-disable-next-line no-var
  var __whisprRateLimits: Map<string, RateLimitBucket> | undefined
}

const getStore = () => {
  if (!globalThis.__whisprRateLimits) {
    globalThis.__whisprRateLimits = new Map<string, RateLimitBucket>()
  }
  return globalThis.__whisprRateLimits
}

const cleanExpiredBuckets = (store: Map<string, RateLimitBucket>, now: number) => {
  if (store.size < 512) return
  for (const [key, bucket] of store.entries()) {
    if (bucket.resetAt <= now) {
      store.delete(key)
    }
  }
}

export const getClientIp = (request: NextRequest): string => {
  const xff = request.headers.get('x-forwarded-for')
  if (xff) {
    const first = xff.split(',')[0]?.trim()
    if (first) return first
  }

  const realIp = request.headers.get('x-real-ip')
  if (realIp) return realIp.trim()

  const cfIp = request.headers.get('cf-connecting-ip')
  if (cfIp) return cfIp.trim()

  return 'unknown'
}

const buildRateLimitHeaders = (max: number, remaining: number, resetSeconds: number): HeadersInit => ({
  'X-RateLimit-Limit': String(max),
  'X-RateLimit-Remaining': String(Math.max(0, remaining)),
  'X-RateLimit-Reset': String(resetSeconds),
  'Retry-After': String(resetSeconds),
})

export const enforceRateLimit = ({
  request,
  namespace,
  max,
  windowMs,
  identifier,
}: RateLimitInput): RateLimitResult => {
  const now = Date.now()
  const store = getStore()
  cleanExpiredBuckets(store, now)

  const resolvedIdentifier = identifier || getClientIp(request)
  const key = `${namespace}:${resolvedIdentifier}`
  const current = store.get(key)

  if (!current || current.resetAt <= now) {
    const resetAt = now + windowMs
    store.set(key, { count: 1, resetAt })
    const resetSeconds = Math.ceil(windowMs / 1000)
    return {
      allowed: true,
      headers: buildRateLimitHeaders(max, max - 1, resetSeconds),
    }
  }

  if (current.count >= max) {
    const resetSeconds = Math.max(1, Math.ceil((current.resetAt - now) / 1000))
    return {
      allowed: false,
      response: NextResponse.json(
        { error: 'Too many requests. Please try again shortly.' },
        {
          status: 429,
          headers: buildRateLimitHeaders(max, 0, resetSeconds),
        }
      ),
    }
  }

  current.count += 1
  store.set(key, current)

  const remaining = max - current.count
  const resetSeconds = Math.max(1, Math.ceil((current.resetAt - now) / 1000))
  return {
    allowed: true,
    headers: buildRateLimitHeaders(max, remaining, resetSeconds),
  }
}

export const withRateLimitHeaders = (response: NextResponse, headers: HeadersInit): NextResponse => {
  for (const [name, value] of Object.entries(headers)) {
    response.headers.set(name, value)
  }
  return response
}
