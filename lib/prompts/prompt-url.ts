const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const UUID_SUFFIX_REGEX =
  /([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i

const MAX_SLUG_LENGTH = 80

type PromptUrlSource = { id: string; question?: string | null }

export function isUuid(value: string | null | undefined): boolean {
  if (!value) return false
  return UUID_REGEX.test(value.trim())
}

export function extractPromptIdFromRef(ref: string | null | undefined): string | null {
  if (!ref) return null

  const value = ref.trim()
  if (!value) return null
  if (isUuid(value)) return value

  const match = value.match(UUID_SUFFIX_REGEX)
  return match ? match[1] : null
}

export function slugifyPromptQuestion(question: string | null | undefined): string {
  if (!question) return 'ask'

  const normalized = question
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')

  if (!normalized) return 'ask'
  return normalized.slice(0, MAX_SLUG_LENGTH).replace(/-+$/g, '') || 'ask'
}

export function buildPromptRef(source: PromptUrlSource): string {
  const promptId = source.id?.trim()
  if (!promptId) return ''

  const slug = slugifyPromptQuestion(source.question)
  if (!slug || slug === 'ask') return promptId
  return `${slug}-${promptId}`
}

export function buildPromptPath(source: PromptUrlSource): string {
  const ref = buildPromptRef(source)
  return `/curiosity-ask/${ref || source.id}`
}

export function isCanonicalPromptRef(
  incomingRef: string | null | undefined,
  source: PromptUrlSource
): boolean {
  if (!incomingRef) return false
  return incomingRef.trim() === buildPromptRef(source)
}
