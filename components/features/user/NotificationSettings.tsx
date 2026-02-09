'use client'
import React, { useState, useEffect } from 'react';
import { useUserStore } from '@/store/userStore';
import { UserPreferences } from '@/types';
import { Switch } from '@headlessui/react';

const NotificationSettings: React.FC = () => {
  const { session, updateUserPreferences } = useUserStore();
  const [preferences, setPreferences] = useState<UserPreferences>(session.user?.preferences || {
    theme: 'dark',
    notifications: {
      email: false,
      push: true,
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
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (session.user?.preferences) {
      setPreferences(session.user.preferences);
    }
  }, [session.user?.preferences]);

  useEffect(() => {
    const currentPrefs = session.user?.preferences;
    if (!currentPrefs) return;

    const changed = JSON.stringify(preferences) !== JSON.stringify(currentPrefs);
    setHasChanges(changed);
  }, [preferences, session.user?.preferences]);

  const handleToggleChange = (category: keyof UserPreferences['notifications']) => {
    setPreferences(prev => ({
      ...prev,
      notifications: {
        ...prev.notifications,
        [category]: !prev.notifications[category],
      },
    }));
  };

  const handleSave = () => {
    updateUserPreferences(preferences);
    setHasChanges(false);
  };

  const handleCancel = () => {
    if (session.user?.preferences) {
      setPreferences(session.user.preferences);
    }
    setHasChanges(false);
  };

  return (
    <div className="bg-gray-900 rounded-lg shadow-lg p-6 max-w-2xl mx-auto text-white">
      <h2 className="text-2xl font-bold mb-6">Notification Settings</h2>

      <div className="space-y-6">
        {/* General Notification Types */}
        <div>
          <h3 className="text-xl font-semibold mb-4 border-b border-gray-700 pb-2">Channels</h3>
          <div className="space-y-4">
            {Object.entries(preferences.notifications).slice(0, 3).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between">
                <span className="capitalize text-lg">{key} Notifications</span>
                <Switch
                  checked={value}
                  onChange={() => handleToggleChange(key as keyof UserPreferences['notifications'])}
                  className={`${value ? 'bg-purple-600' : 'bg-gray-700'}
                    relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2`}
                >
                  <span className="sr-only">Enable {key} notifications</span>
                  <span
                    className={`${value ? 'translate-x-6' : 'translate-x-1'}
                      inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
                  />
                </Switch>
              </div>
            ))}
          </div>
        </div>

        {/* Event-Based Notifications */}
        <div>
          <h3 className="text-xl font-semibold mb-4 border-b border-gray-700 pb-2">Event-Based</h3>
          <div className="space-y-4">
            {Object.entries(preferences.notifications).slice(3).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between">
                <span className="capitalize text-lg">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                <Switch
                  checked={value}
                  onChange={() => handleToggleChange(key as keyof UserPreferences['notifications'])}
                  className={`${value ? 'bg-purple-600' : 'bg-gray-700'}
                    relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2`}
                >
                  <span className="sr-only">Enable {key.replace(/([A-Z])/g, ' $1').trim()} notifications</span>
                  <span
                    className={`${value ? 'translate-x-6' : 'translate-x-1'}
                      inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
                  />
                </Switch>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mt-8 flex justify-end space-x-4">
        <button
          onClick={handleCancel}
          className="px-4 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-600 transition-colors"
          disabled={!hasChanges}
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors disabled:opacity-50"
          disabled={!hasChanges}
        >
          Save Changes
        </button>
      </div>
    </div>
  );
};

export default NotificationSettings;
