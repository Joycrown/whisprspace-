/**
 * Thread configuration constants
 */

export const THREAD_EXPIRATION = {
  /** Free threads expire after 48 hours (2 days) */
  FREE_HOURS: 48,
  
  /** Premium threads expire after 168 hours (7 days) */
  PREMIUM_HOURS: 7 * 24,
  
  /** Default poll duration in hours */
  POLL_DEFAULT_HOURS: 24,
  
  /** Thread extension duration for premium threads (7 additional days) */
  EXTENSION_HOURS: 7 * 24,
} as const;

export const THREAD_LIMITS = {
  /** Maximum number of times a premium thread can be extended */
  MAX_EXTENSIONS: 5,
  
  /** Maximum total lifetime for a thread (including extensions) */
  MAX_LIFETIME_DAYS: 60,
} as const;
