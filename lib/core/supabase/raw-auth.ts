/**
 * Raw Supabase Authentication API
 * Replaces @supabase/supabase-js auth methods with direct API calls
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

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

const SESSION_KEY = 'supabase.auth.session';

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

/**
 * Get stored session (even if expired).
 * Useful for refresh flows.
 */
export function getStoredSession(): Session | null {
  return readStoredSession();
}

/**
 * Save session to localStorage
 */
function saveSession(session: Session | null) {
  if (typeof window === 'undefined') return;
  
  if (session) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } else {
    localStorage.removeItem(SESSION_KEY);
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
      const error = await res.json();
      throw new Error(error.error_description || error.message || 'Sign in failed');
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
    const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error_description || error.message || 'Sign up failed');
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
 * Sign in anonymously
 */
export async function signInAnonymously(): Promise<AuthResponse> {
  try {
    // Supabase anonymous auth - creates an anonymous user/session
    // Mirrors supabase-js signInAnonymously implementation
    const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        data: {},
      }),
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error_description || error.message || 'Anonymous sign in failed');
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
    emitAuthEvent('SIGNED_OUT', null);
    cancelTokenRefresh();

    return { error: null };
  } catch (error: any) {
    console.error('[RawAuth] Sign out error:', error);
    return { error };
  }
}

/**
 * Refresh access token
 */
export async function refreshToken(): Promise<AuthResponse> {
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
      const error = await res.json();
      throw new Error(error.error_description || error.message || 'Token refresh failed');
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
    // Clear invalid session
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

// Initialize on module load
if (typeof window !== 'undefined') {
  const session = readStoredSession();
  if (session) {
    const timeUntilExpiry = session.expires_at - Math.floor(Date.now() / 1000);
    if (timeUntilExpiry > 0) {
      scheduleTokenRefresh(timeUntilExpiry);
    } else {
      // Expired - try to refresh
      refreshToken();
    }
  }
}
