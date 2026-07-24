/* eslint-disable @typescript-eslint/no-explicit-any */
import * as rawAuth from '@/lib/core/supabase/raw-auth'
import * as rawDb from '@/lib/core/supabase/raw-db'
import { supabase } from '@/lib/core/supabase/client'
import type { User } from '@/types'
import {
  sanitizeEmailAddress,
  sanitizePasswordInput,
  sanitizeUuid,
} from '@/lib/security/input-sanitization'

// Convert raw auth user to WhisprSpace User
const convertAuthUserToUser = async (userId: string): Promise<User> => {
  // Fetch user data from our users table
  const { data: userData, error } = await rawDb.select('users', {
    filters: { 'id': rawDb.filter.eq(userId) },
    single: true,
  })

  if (error || !userData) {
    throw new Error('Failed to fetch user data')
  }

  const user = Array.isArray(userData) ? userData[0] : userData;

  // Check if user is banned
  const { data: banData } = await rawDb.select('banned_users', {
    filters: { 'user_id': rawDb.filter.eq(userId) },
    single: true,
  })

  const ban = Array.isArray(banData) ? banData[0] : banData;
  if (ban) {
    const isPermanent = ban.is_permanent;
    const expiresAt = ban.expires_at ? new Date(ban.expires_at) : null;
    
    if (isPermanent || (expiresAt && expiresAt > new Date())) {
      throw new Error(`Your account has been restricted. Reason: ${ban.reason || 'Violation of terms'}`);
    }
  }

  return {
    id: user.id,
    anonymousId: user.anonymous_id,
    username: user.username,
    lastUsernameChange: user.last_username_change,
    isAnonymous: user.is_anonymous,
    joinedAt: user.created_at,
    lastActiveAt: user.last_active_at,
    preferences: user.preferences,
    isPremium: user.is_premium,
    isAdmin: user.is_admin,
    premiumExpiresAt: user.premium_expires_at,
    premiumProvider: user.premium_provider,
    premiumLastTxRef: user.premium_last_tx_ref,
  }
}

const sendWelcome = (payload: { userId: string; inboxHandle: string; email?: string }) => {
  fetch('/api/welcome', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch((err) => console.warn('[AuthService] Welcome message failed silently:', err))
}

/**
 * Sign in anonymously
 * Creates both Supabase auth session and user record
 */
export const signInAnonymously = async (): Promise<User> => {
  try {
    // Sign in with raw auth
    const { session, error: authError } = await rawAuth.signInAnonymously()
    
    if (authError) throw authError
    if (!session) throw new Error('No session returned')

    // Wait and retry for the trigger to create the user record
    const maxAttempts = 10;
    let user = null
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        user = await convertAuthUserToUser(session.user.id)
        break
      } catch (err) {
        if (attempt === maxAttempts) throw err
        await new Promise(resolve => setTimeout(resolve, 300))
      }
    }

    if (!user) throw new Error('Failed to create anonymous user profile')

    // Fire-and-forget: send welcome inbox message (no email for anonymous users)
    sendWelcome({ userId: user.id, inboxHandle: user.anonymousId })

    return user
  } catch (error) {
    console.error('Anonymous sign-in error:', error)
    throw error
  }
}

/**
 * Sign up with email/password
 * Creates new user with system-generated anonymous ID as initial username
 * User can change username later in profile (with cooldown period)
 */
export const signUpWithEmail = async (
  email: string,
  password: string
): Promise<User> => {
  try {
    const normalizedEmail = sanitizeEmailAddress(email)
    if (!normalizedEmail) {
      throw new Error('Please enter a valid email address')
    }
    const sanitizedPassword = sanitizePasswordInput(password)
    if (!sanitizedPassword) {
      throw new Error('Password is required')
    }

    // Create new account (auto-confirm without email verification)
    const { session, error: signUpError } = await rawAuth.signUp(normalizedEmail, sanitizedPassword)

    if (signUpError) throw signUpError
    if (!session) throw new Error('No session returned')

    // Wait for the DB trigger to create the public.users record, retrying up to 10 times.
    // Mirrors the anonymous sign-in retry pattern — the trigger can take up to ~3 seconds.
    const maxAttempts = 10
    let user: User | null = null
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        user = await convertAuthUserToUser(session.user.id)
        break
      } catch (err) {
        if (attempt === maxAttempts) throw err
        await new Promise(resolve => setTimeout(resolve, 300))
      }
    }

    if (!user) throw new Error('Failed to create user profile after sign up')

    // Fire-and-forget: send welcome inbox message + email
    sendWelcome({ userId: user.id, inboxHandle: user.anonymousId, email: normalizedEmail })

    return user
  } catch (error) {
    console.error('Sign-up error:', error)
    throw error
  }
}

/**
 * Upgrade the current ANONYMOUS account into a permanent one.
 *
 * Keeps the same user id / handle / conversations / messages by setting an
 * email + password on the existing anonymous auth user (Supabase updateUser),
 * then flipping the profile row to non-anonymous server-side.
 *
 * Throws if there's no anonymous session to upgrade — callers should fall back
 * to signUpWithEmail in that case.
 */
