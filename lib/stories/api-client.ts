import * as rawAuth from '@/lib/core/supabase/raw-auth'

export class StoriesApiError extends Error {
  status: number
  code?: string
  details?: unknown

  constructor(message: string, status: number, code?: string, details?: unknown) {
    super(message)
    this.status = status
    this.code = code
    this.details = details
  }
}

export async function storiesApi<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await rawAuth.getValidAccessToken().catch(() => null)
  const headers = new Headers(options.headers)
  headers.set('Content-Type', 'application/json')
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const response = await fetch(path, { ...options, headers, credentials: 'same-origin' })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new StoriesApiError(payload?.error || 'Something went wrong. Please try again.', response.status, payload?.code, payload)
  }
  return payload as T
}

export function authRedirectPath(view: 'signup' | 'login', returnTo: string): string {
  const params = new URLSearchParams({ force: '1', view, reason: 'story', redirect: returnTo })
  return `/auth?${params.toString()}`
}
