'use client'

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Mail, Bell, Smartphone, ThumbsUp, MessageSquare, Users, AtSign, Settings } from 'lucide-react';
import { useUserStore } from '@/store/userStore';
import { UserPreferences } from '@/types';
import PushNotificationSettingsModal from './PushNotificationSettingsModal';

interface NotificationPreferencesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

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
  const [showPushSettingsModal, setShowPushSettingsModal] = useState(false);

  useEffect(() => {
    if (session.user?.preferences) {
      setPreferences(session.user.preferences);
    }
  }, [session.user?.preferences]);

  const handleToggle = (category: keyof UserPreferences['notifications']) => {
    setPreferences(prev => ({
      ...prev,
      notifications: {
        ...prev.notifications,
        [category]: !prev.notifications[category],
      },
    }));
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
                  icon={<Smartphone className="w-5 h-5" />} 
                  label="Push Notifications" 
                  checked={preferences.notifications.push}
                  onToggle={() => handleToggle('push')}
                />
                <NotificationToggle 
                  icon={<Bell className="w-5 h-5" />} 
                  label="In-App Notifications" 
                  checked={preferences.notifications.inApp}
                  onToggle={() => handleToggle('inApp')}
                />
              </div>
            </div>

            {/* Push Notification Button */}
            <div className="border-t border-gray-200 pt-6 mt-6">
              <button
                onClick={() => setShowPushSettingsModal(true)}
                className="w-full flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-gray-800 font-medium"
              >
                <div className="flex items-center gap-3">
                  <Settings className="w-5 h-5 text-gray-700" />
                  <span>Manage Push Notification Settings</span>
                </div>
                <Bell className="w-5 h-5 text-purple-600" />
              </button>
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

      {/* Push Notification Settings Modal */}
      <PushNotificationSettingsModal
        isOpen={showPushSettingsModal}
        onClose={() => setShowPushSettingsModal(false)}
      />
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
