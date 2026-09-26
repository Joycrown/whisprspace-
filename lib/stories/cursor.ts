import type { StorySort } from './types'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export interface FeedCursor {
  id: string
  ts?: string
  count?: number
}

export interface ReplyCursor {
  id: string
  ts: string
}

const toBase64Url = (value: string) =>
  Buffer.from(value, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

const fromBase64Url = (value: string) =>
  Buffer.from(value.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')

const isValidTimestamp = (value: unknown): value is string =>
  typeof value === 'string' && value.length <= 40 && !Number.isNaN(Date.parse(value))

export function encodeFeedCursor(sort: StorySort, item: { id: string; last_episode_at: string; reply_count: number }): string {
  return toBase64Url(JSON.stringify(sort === 'discussed' ? { id: item.id, count: item.reply_count } : { id: item.id, ts: item.last_episode_at }))
}

export function decodeFeedCursor(sort: StorySort, raw: string | null): FeedCursor | null {
  if (!raw || raw.length > 200) return null
  try {
    const parsed = JSON.parse(fromBase64Url(raw)) as Record<string, unknown>
    if (typeof parsed.id !== 'string' || !UUID_REGEX.test(parsed.id)) return null
    if (sort === 'discussed') {
      return Number.isInteger(parsed.count) && (parsed.count as number) >= 0 ? { id: parsed.id, count: parsed.count as number } : null
    }
    return isValidTimestamp(parsed.ts) ? { id: parsed.id, ts: parsed.ts } : null
  } catch {
    return null
  }
}

export function encodeReplyCursor(item: { id: string; created_at: string }): string {
  return toBase64Url(JSON.stringify({ id: item.id, ts: item.created_at }))
}

export function decodeReplyCursor(raw: string | null): ReplyCursor | null {
  if (!raw || raw.length > 200) return null
  try {
    const parsed = JSON.parse(fromBase64Url(raw)) as Record<string, unknown>
    if (typeof parsed.id !== 'string' || !UUID_REGEX.test(parsed.id) || !isValidTimestamp(parsed.ts)) return null
    return { id: parsed.id, ts: parsed.ts }
  } catch {
    return null
  }
}
