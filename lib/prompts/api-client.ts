import * as rawAuth from '@/lib/core/supabase/raw-auth'

export async function promptApi<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await rawAuth.getValidAccessToken()
  if (!token) throw new Error('Please sign in to manage prompts.')

  const headers = new Headers(options.headers)
  headers.set('Content-Type', 'application/json')
  headers.set('Authorization', `Bearer ${token}`)

  const response = await fetch(path, {
    ...options,
    headers,
  })

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload?.error || 'Something went wrong. Please try again.')
  return payload as T
}
