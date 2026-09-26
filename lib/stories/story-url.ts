const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const UUID_SUFFIX_REGEX = /([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i
const MAX_SLUG_LENGTH = 70

type StoryUrlSource = { id: string; title?: string | null }

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

export function extractStoryIdFromRef(ref: string | null | undefined): string | null {
  if (!ref) return null
  const value = safeDecode(ref).trim()
  if (UUID_REGEX.test(value)) return value
  const match = value.match(UUID_SUFFIX_REGEX)
  return match ? match[1] : null
}

export function slugifyStoryTitle(title: string | null | undefined): string {
  if (!title) return ''
  return title
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/g, '')
}

export function buildStoryRef(source: StoryUrlSource): string {
  const slug = slugifyStoryTitle(source.title)
  return slug ? `${slug}-${source.id}` : source.id
}

export function buildStoryPath(source: StoryUrlSource): string {
  return `/stories/${buildStoryRef(source)}`
}

export function isCanonicalStoryRef(ref: string, source: StoryUrlSource): boolean {
  return safeDecode(ref).trim() === buildStoryRef(source)
}
