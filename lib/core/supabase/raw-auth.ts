/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Raw Supabase Authentication API
 * Replaces @supabase/supabase-js auth methods with direct API calls
 */
import { hasRequiredLegalConsent, LEGAL_CONSENT_REQUIRED_ERROR } from '@/lib/legal/consent'
import { clearCachedToken } from '@/lib/utils/auth-token-cache'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const ACCOUNT_EXISTS_ERROR = 'Account already exists';

interface Session {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  expires_at: number;
  user: {
    id: string;
    email?: string;
    is_anonymous?: boolean;
    [key: string]: any;
  };
}

interface AuthResponse {
  session: Session | null;
  user: Session['user'] | null;
  error: Error | null;
}

interface AnonymousSignInOptions {
  requireLegalConsent?: boolean;
}

const SESSION_KEY = 'supabase.auth.session';
const ANON_SESSION_KEY = 'supabase.auth.anon_session';

/** Read the persisted anonymous session (survives registered sign-ins overwriting the primary slot). */
function readStoredAnonSession(): Session | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(ANON_SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

function getAuthHeaders(): Record<string, string> {
  return {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
  };
}

const readStoredSession = (): Session | null => {
  if (typeof window === 'undefined') return null;

  try {
    const stored = localStorage.getItem(SESSION_KEY);
    if (!stored) return null;

    const session: Session = JSON.parse(stored);

    // If session is malformed (no access token), clear it
    if (!session?.access_token) {
      console.warn('[RawAuth] Session missing access token, clearing');
      saveSession(null);
      return null;
    }

    return session;
  } catch (err) {
    console.error('[RawAuth] Failed to read session:', err);
    return null;
  }
};

export const isSessionExpired = (session: Session | null): boolean => {
  if (!session?.expires_at) return false;
  return Date.now() / 1000 > session.expires_at;
};

/**
 * Get current session from localStorage
 */
export function getSession(): Session | null {
  const session = readStoredSession();
  if (!session) return null;

  if (isSessionExpired(session)) {
    return null;
  }

  return session;
}

const parseAuthErrorMessage = async (res: Response, fallback: string): Promise<string> => {
  let payload: Record<string, unknown> | null = null;

  try {
    payload = await res.json();
  } catch {
    // Ignore parse errors and fall back below.
  }

  const rawMessage = String(
    payload?.error_description ??
      payload?.message ??
      payload?.msg ??
      payload?.error ??
      ''
  );

  const normalized = rawMessage.toLowerCase();
  const code = String(payload?.error_code || payload?.code || '').toLowerCase();

  if (
    res.status === 422 &&
    (
      normalized.includes('already') ||
      normalized.includes('registered') ||
      normalized.includes('exists') ||
      code.includes('already') ||
      code.includes('registered') ||
      code.includes('exists')
    )
  ) {
    return ACCOUNT_EXISTS_ERROR;
  }

  return rawMessage || fallback;
};

/**
 * Get stored session (even if expired).
 * Useful for refresh flows.
 */
export function getStoredSession(): Session | null {
  return readStoredSession();
}

/**
 * Save session to localStorage.
 * Anonymous sessions are also persisted to a separate key so they survive
 * a registered sign-in overwriting the primary session slot.
 */
function saveSession(session: Session | null) {
  if (typeof window === 'undefined') return;

  if (session) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    if (session.user?.is_anonymous) {
      localStorage.setItem(ANON_SESSION_KEY, JSON.stringify(session));
    }
  } else {
    localStorage.removeItem(SESSION_KEY);
  }
}

/**
 * Inject a pre-built session into localStorage and emit SIGNED_IN.
 * Used by the claim flow: the server mints a session via the admin API,
 * returns it to the browser, and the claim page calls this to log the user in
 * without going through a normal signIn() call.
 */
export function setSession(session: Session): void {
  saveSession(session);
  emitAuthEvent('SIGNED_IN', session);
  if (session.expires_in) {
    scheduleTokenRefresh(session.expires_in);
  }
}

/**
 * Sign in with email and password
 */