export const upgradeAnonymousAccount = async (
  email: string,
  password: string
): Promise<User> => {
  const normalizedEmail = sanitizeEmailAddress(email)
  if (!normalizedEmail) {
    throw new Error('Please enter a valid email address')
  }
  const sanitizedPassword = sanitizePasswordInput(password)
  if (!sanitizedPassword) {
    throw new Error('Password is required')
  }

  const current = rawAuth.getSession()
  if (!current?.user?.is_anonymous) {
    throw new Error('No anonymous account to upgrade')
  }

  // Same UUID, now with email+password — messages and handle are preserved.
  const { session, error } = await rawAuth.updateUserCredentials(normalizedEmail, sanitizedPassword)
  if (error) throw error
  if (!session) throw new Error('Account upgrade failed')

  // Flip the profile row to a permanent account (RLS-safe, server-side).
  try {
    await fetch('/api/auth/promote-anon', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ userId: session.user.id }),
    })
  } catch (err) {
    console.warn('[AuthService] promote-anon call failed (non-fatal):', err)
  }

  const user = await convertAuthUserToUser(session.user.id)

  // Fire-and-forget: welcome email now that we have an address (inbox handle unchanged).
  sendWelcome({ userId: user.id, inboxHandle: user.username || user.anonymousId, email: normalizedEmail })

  return user
}

/**
 * Sign in with email/password
 */
export const signInWithEmail = async (
  email: string,
  password: string
): Promise<User> => {
  try {
    const normalizedEmail = sanitizeEmailAddress(email)
    if (!normalizedEmail) {
      throw new Error('Please enter a valid email address')
    }

    const sanitizedPassword = sanitizePasswordInput(password)
    if (!sanitizedPassword) {
      throw new Error('Password is required')
    }

    const { session, error: signInError } = await rawAuth.signIn(normalizedEmail, sanitizedPassword)

    if (signInError) throw signInError
    if (!session) throw new Error('No session returned')

    return await convertAuthUserToUser(session.user.id)
  } catch (error) {
    console.error('Sign-in error:', error)
    throw error
  }
}

/**
 * Sign out
 */
export const signOut = async (): Promise<void> => {
  const { error } = await rawAuth.signOut()
  if (error) throw error
}

/**
 * Get current session
 */
export const getCurrentSession = async (): Promise<User | null> => {
  try {
    const session = rawAuth.getSession()
    
    if (!session) return null

    return await convertAuthUserToUser(session.user.id)
  } catch (error) {
    console.error('[AuthService] Get session FATAL error:', error)
    // If it's a "No rows returned" error, it means the user exists in Auth but not in public.users yet
    if (error instanceof Error && error.message.includes('No rows returned')) {
      console.warn('[AuthService] Auth session exists but public.users record missing (trigger delay?)')
    }
    return null
  }
}

/**
 * Update user preferences
 */
export const updateUserPreferences = async (
  userId: string,
  preferences: Partial<User['preferences']>
): Promise<void> => {
  const safeUserId = sanitizeUuid(userId)
  if (!safeUserId) {
    throw new Error('Invalid user context')
  }

  const { error } = await rawDb.update(
    'users',
    { preferences },
    { 'id': rawDb.filter.eq(safeUserId) },
    { returning: false }
  )

  if (error) throw error
}

/**
 * Update user activity
 */
export const updateUserActivity = async (userId: string): Promise<void> => {
  const safeUserId = sanitizeUuid(userId)
  if (!safeUserId) {
    throw new Error('Invalid user context')
  }

  const { error } = await rawDb.update(
    'users',
    { last_active_at: new Date().toISOString() },
    { 'id': rawDb.filter.eq(safeUserId) },
    { returning: false }
  )

  if (error) throw error
}

/**
 * Request a password reset link.
 * This function calls our custom API which generates a link via Supabase Admin
 * and sends it using Brevo, bypassing Supabase's internal email sender.
 */
export const requestPasswordReset = async (email: string): Promise<{
  success: boolean
  message: string
}> => {
  try {
    const normalizedEmail = sanitizeEmailAddress(email)
    if (!normalizedEmail) {
      return {
        success: false,
        message: 'Please enter a valid email address.',
      }
    }

    const response = await fetch('/api/auth/request-password-reset', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: normalizedEmail }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to send reset email');
    }

    return {
      success: true,
      message: data.message || 'If an account with that email exists, a password reset link has been sent.',
    };
  } catch (error: any) {
    console.error('Request password reset error:', error);
    return {
      success: false,
      message: error.message || 'An unexpected error occurred. Please try again later.',
    };
  }
};

/**
 * Update password with reset token
 * Called from the reset password page after user clicks the link in their email
 */
export const updatePassword = async (newPassword: string): Promise<{
  success: boolean
  message: string
}> => {
  try {
    const sanitizedPassword = sanitizePasswordInput(newPassword)
    if (!sanitizedPassword) {
      return {
        success: false,
        message: 'Password is required.'
      }
    }

    // Requires the user to be authenticated with a valid reset token.
    // The reset token flow is handled client-side (implicit grant).
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
      console.error('Update password session error:', sessionError);
    }

    if (!sessionData?.session) {
      return {
        success: false,
        message: 'No active session. Please use the reset link from your email.'
      }
    }

    const { error } = await supabase.auth.updateUser({ password: sanitizedPassword });
    if (error) {
      return {
        success: false,
        message: error.message || 'Failed to update password. Please try again.'
      }
    }

    return {
      success: true,
      message: 'Password updated successfully! You can now log in with your new password.'
    }
  } catch (error) {
    console.error('Update password error:', error)
    return {
      success: false,
      message: 'An unexpected error occurred. Please try again.'
    }
  }
}
