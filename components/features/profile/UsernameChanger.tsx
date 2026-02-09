'use client';

import React, { useState, useEffect } from 'react';
import { Edit3, Check, X, AlertCircle, Clock, Crown } from 'lucide-react';
import { useUserStore } from '@/store/userStore';
import { useToast } from '@/components/ui/Toast';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/react-query/queryKeys';
import {
  validateUsername,
  canChangeUsername,
  getDaysUntilNextChange,
  getChangeCooldownMessage,
  isSystemGeneratedId,
  USERNAME_MESSAGES,
} from '@/lib/utils/username-validation';
import {
  checkUsernameAvailability,
  updateUsername,
  getUsernameChangeInfo,
} from '@/lib/services/username-service';

interface UsernameChangerProps {
  onSuccess?: () => void; // Optional callback when username is successfully changed
}

export function UsernameChanger({ onSuccess }: UsernameChangerProps = {}) {
  const { session } = useUserStore();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const [isEditing, setIsEditing] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);

  const [usernameInfo, setUsernameInfo] = useState<{
    username: string;
    lastChange: string | null;
    isPremium: boolean;
  } | null>(null);

  // Prefer local username info if available (most fresh), then from session store, then fallback to anon ID
  const currentUsername = usernameInfo?.username || session.user?.username || session.user?.anonymousId || '';
  const userId = session.user?.id || '';

  // Debounce timer for availability check
  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null);

  // Load username info on mount
  useEffect(() => {
    if (userId) {
      loadUsernameInfo();
    }
  }, [userId]);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
    };
  }, [debounceTimer]);

  const loadUsernameInfo = async () => {
    const info = await getUsernameChangeInfo(userId);
    if (info) {
      setUsernameInfo(info);
    }
  };

  const canChange = usernameInfo
    ? canChangeUsername(usernameInfo.lastChange, usernameInfo.isPremium)
    : true;

  const daysRemaining = usernameInfo
    ? getDaysUntilNextChange(usernameInfo.lastChange, usernameInfo.isPremium)
    : 0;

  const cooldownMessage = usernameInfo
    ? getChangeCooldownMessage(usernameInfo.lastChange, usernameInfo.isPremium)
    : '';

  const handleStartEdit = () => {
    if (!canChange) {
      showToast({
        type: 'warning',
        title: 'Cooldown Active',
        message: cooldownMessage,
        duration: 5000,
      });
      return;
    }
    setNewUsername(currentUsername);
    setIsEditing(true);
    setValidationError(null);
    setAvailabilityError(null);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setNewUsername('');
    setValidationError(null);
    setAvailabilityError(null);
  };

  const handleUsernameChange = (value: string) => {
    setNewUsername(value);
    setValidationError(null);
    setAvailabilityError(null);

    // Clear existing timer
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    // Validate format
    const validation = validateUsername(value);
    if (!validation.isValid) {
      setValidationError(validation.error || 'Invalid username');
      setIsChecking(false);
      return;
    }

    // Check availability if different from current (debounced)
    if (value.trim().toLowerCase() !== currentUsername.toLowerCase()) {
      setIsChecking(true);

      const timer = setTimeout(async () => {
        try {
          const isAvailable = await checkUsernameAvailability(value.trim(), userId);

          if (!isAvailable) {
            setAvailabilityError(USERNAME_MESSAGES.TAKEN);
          }
        } catch (error) {
          console.error('Error checking username availability:', error);
          setAvailabilityError('Failed to check availability. Please try again.');
        } finally {
          setIsChecking(false);
        }
      }, 500); // Wait 500ms after user stops typing

      setDebounceTimer(timer);
    } else {
      // Same as current username, no need to check
      setIsChecking(false);
    }
  };

  const handleSave = async () => {
    if (!newUsername || validationError || availabilityError) return;

    setIsSaving(true);

    try {
      const result = await updateUsername(userId, newUsername.trim());

      if (result.success) {
        showToast({
          type: 'success',
          title: 'Username Changed!',
          message: `Your username is now ${result.username}`,
          duration: 4000,
        });

        // Reload username info
        await loadUsernameInfo();

        // Update the Zustand store to refresh the UI
        if (result.username) {
          const { updateUsername: updateUsernameInStore } = useUserStore.getState();
          updateUsernameInStore(result.username);
        }

        // Refresh thread data so participant names update everywhere
        queryClient.invalidateQueries({ queryKey: queryKeys.threads.all });

        // Update session (you may need to refresh from backend)
        setIsEditing(false);
        setNewUsername('');

        // Call onSuccess callback if provided (e.g., to close modal)
        if (onSuccess) {
          onSuccess();
        }
      } else {
        showToast({
          type: 'error',
          title: 'Failed to Change Username',
          message: result.error || 'Please try again',
          duration: 5000,
        });
      }
    } catch (error) {
      showToast({
        type: 'error',
        title: 'Error',
        message: 'Failed to change username',
        duration: 5000,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const isSystemGenerated = isSystemGeneratedId(currentUsername);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Username
        </h3>
        {usernameInfo?.isPremium && (
          <div className="flex items-center gap-1 text-xs bg-gradient-to-r from-purple-500 to-orange-500 text-white px-2 py-1 rounded-full">
            <Crown className="w-3 h-3" />
            <span>Premium</span>
          </div>
        )}
      </div>

      {/* Current Username or Edit Mode */}
      {!isEditing ? (
        <div className="space-y-4">
          {/* Display Current Username */}
          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-md">
            <div className="flex-1">
              <p className="text-gray-900 dark:text-white font-mono text-lg">
                {currentUsername}
              </p>
              {isSystemGenerated && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  System-generated ID • Set your custom username
                </p>
              )}
            </div>
            <button
              onClick={handleStartEdit}
              disabled={!canChange}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${canChange
                ? 'text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20'
                : 'text-gray-400 cursor-not-allowed'
                }`}
              title={canChange ? 'Change username' : cooldownMessage}
            >
              <Edit3 className="w-4 h-4" />
              Change
            </button>
          </div>

          {/* Cooldown Info */}
          {!canChange && (
            <div className="flex items-start gap-2 p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-md">
              <Clock className="w-4 h-4 text-orange-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm text-orange-800 dark:text-orange-200 font-medium">
                  Cooldown Active
                </p>
                <p className="text-xs text-orange-700 dark:text-orange-300 mt-1">
                  {cooldownMessage}
                </p>
              </div>
            </div>
          )}

          {/* Info */}
          <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
            <AlertCircle className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-xs text-blue-800 dark:text-blue-200">
                {usernameInfo?.isPremium
                  ? 'You can change your username once every 7 days as a premium user'
                  : 'Free users can change username once every 30 days. Upgrade to premium for 7-day cooldown.'}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Edit Input */}
          <div>
            <div className="relative">
              <input
                type="text"
                value={newUsername}
                onChange={(e) => handleUsernameChange(e.target.value)}
                placeholder="Enter new username"
                className={`w-full h-12 bg-white dark:bg-gray-700 border rounded-md px-4 py-2 text-gray-900 dark:text-white font-mono focus:outline-none focus:ring-2 ${validationError || availabilityError
                  ? 'border-red-500 focus:ring-red-500'
                  : 'border-gray-300 dark:border-gray-600 focus:ring-purple-500'
                  }`}
                disabled={isSaving}
                maxLength={30}
              />
              {isChecking && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>

            {/* Character Count */}
            <div className="flex justify-between items-center mt-2">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                3-30 characters • Letters, numbers, spaces, _-.'
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {newUsername.length}/30
              </p>
            </div>

            {/* Validation Error */}
            {validationError && (
              <p className="text-sm text-red-600 dark:text-red-400 mt-2 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                {validationError}
              </p>
            )}

            {/* Availability Error */}
            {availabilityError && (
              <p className="text-sm text-red-600 dark:text-red-400 mt-2 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                {availabilityError}
              </p>
            )}

            {/* Success Indicator */}
            {!validationError &&
              !availabilityError &&
              !isChecking &&
              newUsername.length >= 3 &&
              newUsername.trim().toLowerCase() !== currentUsername.toLowerCase() && (
                <p className="text-sm text-green-600 dark:text-green-400 mt-2 flex items-center gap-1">
                  <Check className="w-4 h-4" />
                  {USERNAME_MESSAGES.SUCCESS}
                </p>
              )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={
                isSaving ||
                !newUsername ||
                !!validationError ||
                !!availabilityError ||
                isChecking ||
                newUsername.trim().toLowerCase() === currentUsername.toLowerCase()
              }
              className="flex-1 h-11 flex items-center justify-center gap-2 bg-gradient-to-r from-purple-500 to-orange-500 text-white rounded-md font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Save Username
                </>
              )}
            </button>
            <button
              onClick={handleCancelEdit}
              disabled={isSaving}
              className="h-11 px-4 flex items-center justify-center gap-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              <X className="w-4 h-4" />
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default UsernameChanger;
