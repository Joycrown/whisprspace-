// Token cache to avoid repeated storage reads.
//
// IMPORTANT: this cache must never hand out an expired token. It previously
// read `supabase.auth.session` from localStorage with no expiry check, so after
// the access token lapsed every caller kept sending a dead JWT and got 401s
// (or silently degraded to the anon key) instead of triggering a refresh.
let cachedAccessToken: string | null = null;

const SESSION_KEY = 'supabase.auth.session';

/**
 * Set the access token directly (call this when you have a valid session).
 * This bypasses storage entirely for subsequent requests.
 */
export function setAccessToken(token: string | null) {
  cachedAccessToken = token;
}

/** Alias used by the auth layer after a successful refresh. */
export const setCachedAccessToken = setAccessToken;

function readSessionFromStorage(): { access_token?: string; expires_at?: number } | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem(SESSION_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch (e) {
    console.error('[AuthTokenCache] Failed to read token from storage:', e);
    return null;
  }
}

function isExpired(expiresAt?: number): boolean {
  if (!expiresAt) return false;
  return Date.now() / 1000 > expiresAt;
}

/**
 * Get a cached access token.
 *
 * Returns null when there is no token OR when the stored token has expired —
 * callers should treat null as "needs refresh" rather than "anonymous".
 * For an authenticated fetch, prefer `rawAuth.getValidAccessToken()`, which
 * refreshes instead of just reporting the problem.
 */
export function getAccessToken(): string | null {
  const session = readSessionFromStorage();

  // Storage is the source of truth for expiry. If it says the token is dead,
  // the in-memory copy is dead too.
  if (session && isExpired(session.expires_at)) {
    cachedAccessToken = null;
    return null;
  }

  if (cachedAccessToken) return cachedAccessToken;

  return session?.access_token || null;
}

/** Clear cached token (call this on logout). */
export function clearCachedToken() {
  cachedAccessToken = null;
}
