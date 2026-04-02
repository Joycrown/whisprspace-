/**
 * WhisprSpace Content Moderation — Keyword Filter
 *
 * This is a starting foundation. Expand it over time based on
 * real patterns you see in the admin report queue.
 *
 * Philosophy: catch clear harm, not uncomfortable honesty.
 * Profanity, controversy, and difficult topics are NOT blocked
 * here — those belong to the community report system.
 * This filter only catches content that is unambiguously harmful.
 */

// Exact phrase matches (case-insensitive)
export const BLOCKED_TERMS: string[] = [
  // Self-harm and suicide — highest priority
  'kill yourself',
  'kys',
  'end your life',
  'commit suicide',
  'slit your wrists',
  'hang yourself',
  'take all the pills',
  'overdose on',
  'jump off a',

  // Targeted threats
  'i will kill you',
  'i will find you',
  'i know where you live',
  'you deserve to die',
  'i hope you die',
  'i hope you get raped',
  'i will hurt you',
  'watch your back',

  // Doxxing
  'your address is',
  "i found your address",
  'sharing your location',
  'posting your info',
]

// Regex patterns for obfuscated or varied forms
export const BLOCKED_PATTERNS: RegExp[] = [
  /\bk+[\s.*_-]*y+[\s.*_-]*s+\b/i,          // kys variations with spacing/symbols
  /\bdie\s+(slow|fast|painful|alone)\b/i,
  /\bswat(t?ing)?\b/i,                        // swatting threats
  /\bbomb\s+threat\b/i,
  /\bkill\s+(ur|your|them|him|her)self\b/i,
]

export interface BlockResult {
  blocked: boolean
  reason?: 'harmful_language'
}

/**
 * Check text against the blocklist.
 * Checks both title and content — call with combined text for threads.
 */
export function containsBlockedContent(text: string): BlockResult {
  if (!text || !text.trim()) return { blocked: false }

  const normalised = text.toLowerCase()

  for (const term of BLOCKED_TERMS) {
    if (normalised.includes(term.toLowerCase())) {
      return { blocked: true, reason: 'harmful_language' }
    }
  }

  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(normalised)) {
      return { blocked: true, reason: 'harmful_language' }
    }
  }

  return { blocked: false }
}
