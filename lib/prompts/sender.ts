import { createHash } from 'crypto'
import type { NextRequest } from 'next/server'

export const SENDER_TOKEN_COOKIE = 'whs_sit'
export const VIEWER_TOKEN_COOKIE = 'whs_vid'

export const hashValue = (value: string) => createHash('sha256').update(value).digest('hex')

export function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-real-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown'
  )
}

export function getSenderTokenHash(request: NextRequest): string | null {
  const token = request.cookies.get(SENDER_TOKEN_COOKIE)?.value
  return token && token.length >= 32 ? hashValue(token) : null
}
