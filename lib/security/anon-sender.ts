import { createHash, randomBytes } from 'crypto'
import type { NextRequest, NextResponse } from 'next/server'

export const SENDER_TOKEN_COOKIE = 'whs_sit'
const SENDER_TOKEN_TTL_DAYS = 90
const TOKEN_REGEX = /^[a-f0-9]{64}$/

export const sha256 = (value: string) => createHash('sha256').update(value).digest('hex')

export function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-real-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown'
  )
}

export function readSenderToken(request: NextRequest): string | null {
  const value = request.cookies.get(SENDER_TOKEN_COOKIE)?.value
  return value && TOKEN_REGEX.test(value) ? value : null
}

export function resolveSenderIdentity(request: NextRequest) {
  const existing = readSenderToken(request)
  const token = existing ?? randomBytes(32).toString('hex')
  return {
    token,
    isNew: !existing,
    tokenHash: sha256(token),
    ipHash: sha256(getClientIp(request)),
  }
}

export function setSenderTokenCookie(response: NextResponse, token: string) {
  const expires = new Date()
  expires.setDate(expires.getDate() + SENDER_TOKEN_TTL_DAYS)
  response.cookies.set(SENDER_TOKEN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires,
    path: '/',
  })
}
