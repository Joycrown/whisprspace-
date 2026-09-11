'use client'

import React, { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Mail, Bell, ThumbsUp, MessageSquare, Users, AtSign, Check, AlertCircle, Loader2 } from 'lucide-react';
import { useUserStore } from '@/store/userStore';
import { UserPreferences } from '@/types';
import {
  getCurrentPushSubscription,
  isIosInstallRequiredForPush,
  isPushSupported,
  sendPushTestNotification,
  subscribeDeviceToPush,
  unsubscribeDeviceFromPush,
} from '@/lib/notifications/push-client';

interface NotificationPreferencesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type EnableNotice = { tone: 'success' | 'error'; message: string } | null;

const NotificationPreferencesModal: React.FC<NotificationPreferencesModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { session, updatePreferences, isLoading, error } = useUserStore();
  const [preferences, setPreferences] = useState<UserPreferences>(session.user?.preferences || {
    theme: 'dark',
    notifications: {
      email: false,
      push: false,
      inApp: true,
      likes: true,
      replies: true,
      mentions: true,
      groupInvites: true,
    },
    privacy: {
      showOnlineStatus: true,
      allowDirectMessages: true,
    },
  });

  // Push has its own confirmed-working state, separate from the plain toggles
  // above: a single "Enable" tap subscribes, sends a real test notification,
  // and only then counts as done — so this never has to be revisited.
  const [isPushConfirmed, setIsPushConfirmed] = useState(false);
  const [isEnablingPush, setIsEnablingPush] = useState(false);
  const [pushNotice, setPushNotice] = useState<EnableNotice>(null);
  const [requiresIosInstall, setRequiresIosInstall] = useState(false);
  const [isBrowserSupported, setIsBrowserSupported] = useState(true);

  useEffect(() => {
    if (session.user?.preferences) {
      setPreferences(session.user.preferences);
    }
  }, [session.user?.preferences]);

  const syncPushStatus = useCallback(async () => {
    const supported = isPushSupported();
    setIsBrowserSupported(supported);
    setRequiresIosInstall(isIosInstallRequiredForPush());

    if (!supported) {
      setIsPushConfirmed(false);
      return;
    }

    const hasPermission = Notification.permission === 'granted';
    const subscription = await getCurrentPushSubscription();
    const prefersPush = session.user?.preferences?.notifications?.push === true;
    setIsPushConfirmed(Boolean(subscription && hasPermission && prefersPush));
  }, [session.user?.preferences?.notifications?.push]);

  useEffect(() => {
    if (!isOpen) return;
    setPushNotice(null);
    syncPushStatus();
  }, [isOpen, syncPushStatus]);

  const handleToggle = (category: keyof UserPreferences['notifications']) => {
    setPreferences(prev => ({
      ...prev,
      notifications: {
        ...prev.notifications,
        [category]: !prev.notifications[category],
      },
    }));
  };

  const handleEnablePush = async () => {
    if (!isBrowserSupported || isEnablingPush) return;
    setPushNotice(null);
    setIsEnablingPush(true);

    try {
      await subscribeDeviceToPush();
      await sendPushTestNotification();

      if (session.user?.preferences) {
        await updatePreferences({
          ...session.user.preferences,
          notifications: { ...session.user.preferences.notifications, push: true },
        });
      }
      setPreferences(prev => ({ ...prev, notifications: { ...prev.notifications, push: true } }));
      setIsPushConfirmed(true);
      setPushNotice({ tone: 'success', message: 'Notifications enabled — you\'re all set.' });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Something went wrong.';
      const permissionIssue = Notification.permission === 'denied' || /denied|not supported/i.test(message);
      setPushNotice({
        tone: 'error',
        message: permissionIssue
          ? 'Notifications are blocked for this site. Enable them in your browser or device settings, then try again.'
          : message,
      });
    } finally {
      setIsEnablingPush(false);
    }
  };

  const handleDisablePush = async () => {
    if (isEnablingPush) return;
    setPushNotice(null);
    setIsEnablingPush(true);

    try {
      await unsubscribeDeviceFromPush();
      if (session.user?.preferences) {
        await updatePreferences({
          ...session.user.preferences,
          notifications: { ...session.user.preferences.notifications, push: false },
        });
      }
      setPreferences(prev => ({ ...prev, notifications: { ...prev.notifications, push: false } }));
      setIsPushConfirmed(false);
    } catch (cause) {
      setPushNotice({
        tone: 'error',
        message: cause instanceof Error ? cause.message : 'Could not turn off notifications.',
      });
    } finally {
      setIsEnablingPush(false);
    }
  };

  const handleSubmit = async () => {
    if (session.user) {
      await updatePreferences(preferences);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center modal-safe-overlay"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-white rounded-xl shadow-2xl w-full max-w-2xl modal-safe-panel overflow-y-auto p-6 text-gray-900"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">Notification Preferences</h2>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="space-y-6">
            <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4">
              <h3 className="text-base font-semibold text-indigo-900">Why enable notifications?</h3>
              <p className="mt-1 text-sm text-indigo-800">
                Get alerts for replies, mentions, invites, and thread activity before they are buried.
              </p>
              <p className="mt-2 text-xs text-indigo-700">
                Mention tip: type <span className="font-semibold">@username</span> or <span className="font-semibold">@ANON_12345678</span> in a thread message to tag someone.
              </p>
            </div>

            {/* Push — one-tap enable, confirmed with a real test notification */}
            <div>
              <h3 className="text-xl font-semibold mb-3">Push Notifications</h3>

              {!isBrowserSupported && (
                <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg flex items-center gap-2 mb-3">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <span>This browser/device does not support push notifications.</span>
                </div>
              )}

              {requiresIosInstall && (
                <div className="p-3 bg-blue-100 border border-blue-300 text-blue-800 rounded-lg flex items-center gap-2 mb-3">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <span>On iOS, install the app to your Home Screen first, then enable notifications from the installed app.</span>
                </div>
              )}

              {isPushConfirmed ? (
                <div className="p-3 bg-green-100 border border-green-400 text-green-700 rounded-lg flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <Check className="w-5 h-5 flex-shrink-0" />
                    Push notifications are on for this device.
                  </span>
                  <button
                    type="button"
                    onClick={handleDisablePush}
                    disabled={isEnablingPush}
                    className="text-sm font-medium text-green-800 underline hover:text-green-900 disabled:opacity-50"
                  >
                    Turn off
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleEnablePush}
                  disabled={!isBrowserSupported || isEnablingPush}
                  className="w-full flex items-center justify-center gap-2 p-3 rounded-lg bg-purple-600 text-white font-medium hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isEnablingPush ? <Loader2 className="w-5 h-5 animate-spin" /> : <Bell className="w-5 h-5" />}
                  {isEnablingPush ? 'Enabling…' : 'Enable notifications'}
                </button>
              )}

              {pushNotice && (
                <div
                  className={`mt-3 p-3 rounded-lg flex items-center gap-2 ${
                    pushNotice.tone === 'success'
                      ? 'bg-green-100 border border-green-400 text-green-700'
                      : 'bg-red-100 border border-red-400 text-red-700'
                  }`}
                >
                  {pushNotice.tone === 'success' ? <Check className="w-5 h-5 flex-shrink-0" /> : <AlertCircle className="w-5 h-5 flex-shrink-0" />}
                  <span>{pushNotice.message}</span>
                </div>
              )}
            </div>

            {/* General Notification Types */}
            <div>
              <h3 className="text-xl font-semibold mb-3">Delivery Methods</h3>
              <div className="space-y-4">
                <NotificationToggle
                  icon={<Mail className="w-5 h-5" />}
                  label="Email Notifications"
                  checked={preferences.notifications.email}
                  onToggle={() => handleToggle('email')}
                />
                <NotificationToggle
                  icon={<Bell className="w-5 h-5" />}
                  label="In-App Notifications"
                  checked={preferences.notifications.inApp}
                  onToggle={() => handleToggle('inApp')}
                />
              </div>
            </div>

            {/* Category-specific Notifications */}
            <div>
              <h3 className="text-xl font-semibold mb-3">Content Notifications</h3>
              <div className="space-y-4">
                <NotificationToggle
                  icon={<ThumbsUp className="w-5 h-5" />}
                  label="Likes"
                  checked={preferences.notifications.likes}
                  onToggle={() => handleToggle('likes')}
                />
                <NotificationToggle
                  icon={<MessageSquare className="w-5 h-5" />}
                  label="Replies"
                  checked={preferences.notifications.replies}
                  onToggle={() => handleToggle('replies')}
                />
                <NotificationToggle
                  icon={<AtSign className="w-5 h-5" />}
                  label="Mentions"
                  checked={preferences.notifications.mentions}
                  onToggle={() => handleToggle('mentions')}
                />
                <NotificationToggle
                  icon={<Users className="w-5 h-5" />}
                  label="Group Invites"
                  checked={preferences.notifications.groupInvites}
                  onToggle={() => handleToggle('groupInvites')}
                />
              </div>
            </div>
          </div>

          {error && <p className="mt-4 text-sm text-red-600 text-center">Error: {error}</p>}

          <div className="flex justify-end mt-6">
            <button
              onClick={handleSubmit}
              disabled={isLoading}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
            >
              {isLoading ? 'Saving...' : 'Save Preferences'}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default NotificationPreferencesModal;

interface NotificationToggleProps {
  icon: React.ReactNode;
  label: string;
  checked: boolean;
  onToggle: () => void;
}

const NotificationToggle: React.FC<NotificationToggleProps> = ({
  icon,
  label,
  checked,
  onToggle
}) => {
  return (
    <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
      <div className="flex items-center gap-3">
        <div className="text-purple-600 flex-shrink-0">
          {icon}
        </div>
        <span className="text-gray-800 font-medium">{label}</span>
      </div>
      <button
        type="button"
        onClick={onToggle}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 ${
          checked ? 'bg-purple-600' : 'bg-gray-200'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            checked ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );
};
