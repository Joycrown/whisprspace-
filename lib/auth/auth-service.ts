import * as rawAuth from '@/lib/core/supabase/raw-auth'
import * as rawDb from '@/lib/core/supabase/raw-db'
import type { User } from '@/types'

// Generate anonymous user ID
const generateAnonymousId = (): string => {
  const randomNum = Math.floor(Math.random() * 100000000)
  return `ANON_${randomNum.toString().padStart(8, '0')}`
}

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

  return {
    id: user.id,
    anonymousId: user.anonymous_id,
    username: user.username,
    lastUsernameChange: user.last_username_change,
    isAnonymous: user.is_anonymous,
    points: user.points || 0,
    level: user.level || 1,
    joinedAt: user.created_at,
    lastActiveAt: user.last_active_at,
    preferences: user.preferences,
    isPremium: user.is_premium,
    premiumExpiresAt: user.premium_expires_at,
    premiumProvider: user.premium_provider,
    premiumLastTxRef: user.premium_last_tx_ref,
  }
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
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await convertAuthUserToUser(session.user.id)
      } catch (err) {
        if (attempt === maxAttempts) throw err
        // Small backoff before retry
        await new Promise(resolve => setTimeout(resolve, 300))
      }
    }

    throw new Error('Failed to create anonymous user profile')
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
    // Check if user is currently anonymous
    const currentSession = rawAuth.getSession()
    
    if (currentSession?.user?.is_anonymous) {
      // For anonymous users, we can't link - just create new account
      // (Supabase's updateUser for linking requires SDK features we're removing)

    }

    // Create new account (auto-confirm without email verification)
    const { session, error: signUpError } = await rawAuth.signUp(email, password)

    if (signUpError) throw signUpError
    if (!session) throw new Error('No session returned')

    // Wait for trigger to create user record
    await new Promise(resolve => setTimeout(resolve, 100))

    // Fetch user record created by trigger
    return await convertAuthUserToUser(session.user.id)
  } catch (error) {
    console.error('Sign-up error:', error)
    throw error
  }
}

/**
 * Sign in with email/password
 */
export const signInWithEmail = async (
  email: string,
  password: string
): Promise<User> => {
  try {
    const { session, error: signInError } = await rawAuth.signIn(email, password)

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
  const { error } = await rawDb.update(
    'users',
    { preferences },
    { 'id': rawDb.filter.eq(userId) },
    { returning: false }
  )

  if (error) throw error
}

/**
 * Update user activity
 */
export const updateUserActivity = async (userId: string): Promise<void> => {
  const { error } = await rawDb.update(
    'users',
    { last_active_at: new Date().toISOString() },
    { 'id': rawDb.filter.eq(userId) },
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
    const response = await fetch('/api/auth/request-password-reset', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
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
    // Note: This requires the user to be authenticated with a valid reset token
    // The reset token flow remains unchanged (email-based)
    const session = rawAuth.getSession()
    if (!session) {
      return {
        success: false,
        message: 'No active session. Please use the reset link from your email.'
      }
    }

    // Password update would need direct API call to Supabase Auth
    // For now, keeping minimal implementation
    console.warn('[Auth] Password update via raw API not yet implemented')
    return {
      success: false,
      message: 'Password update temporarily unavailable. Please contact support.'
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