export async function signIn(email: string, password: string): Promise<AuthResponse> {
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const errorMessage = await parseAuthErrorMessage(res, 'Sign in failed');
      throw new Error(errorMessage);
    }

    const data = await res.json();
    const session: Session = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_in: data.expires_in,
      expires_at: Math.floor(Date.now() / 1000) + data.expires_in,
      user: data.user,
    };

    saveSession(session);
    emitAuthEvent('SIGNED_IN', session);
    
    // Set up auto-refresh
    scheduleTokenRefresh(session.expires_in);
    
    return { session, user: session.user, error: null };
  } catch (error: any) {
    console.error('[RawAuth] Sign in error:', error);
    return { session: null, user: null, error };
  }
}


/**
 * Sign up with email and password
 */
export async function signUp(email: string, password: string): Promise<AuthResponse> {
  try {
    if (!hasRequiredLegalConsent()) {
      throw new Error(LEGAL_CONSENT_REQUIRED_ERROR)
    }

    const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const errorMessage = await parseAuthErrorMessage(res, 'Sign up failed');
      throw new Error(errorMessage);
    }

    const data = await res.json();
    
    // Check if email confirmation is required
    if (!data.access_token) {
      // Email confirmation required
      return { 
        session: null, 
        user: data.user, 
        error: new Error('Please check your email to confirm your account') 
      };
    }

    const session: Session = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_in: data.expires_in,
      expires_at: Math.floor(Date.now() / 1000) + data.expires_in,
      user: data.user,
    };

    saveSession(session);
    emitAuthEvent('SIGNED_IN', session);
    scheduleTokenRefresh(session.expires_in);

    return { session, user: session.user, error: null };
  } catch (error: any) {
    console.error('[RawAuth] Sign up error:', error);
    return { session: null, user: null, error };
  }
}

/**
 * Sign in anonymously.
 *
 * Returns the same anonymous account across visits on the same device by
 * attempting to restore the stored session before creating a new one:
 *   1. Valid stored session → return it directly (no network call).
 *   2. Expired access token but valid refresh token → refresh and return.
 *   3. No session / refresh failed → create a fresh anonymous user.
 */
export async function signInAnonymously(options: AnonymousSignInOptions = {}): Promise<AuthResponse> {
  try {
    const requireLegalConsent = options.requireLegalConsent !== false;
    if (requireLegalConsent && !hasRequiredLegalConsent()) {
      throw new Error(LEGAL_CONSENT_REQUIRED_ERROR)
    }

    // ── Attempt to restore the previous anonymous session ─────────────────────
    // Check primary slot first, then the dedicated anon slot (survives registered sign-ins).
    const primarySession = readStoredSession();
    const storedSession: Session | null =
      primarySession?.user?.is_anonymous ? primarySession : readStoredAnonSession();

    if (storedSession?.user?.is_anonymous) {
      if (!isSessionExpired(storedSession)) {
        // Access token still valid — reuse it, no network call needed
        emitAuthEvent('SIGNED_IN', storedSession);
        scheduleTokenRefresh(storedSession.expires_in);
        return { session: storedSession, user: storedSession.user, error: null };
      }

      // Access token expired — try the refresh token (valid for up to 60 days)
      const refreshed = await refreshToken();
      if (refreshed.session) {
        // Same anonymous user, new access token
        return refreshed;
      }
      // Refresh failed (token rotated away or truly expired) — fall through to create new
    }

    // ── No restorable session — create a new anonymous user ───────────────────
    const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ data: {} }),
    });

    if (!res.ok) {
      const errorMessage = await parseAuthErrorMessage(res, 'Anonymous sign in failed');
      throw new Error(errorMessage);
    }

    const data = await res.json();

    if (!data.access_token) {
      throw new Error('Anonymous sign-in failed: no access token returned. Ensure anonymous sign-ins are enabled in Supabase Auth settings.');
    }

    const session: Session = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_in: data.expires_in,
      expires_at: Math.floor(Date.now() / 1000) + data.expires_in,
      user: { ...data.user, is_anonymous: true },
    };

    saveSession(session);
    emitAuthEvent('SIGNED_IN', session);
    scheduleTokenRefresh(session.expires_in);

    return { session, user: session.user, error: null };
  } catch (error: any) {
    console.error('[RawAuth] Anonymous sign in error:', error);
    return { session: null, user: null, error };
  }
}

/**
 * Sign out
 */
