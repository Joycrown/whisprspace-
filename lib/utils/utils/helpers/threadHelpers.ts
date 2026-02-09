// utils/threadHelpers.ts
import { Thread, ThreadData, User } from '../types';

export function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (diffInSeconds < 60) return 'just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h`;
  
  // For messages older than a day, show date and time
  const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' };
  return date.toLocaleDateString(undefined, options);
}

/**
 * Format time remaining until expiration (for thread expiry countdown)
 */
export function formatTimeRemaining(expiresAt: string | null | undefined): string {
  if (!expiresAt) return 'Never expires';
  
  const expiryDate = new Date(expiresAt);
  const now = new Date();
  const diffInSeconds = Math.floor((expiryDate.getTime() - now.getTime()) / 1000);
  
  // Already expired
  if (diffInSeconds <= 0) return 'Expired';
  
  // Less than a minute
  if (diffInSeconds < 60) return 'Expires in less than 1m';
  
  // Less than an hour
  if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60);
    return `Expires in ${minutes}m`;
  }
  
  // Less than a day
  if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return `Expires in ${hours}h`;
  }
  
  // Less than a week
  if (diffInSeconds < 604800) {
    const days = Math.floor(diffInSeconds / 86400);
    return `Expires in ${days}d`;
  }
  
  // More than a week
  const weeks = Math.floor(diffInSeconds / 604800);
  return `Expires in ${weeks}w`;
}

export function parseMessageMentions(content: string): string[] {
  const mentionRegex = /@(\w+)/g;
  const mentions = content.match(mentionRegex) || [];
  return mentions.map(mention => mention.slice(1));
}

export function isValidVoiceMessage(duration: number, isPremium: boolean): boolean {
  return isPremium ? duration <= 30 : duration <= 15;
}

// ============================================
// PREMIUM THREAD FEATURES
// ============================================

/**
 * Calculate thread expiration date based on thread premium status
 * - Free threads: 48 hours (2 days)
 * - Premium threads: 7 days
 */
export function calculateThreadExpiration(isThreadPremium: boolean, createdAt?: string): string {
  const baseDate = createdAt ? new Date(createdAt) : new Date();
  const expirationHours = isThreadPremium ? 7 * 24 : 48; // 7 days for premium, 48 hours for free
  const expirationDate = new Date(baseDate.getTime() + expirationHours * 60 * 60 * 1000);
  return expirationDate.toISOString();
}

/**
 * Calculate message expiration date based on premium status
 * - Free users: 24 hours
 * - Premium users: 2 weeks (14 days)
 */
export function calculateMessageExpiration(isPremium: boolean): string {
  const now = new Date();
  const expirationHours = isPremium ? 14 * 24 : 24; // 2 weeks for premium, 24 hours for free
  const expirationDate = new Date(now.getTime() + expirationHours * 60 * 60 * 1000);
  return expirationDate.toISOString();
}

/**
 * Check if a thread has expired
 * Saved threads never expire (premium feature)
 */
export function isThreadExpired(thread: Thread | ThreadData): boolean {
  // Saved threads never expire
  if (thread.isSaved) {
    return false;
  }
  
  // If no expiration date is set, thread doesn't expire
  if (!thread.expiresAt) {
    return false;
  }
  
  const now = new Date();
  const expirationDate = new Date(thread.expiresAt);
  return now > expirationDate;
}

/**
 * Get time remaining until thread expiration
 * Returns formatted string like "2h 30m" or "3d 5h"
 */
export function getTimeRemaining(thread: Thread | ThreadData): string {
  // Saved threads never expire
  if (thread.isSaved) {
    return 'Never expires';
  }
  
  if (!thread.expiresAt) {
    return 'No expiration';
  }
  
  const now = new Date();
  const expirationDate = new Date(thread.expiresAt);
  const diffInMs = expirationDate.getTime() - now.getTime();
  
  if (diffInMs <= 0) {
    return 'Expired';
  }
  
  const days = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffInMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diffInMs % (1000 * 60 * 60)) / (1000 * 60));
  
  if (days > 0) {
    return `${days}d ${hours}h`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
}

