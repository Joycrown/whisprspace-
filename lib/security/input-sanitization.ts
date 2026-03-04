const CONTROL_CHARS_REGEX = /[\u0000-\u001F\u007F]/g
const CONTROL_CHARS_ALLOW_NEWLINES_REGEX = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g
const WHITESPACE_RUN_REGEX = /\s+/g
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const toStringValue = (value: unknown): string => {
  if (typeof value === 'string') return value
  if (value === null || value === undefined) return ''
  return String(value)
}

const clampLength = (value: string, maxLength: number): string =>
  value.length > maxLength ? value.slice(0, maxLength) : value

export const sanitizeSingleLineInput = (
  value: unknown,
  options?: {
    maxLength?: number
    trim?: boolean
    collapseWhitespace?: boolean
  }
): string => {
  const maxLength = options?.maxLength ?? 1024
  const trim = options?.trim ?? true
  const collapseWhitespace = options?.collapseWhitespace ?? true

  let next = toStringValue(value).replace(CONTROL_CHARS_REGEX, '')
  next = next.replace(/\r?\n/g, ' ')

  if (collapseWhitespace) {
    next = next.replace(WHITESPACE_RUN_REGEX, ' ')
  }

  if (trim) {
    next = next.trim()
  }

  return clampLength(next, maxLength)
}

export const sanitizeMultilineInput = (
  value: unknown,
  options?: {
    maxLength?: number
    trim?: boolean
  }
): string => {
  const maxLength = options?.maxLength ?? 5000
  const trim = options?.trim ?? true

  let next = toStringValue(value)
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(CONTROL_CHARS_ALLOW_NEWLINES_REGEX, '')

  if (trim) {
    next = next.trim()
  }

  return clampLength(next, maxLength)
}

export const sanitizeEmailAddress = (value: unknown): string | null => {
  const email = sanitizeSingleLineInput(value, {
    maxLength: 320,
    trim: true,
    collapseWhitespace: true,
  }).toLowerCase()

  if (!email || !EMAIL_REGEX.test(email)) {
    return null
  }

  return email
}

export const sanitizePasswordInput = (value: unknown, maxLength = 256): string => {
  const raw = toStringValue(value)
  const withoutNullBytes = raw.replace(/\u0000/g, '')
  return clampLength(withoutNullBytes, maxLength)
}

export const sanitizeUuid = (value: unknown): string | null => {
  const candidate = sanitizeSingleLineInput(value, {
    maxLength: 64,
    trim: true,
    collapseWhitespace: true,
  })

  return UUID_REGEX.test(candidate) ? candidate : null
}

export const sanitizeHttpUrl = (
  value: unknown,
  options?: { maxLength?: number; allowRelative?: boolean }
): string | null => {
  const maxLength = options?.maxLength ?? 2048
  const allowRelative = options?.allowRelative ?? false

  const candidate = sanitizeSingleLineInput(value, {
    maxLength,
    trim: true,
    collapseWhitespace: false,
  })

  if (!candidate) return null

  if (allowRelative && candidate.startsWith('/')) {
    return candidate
  }

  try {
    const parsed = new URL(candidate)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null
    }
    return parsed.toString()
  } catch {
    return null
  }
}

export const sanitizeEnumValue = <T extends string>(
  value: unknown,
  allowedValues: readonly T[],
  fallback: T
): T => {
  const candidate = sanitizeSingleLineInput(value, { maxLength: 64 }).toLowerCase()
  return (allowedValues.find((allowed) => allowed.toLowerCase() === candidate) || fallback) as T
}

export const escapeHtml = (value: unknown): string =>
  toStringValue(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
