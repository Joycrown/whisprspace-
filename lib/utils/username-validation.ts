/**
 * Username Validation Utilities
 * 
 * Rules:
 * - 3-30 characters
 * - Letters (A-Z, a-z), numbers (0-9), spaces, underscores, hyphens, periods, apostrophes
 * - Optional: Unicode support for international names
 * - No leading/trailing spaces
 * - No multiple consecutive spaces
 * - Case-insensitive uniqueness
 */

// Username validation constants
export const USERNAME_CONFIG = {
  MIN_LENGTH: 3,
  MAX_LENGTH: 30,
  PATTERN: /^[a-zA-Z0-9\s._'-]+$/,
  UNICODE_PATTERN: /^[\p{L}\p{N}\s._'-]+$/u, // Supports international characters
  COOLDOWN_DAYS_FREE: 30,
  COOLDOWN_DAYS_PREMIUM: 7,
} as const;

// Username validation result
export interface UsernameValidation {
  isValid: boolean;
  error?: string;
}

/**
 * Validate username format
 */
export function validateUsername(username: string, allowUnicode = true): UsernameValidation {
  // Check if empty
  if (!username || username.trim().length === 0) {
    return {
      isValid: false,
      error: 'Username cannot be empty',
    };
  }

  // Trim and normalize
  const trimmed = username.trim();

  // Check length
  if (trimmed.length < USERNAME_CONFIG.MIN_LENGTH) {
    return {
      isValid: false,
      error: `Username must be at least ${USERNAME_CONFIG.MIN_LENGTH} characters`,
    };
  }

  if (trimmed.length > USERNAME_CONFIG.MAX_LENGTH) {
    return {
      isValid: false,
      error: `Username cannot exceed ${USERNAME_CONFIG.MAX_LENGTH} characters`,
    };
  }

  // Check pattern
  const pattern = allowUnicode ? USERNAME_CONFIG.UNICODE_PATTERN : USERNAME_CONFIG.PATTERN;
  if (!pattern.test(trimmed)) {
    return {
      isValid: false,
      error: 'Username can only contain letters, numbers, spaces, underscores, hyphens, periods, and apostrophes',
    };
  }

  // Check for leading/trailing spaces
  if (trimmed !== username) {
    return {
      isValid: false,
      error: 'Username cannot have leading or trailing spaces',
    };
  }

  // Check for multiple consecutive spaces
  if (/\s{2,}/.test(trimmed)) {
    return {
      isValid: false,
      error: 'Username cannot have multiple consecutive spaces',
    };
  }

  // Check for only spaces
  if (trimmed.replace(/\s/g, '').length === 0) {
    return {
      isValid: false,
      error: 'Username cannot be only spaces',
    };
  }

  return { isValid: true };
}

/**
 * Normalize username for uniqueness check (case-insensitive)
 */
export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

/**
 * Calculate days until next username change is allowed
 */
export function getDaysUntilNextChange(
  lastChangeDate: string | null,
  isPremium: boolean
): number {
  if (!lastChangeDate) return 0; // Can change immediately if never changed

  const lastChange = new Date(lastChangeDate);
  const now = new Date();
  const cooldownDays = isPremium
    ? USERNAME_CONFIG.COOLDOWN_DAYS_PREMIUM
    : USERNAME_CONFIG.COOLDOWN_DAYS_FREE;

  const nextChangeDate = new Date(lastChange);
  nextChangeDate.setDate(nextChangeDate.getDate() + cooldownDays);

  if (now >= nextChangeDate) return 0; // Cooldown has passed

  const millisecondsPerDay = 1000 * 60 * 60 * 24;
  const daysRemaining = Math.ceil((nextChangeDate.getTime() - now.getTime()) / millisecondsPerDay);

  return daysRemaining;
}

/**
 * Check if user can change username now
 */
export function canChangeUsername(
  lastChangeDate: string | null,
  isPremium: boolean
): boolean {
  return getDaysUntilNextChange(lastChangeDate, isPremium) === 0;
}

/**
 * Format cooldown message
 */
export function getChangeCooldownMessage(
  lastChangeDate: string | null,
  isPremium: boolean
): string {
  const daysRemaining = getDaysUntilNextChange(lastChangeDate, isPremium);

  if (daysRemaining === 0) {
    return 'You can change your username now';
  }

  const cooldownDays = isPremium
    ? USERNAME_CONFIG.COOLDOWN_DAYS_PREMIUM
    : USERNAME_CONFIG.COOLDOWN_DAYS_FREE;

  return `You can change your username again in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'} (${cooldownDays}-day cooldown for ${isPremium ? 'premium' : 'free'} users)`;
}

/**
 * Sanitize username (remove problematic characters)
 */
export function sanitizeUsername(username: string): string {
  return username
    .trim()
    .replace(/\s{2,}/g, ' ') // Replace multiple spaces with single space
    .replace(/[^\p{L}\p{N}\s._'-]/gu, ''); // Remove invalid characters
}

/**
 * Generate username suggestions from email or existing username
 */
export function generateUsernameSuggestions(base: string, count = 3): string[] {
  const suggestions: string[] = [];
  const sanitized = sanitizeUsername(base.split('@')[0]); // Remove email domain

  for (let i = 0; i < count; i++) {
    const randomNum = Math.floor(Math.random() * 1000);
    suggestions.push(`${sanitized}${randomNum}`);
  }

  return suggestions;
}

/**
 * Check if username looks like a system-generated anonymous ID
 */
export function isSystemGeneratedId(username: string): boolean {
  return /^ANON_\d{8}$/i.test(username);
}

/**
 * Validation messages
 */
export const USERNAME_MESSAGES = {
  SUCCESS: 'Username is available!',
  CHECKING: 'Checking availability...',
  TAKEN: 'This username is already taken',
  INVALID_FORMAT: 'Username format is invalid',
  TOO_SHORT: `Username must be at least ${USERNAME_CONFIG.MIN_LENGTH} characters`,
  TOO_LONG: `Username cannot exceed ${USERNAME_CONFIG.MAX_LENGTH} characters`,
  COOLDOWN_ACTIVE: 'You can\'t change your username yet',
  CHANGE_SUCCESS: 'Username changed successfully!',
  CHANGE_ERROR: 'Failed to change username',
} as const;