/**
 * Check if user is the owner of a thread
 */
export function isThreadOwner(thread: Thread | ThreadData, userId: string): boolean {
  return thread.authorId === userId || thread.author.id === userId;
}

/**
 * Check if user can manage a thread (owner and premium)
 */
export function canManageThread(thread: Thread | ThreadData, user: User | null): boolean {
  if (!user) return false;
  return isThreadOwner(thread, user.id) && user.isPremium === true;
}

/**
 * Check if a thread is a closed thread (private or invite-only)
 * Premium feature for thread creators
 */
export function isClosedThread(thread: Thread | ThreadData): boolean {
  return thread.privacy === 'private' || thread.privacy === 'invite-only';
}

/**
 * Check if user has been removed from a thread
 */
export function isUserRemoved(thread: Thread | ThreadData, userId: string): boolean {
  return thread.removedUsers?.includes(userId) || false;
}

/**
 * Check if user can access a thread
 */
export function canAccessThread(thread: Thread | ThreadData, userId: string | null): boolean {
  // Public threads are accessible to everyone (unless user was removed)
  if (thread.privacy === 'public') {
    if (!userId) return true;
    return !isUserRemoved(thread, userId);
  }
  
  // Private/invite-only threads require user to be authenticated
  if (!userId) {
    return false;
  }
  
  // Check if user was removed
  if (isUserRemoved(thread, userId)) {
    return false;
  }
  
  // Owner always has access
  if (isThreadOwner(thread, userId)) {
    return true;
  }
  
  // Check if user is a participant
  if ('participants' in thread) {
    return thread.participants.some(p => p.id === userId);
  }
  
  return false;
}

/**
 * Save a thread from expiration (premium feature)
 * Only thread owners with premium can save threads
 */
export function saveThreadFromExpiration(thread: Thread | ThreadData, user: User | null): {
  canSave: boolean;
  reason?: string;
} {
  if (!user) {
    return { canSave: false, reason: 'You must be logged in to save threads' };
  }
  
  if (!user.isPremium) {
    return { canSave: false, reason: 'Only premium users can save threads from expiration' };
  }
  
  if (!isThreadOwner(thread, user.id)) {
    return { canSave: false, reason: 'Only thread owners can save their threads' };
  }
  
  if (thread.isSaved) {
    return { canSave: false, reason: 'Thread is already saved' };
  }
  
  return { canSave: true };
}

/**
 * Remove a user from a thread (premium feature)
 * Only thread owners with premium can remove users
 */
export function canRemoveUserFromThread(thread: Thread | ThreadData, ownerUser: User | null, targetUserId: string): {
  canRemove: boolean;
  reason?: string;
} {
  if (!ownerUser) {
    return { canRemove: false, reason: 'You must be logged in' };
  }
  
  if (!ownerUser.isPremium) {
    return { canRemove: false, reason: 'Only premium users can remove participants from threads' };
  }
  
  if (!isThreadOwner(thread, ownerUser.id)) {
    return { canRemove: false, reason: 'Only thread owners can remove participants' };
  }
  
  if (targetUserId === ownerUser.id) {
    return { canRemove: false, reason: 'You cannot remove yourself from your own thread' };
  }
  
  if (isUserRemoved(thread, targetUserId)) {
    return { canRemove: false, reason: 'User has already been removed' };
  }
  
  return { canRemove: true };
}

/**
 * Format expiration time for display
 */
export function formatExpirationTime(expiresAt: string | undefined, isSaved: boolean): string {
  if (isSaved) {
    return 'Saved (never expires)';
  }
  
  if (!expiresAt) {
    return 'No expiration set';
  }
  
  const expirationDate = new Date(expiresAt);
  const now = new Date();
  
  if (expirationDate < now) {
    return 'Expired';
  }
  
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  };
  
  return `Expires: ${expirationDate.toLocaleString(undefined, options)}`;
}
