import type { AskSort } from './public-types'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export interface AskCursor {
  id: string
  ts?: string
  total?: number
}

const toBase64Url = (value: string) =>
  Buffer.from(value, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

const fromBase64Url = (value: string) =>
  Buffer.from(value.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')

export function encodeAskCursor(sort: AskSort, item: { id: string; created_at: string; reaction_total: number }): string {
  return toBase64Url(JSON.stringify(sort === 'felt' ? { id: item.id, total: item.reaction_total } : { id: item.id, ts: item.created_at }))
}

export function decodeAskCursor(sort: AskSort, raw: string | null): AskCursor | null {
  if (!raw || raw.length > 200) return null
  try {
    const parsed = JSON.parse(fromBase64Url(raw)) as Record<string, unknown>
    if (typeof parsed.id !== 'string' || !UUID_REGEX.test(parsed.id)) return null
    if (sort === 'felt') {
      return Number.isInteger(parsed.total) && (parsed.total as number) >= 0 ? { id: parsed.id, total: parsed.total as number } : null
    }
    return typeof parsed.ts === 'string' && parsed.ts.length <= 40 && !Number.isNaN(Date.parse(parsed.ts))
      ? { id: parsed.id, ts: parsed.ts }
      : null
  } catch {
    return null
  }
}
