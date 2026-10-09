import type { Prompt } from './types'

const PURGE_GRACE_DAYS = 3
const HOUR_MS = 60 * 60 * 1000

export function describePromptStatus(prompt: Pick<Prompt, 'expires_at' | 'is_saved' | 'mode'>): string {
  const visibility = prompt.mode === 'open' ? 'Public · ' : ''
  if (!prompt.expires_at) return `${visibility}Always open`

  const expiresAt = new Date(prompt.expires_at).getTime()
  const remaining = expiresAt - Date.now()
  if (remaining > 0) {
    const hours = Math.ceil(remaining / HOUR_MS)
    return `${visibility}${hours <= 48 ? `Closes in ${hours}h` : `Closes in ${Math.ceil(hours / 24)} days`}`
  }

  if (prompt.is_saved) return `${visibility}Closed · Saved`

  const untilPurge = expiresAt + PURGE_GRACE_DAYS * 24 * HOUR_MS - Date.now()
  if (untilPurge <= 0) return `${visibility}Closed`

  const purgeHours = Math.ceil(untilPurge / HOUR_MS)
  return `${visibility}Closed · Clears in ${purgeHours >= 24 ? `${Math.ceil(purgeHours / 24)}d` : `${purgeHours}h`}`
}
