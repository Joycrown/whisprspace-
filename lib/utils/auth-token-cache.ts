let cachedAccessToken: string | null = null;

const SESSION_KEY = 'supabase.auth.session';

export function setAccessToken(token: string | null) {
  cachedAccessToken = token;
}

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

export function getAccessToken(): string | null {
  const session = readSessionFromStorage();

  if (session && isExpired(session.expires_at)) {
    cachedAccessToken = null;
    return null;
  }

  if (cachedAccessToken) return cachedAccessToken;

  return session?.access_token || null;
}

export function clearCachedToken() {
  cachedAccessToken = null;
}