export async function signOut(): Promise<{ error: Error | null }> {
  try {
    const session = getSession();
    
    if (session) {
      // Call logout endpoint (optional - just for cleanup on backend)
      await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Authorization': `Bearer ${session.access_token}`,
        },
      }).catch(() => {
        // Ignore errors - we're logging out anyway
      });
    }

    saveSession(null);
    if (typeof window !== 'undefined') localStorage.removeItem(ANON_SESSION_KEY);
    clearCachedToken();
    emitAuthEvent('SIGNED_OUT', null);
    cancelTokenRefresh();

    return { error: null };
  } catch (error: any) {
    console.error('[RawAuth] Sign out error:', error);
    return { error };
  }
}

// Mutex: if a refresh is already in-flight, return the same promise instead of
// firing a second request. This prevents the race condition between AuthProvider
// and the module-level init both calling refreshToken() simultaneously, which
// causes the second caller to consume an already-rotated refresh token and
// trigger an unintended SIGNED_OUT.
let _refreshInProgress: Promise<AuthResponse> | null = null;

/**
 * Refresh access token
 */
export function refreshToken(): Promise<AuthResponse> {
  if (_refreshInProgress) return _refreshInProgress;

  _refreshInProgress = _doRefresh().finally(() => {
    _refreshInProgress = null;
  });

  return _refreshInProgress;
}

async function _doRefresh(): Promise<AuthResponse> {
  try {
    const session = readStoredSession();

    if (!session?.refresh_token) {
      throw new Error('No refresh token available');
    }

    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ refresh_token: session.refresh_token }),
    });

    if (!res.ok) {
      const errorMessage = await parseAuthErrorMessage(res, 'Token refresh failed');
      throw new Error(errorMessage);
    }

    const data = await res.json();
    const newSession: Session = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_in: data.expires_in,
      expires_at: Math.floor(Date.now() / 1000) + data.expires_in,
      user: data.user,
    };

    saveSession(newSession);
    emitAuthEvent('TOKEN_REFRESHED', newSession);
    scheduleTokenRefresh(newSession.expires_in);

    return { session: newSession, user: newSession.user, error: null };
  } catch (error: any) {
    console.error('[RawAuth] Token refresh error:', error);
    saveSession(null);
    emitAuthEvent('SIGNED_OUT', null);
    return { session: null, user: null, error };
  }
}

// Auth event listeners
type AuthEvent = 'SIGNED_IN' | 'SIGNED_OUT' | 'TOKEN_REFRESHED';
type AuthCallback = (event: AuthEvent, session: Session | null) => void;

const authListeners: Set<AuthCallback> = new Set();

export function onAuthStateChange(callback: AuthCallback): () => void {
  authListeners.add(callback);
  
  // Immediately call with current state
  const session = getSession();
  if (session) {
    callback('SIGNED_IN', session);
  }
  
  return () => {
    authListeners.delete(callback);
  };
}

function emitAuthEvent(event: AuthEvent, session: Session | null) {
  authListeners.forEach(callback => callback(event, session));
}

// Auto token refresh
let refreshTimer: NodeJS.Timeout | null = null;

function scheduleTokenRefresh(expiresIn: number) {
  cancelTokenRefresh();
  
  // Refresh 5 minutes before expiry
  const refreshIn = Math.max((expiresIn - 300) * 1000, 60000); // At least 1 minute
  

  
  refreshTimer = setTimeout(() => {

    refreshToken();
  }, refreshIn);
}

function cancelTokenRefresh() {
  if (refreshTimer) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }
}

// Initialize on module load — only schedule the refresh timer for non-expired
// sessions. Expired sessions are handled exclusively by AuthProvider's
// validateSessionFromBackend, which has proper retry and redirect logic.
// Having both call refreshToken() simultaneously caused a race: the second
// caller consumed the already-rotated refresh token and triggered SIGNED_OUT.
if (typeof window !== 'undefined') {
  const session = readStoredSession();
  if (session) {
    const timeUntilExpiry = session.expires_at - Math.floor(Date.now() / 1000);
    if (timeUntilExpiry > 0) {
      scheduleTokenRefresh(timeUntilExpiry);
    }
    // Expired sessions: AuthProvider calls refreshToken() after mount.
  }
}

