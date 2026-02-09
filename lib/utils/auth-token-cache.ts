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
  return cachedAccessToken;
}

/**
 * Clear cached token (call this on logout)
 */
export function clearCachedToken() {
  cachedAccessToken = null;

}
