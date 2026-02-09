/**
 * Username Service
 * Handles username changes and availability checks
 */

import * as rawDb from '@/lib/core/supabase/raw-db';
import { validateUsername } from '../utils/username-validation';

export interface UsernameChangeResult {
  success: boolean;
  error?: string;
  username?: string;
}

/**
 * Check if username is available
 */
export async function checkUsernameAvailability(
  username: string,
  excludeUserId?: string
): Promise<boolean> {
  try {
    // Try using database function first (if migration has been run)
    const { data, error } = await rawDb.rpc<boolean>('is_username_available', {
      check_username: username,
      exclude_user_id: excludeUserId || null,
    });

    // If RPC function doesn't exist, fall back to direct query
    if (error && error.message?.includes('function') && error.message?.includes('does not exist')) {
      console.warn('Database function not found, using fallback query');
      return await checkUsernameAvailabilityFallback(username, excludeUserId);
    }

    if (error) {
      console.error('Error checking username availability:', error);
      return false;
    }

    return data === true;
  } catch (error) {
    console.error('Error checking username availability:', error);
    // Try fallback on any error
    try {
      return await checkUsernameAvailabilityFallback(username, excludeUserId);
    } catch (fallbackError) {
      console.error('Fallback also failed:', fallbackError);
      return false;
    }
  }
}

/**
 * Fallback username availability check (direct query)
 * Used when database function doesn't exist yet
 */
async function checkUsernameAvailabilityFallback(
  username: string,
  excludeUserId?: string
): Promise<boolean> {
  try {
    let query = rawDb
      .from<{ id: string }>('users')
      .select('id')
      .ilike('username', username)
      .limit(1);

    if (excludeUserId) {
      query = query.neq('id', excludeUserId);
    }

    const { data, error } = await query.execute();

    if (error) {
      console.error('Fallback availability check error:', error);
      return false;
    }

    // Available if no matching username found
    return !data || (Array.isArray(data) && data.length === 0);
  } catch (error) {
    console.error('Fallback availability check error:', error);
    return false;
  }
}

/**
 * Update user's username
 * Uses database function for validation and cooldown enforcement
 */
export async function updateUsername(
  userId: string,
  newUsername: string
): Promise<UsernameChangeResult> {
  try {
    // Client-side validation first
    const validation = validateUsername(newUsername);
    if (!validation.isValid) {
      return {
        success: false,
        error: validation.error,
      };
    }

    // Call database function to update (includes cooldown check)
    const { data, error } = await rawDb.rpc<{ success: boolean; error?: string; username?: string }>(
      'update_user_username',
      {
      user_id: userId,
      new_username: newUsername.trim(),
      }
    );

    if (error) {
      console.error('Error updating username:', error);
      return {
        success: false,
        error: 'Failed to update username',
      };
    }

    // Database function returns JSON with success/error
    if (!data) {
      return {
        success: false,
        error: 'Failed to update username',
      };
    }

    return data;
  } catch (error) {
    console.error('Error updating username:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update username',
    };
  }
}

/**
 * Get username change history for a user
 */
export async function getUsernameChangeInfo(userId: string): Promise<{
  username: string;
  lastChange: string | null;
  isPremium: boolean;
} | null> {
  try {
    const { data, error } = await rawDb
      .from<{ username: string; last_username_change: string | null; is_premium: boolean }>('users')
      .select('username, last_username_change, is_premium')
      .eq('id', userId)
      .single()
      .execute();

    if (error || !data) {
      console.error('Error fetching username info:', error);
      return null;
    }

    return {
      username: data.username,
      lastChange: data.last_username_change,
      isPremium: data.is_premium || false,
    };
  } catch (error) {
    console.error('Error fetching username info:', error);
    return null;
  }
}

/**
 * Search usernames (for mentions, etc.)
 */
export async function searchUsernames(
  query: string,
  limit = 10
): Promise<{ id: string; username: string; isAnonymous: boolean }[]> {
  try {
    const { data, error } = await rawDb
      .from<{ id: string; username: string; is_anonymous: boolean }>('users')
      .select('id, username, is_anonymous')
      .ilike('username', `%${query}%`)
      .limit(limit)
      .execute();

    if (error || !data) {
      console.error('Error searching usernames:', error);
      return [];
    }

    const rows = Array.isArray(data) ? data : [data];

    return rows.map(user => ({
      id: user.id,
      username: user.username,
      isAnonymous: user.is_anonymous,
    }));
  } catch (error) {
    console.error('Error searching usernames:', error);
    return [];
  }
}

/**
 * Get username by user ID
 */
export async function getUsernameById(userId: string): Promise<string | null> {
  try {
    const { data, error } = await rawDb
      .from<{ username: string }>('users')
      .select('username')
      .eq('id', userId)
      .single()
      .execute();

    if (error || !data) {
      console.error('Error fetching username:', error);
      return null;
    }

    return data.username;
  } catch (error) {
    console.error('Error fetching username:', error);
    return null;
  }
}
