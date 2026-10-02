const percentEncode = (char: string) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`

// Chat apps cut emoji, ! ' ( ) * and trailing . ~ out of auto-detected links,
// so a handle like "A☠️A." would open a different inbox. Encoding them keeps
// the whole handle inside the link; the /message page decodes it back.
export function encodeInboxHandle(handle: string): string {
  return encodeURIComponent(handle.trim())
    .replace(/[!'()*]/g, percentEncode)
    .replace(/[.~]+$/, (tail) => tail.split('').map(percentEncode).join(''))
}

export function buildInboxPath(handle: string): string {
  return `/message/${encodeInboxHandle(handle)}`
}

export function displayInboxUrl(url: string): string {
  const withoutProtocol = url.replace(/^https?:\/\//, '')
  try {
    return decodeURIComponent(withoutProtocol)
  } catch {
    return withoutProtocol
  }
}
