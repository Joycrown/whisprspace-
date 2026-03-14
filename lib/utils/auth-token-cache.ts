// Token cache to avoid repeated SDK calls
let cachedAccessToken: string | null = null;

/**
 * Set the access token directly (call this when you have a valid session)
 * This bypasses the SDK entirely for subsequent requests
 */
export function setAccessToken(token: string | null) {
  cachedAccessToken = token;

}

/**
 * Get cached access token
 * Returns null if no token is cached
 */
export function getAccessToken(): string | null {
  if (cachedAccessToken) return cachedAccessToken;

  // Fallback to localStorage if in browser
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('supabase.auth.session');
      if (stored) {
        const session = JSON.parse(stored);
        return session?.access_token || null;
      }
    } catch (e) {
      console.error('[AuthTokenCache] Failed to read token from storage:', e);
    }
  }

  return null;
}

/**
 * Clear cached token (call this on logout)
 */
export function clearCachedToken() {
  cachedAccessToken = null;

}
