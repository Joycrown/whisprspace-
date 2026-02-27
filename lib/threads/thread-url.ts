import type { Thread, ThreadData } from '@/types'

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const UUID_SUFFIX_REGEX =
  /([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i

const MAX_SLUG_LENGTH = 80

type ThreadUrlSource =
  | Pick<Thread, 'id' | 'title'>
  | Pick<ThreadData, 'id' | 'title'>
  | { id: string; title?: string | null }

export function isUuid(value: string | null | undefined): boolean {
  if (!value) return false
  return UUID_REGEX.test(value.trim())
}

export function extractThreadIdFromRef(ref: string | null | undefined): string | null {
  if (!ref) return null

  const value = ref.trim()
  if (!value) return null
  if (isUuid(value)) return value

  const match = value.match(UUID_SUFFIX_REGEX)
  return match ? match[1] : null
}

export function slugifyThreadTitle(title: string | null | undefined): string {
  if (!title) return 'thread'

  const normalized = title
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')

  if (!normalized) return 'thread'
  return normalized.slice(0, MAX_SLUG_LENGTH).replace(/-+$/g, '') || 'thread'
}

export function buildThreadRef(source: ThreadUrlSource): string {
  const threadId = source.id?.trim()
  if (!threadId) return ''

  const slug = slugifyThreadTitle(source.title)
  if (!slug || slug === 'thread') return threadId
  return `${slug}-${threadId}`
}

export function buildThreadPath(source: ThreadUrlSource): string {
  const threadRef = buildThreadRef(source)
  return `/threads/${threadRef || source.id}`
}

export function buildThreadManagePath(source: ThreadUrlSource): string {
  return `${buildThreadPath(source)}/manage`
}

export function isCanonicalThreadRef(
  incomingRef: string | null | undefined,
  source: ThreadUrlSource
): boolean {
  if (!incomingRef) return false
  return incomingRef.trim() === buildThreadRef(source)
}
