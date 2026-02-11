import { getSession } from '@/lib/core/supabase/raw-auth';
import { getAccessToken } from '@/lib/utils/auth-token-cache';

const readTokenFromStorage = () => {
  if (typeof window === 'undefined') return null;
  const parseToken = (raw: string | null) => {
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      return (
        parsed?.access_token ||
        parsed?.currentSession?.access_token ||
        parsed?.session?.access_token ||
        null
      );
    } catch {
      return null;
    }
  };

  const direct = parseToken(localStorage.getItem('supabase.auth.session'));
  if (direct) return direct;

  const cached = getAccessToken();
  if (cached) return cached;

  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith('sb-') || !key.endsWith('-auth-token')) continue;
    const token = parseToken(localStorage.getItem(key));
    if (token) return token;
  }

  return null;
};

const resolveAccessToken = () => {
  const session = getSession();
  return session?.access_token || readTokenFromStorage();
};

const buildAuthHeaders = () => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const token = resolveAccessToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
};

export const confirmThreadPurchase = async (payload: {
  threadId: string;
  transactionId?: string | null;
  txRef?: string | null;
}) => {
  try {
    const token = resolveAccessToken();
    if (!token) {
      return { success: false, error: 'Authentication required' };
    }

    const response = await fetch('/api/flutterwave/confirm', {
      method: 'POST',
      headers: buildAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      const message = error?.error || error?.message || 'Failed to confirm payment';
      return { success: false, error: message };
    }

    const data = await response.json();
    return { success: true, ...data };
  } catch (error) {
    console.error('Confirm Flutterwave payment error:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
};

export const confirmPremiumUpgrade = async (payload: {
  transactionId?: string | null;
  txRef?: string | null;
}): Promise<{ success: boolean; error?: string; premiumExpiresAt?: string }> => {
  try {
    const token = resolveAccessToken();
    if (!token) {
      return { success: false, error: 'Authentication required' };
    }

    const response = await fetch('/api/flutterwave/confirm-upgrade', {
      method: 'POST',
      headers: buildAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      const message = error?.error || error?.message || 'Failed to confirm upgrade';
      return { success: false, error: message };
    }

    const data = await response.json();
    return { success: true, ...data };
  } catch (error) {
    console.error('Confirm Flutterwave upgrade error:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
};

export const createThreadPurchaseSession = async (
  threadId: string,
  country?: string,
  currency?: string
): Promise<{ url: string | null; error: string | null; alreadyPurchased?: boolean }> => {
  try {
    const token = resolveAccessToken();
    if (!token) {
      return { url: null, error: 'Authentication required' };
    }

    const response = await fetch('/api/flutterwave/initialize', {
      method: 'POST',
      headers: buildAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify({
        threadId,
        country,
        currency,
      }),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      const message = error?.error || error?.message || 'Failed to create checkout session'
      if (response.status === 409 || error?.alreadyPurchased) {
        return { url: null, error: message || 'Thread already purchased', alreadyPurchased: true }
      }
      return { url: null, error: message }
    }

    const { url } = await response.json()
    return { url, error: null }
  } catch (error) {
    console.error('Create Flutterwave checkout error:', error)
    return { url: null, error: 'An unexpected error occurred' }
  }
}

export const createPremiumUpgradeSession = async (
  plan: 'monthly' | 'annual',
  currency?: string
): Promise<{ url: string | null; error: string | null; txRef?: string | null }> => {
  try {
    const token = resolveAccessToken();
    if (!token) {
      return { url: null, error: 'Authentication required', txRef: null };
    }

    const response = await fetch('/api/flutterwave/upgrade', {
      method: 'POST',
      headers: buildAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify({ plan, currency }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      const message = error?.error || error?.message || 'Failed to create checkout session';
      return { url: null, error: message, txRef: null };
    }

    const { url, txRef } = await response.json();
    return { url, error: null, txRef };
  } catch (error) {
    console.error('Create Flutterwave upgrade checkout error:', error);
    return { url: null, error: 'An unexpected error occurred', txRef: null };
  }
};
