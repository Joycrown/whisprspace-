'use client'

import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Mail, MessageSquare, Users, ThumbsUp, X, Filter } from 'lucide-react';
import { useNotifications, NotificationCategory } from '@/lib/notifications';
import { useUserStore } from '@/store/userStore';
import NotificationItem from './NotificationItem';

interface NotificationPanelProps {
  isOpen?: boolean;
  onClose?: () => void;
}

const NotificationPanel: React.FC<NotificationPanelProps> = ({
  isOpen = true,
  onClose,
}) => {
  const {
    notifications,
    isLoading,
    error,
    loadNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    deleteAllRead,
  } = useNotifications({ enableRealtime: true })

  const { session } = useUserStore();
  const notificationPrefs = session.user?.preferences?.notifications;
  const inAppEnabled = notificationPrefs?.inApp !== false;

  const [activeFilter, setActiveFilter] = useState<NotificationCategory | 'all'>('all');
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && inAppEnabled) {
      loadNotifications()
    }
  }, [isOpen, inAppEnabled, loadNotifications]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        onClose?.();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  const isAllowedByPrefs = (notification: { type: string; category: NotificationCategory }) => {
    if (!inAppEnabled) return false;
    if (notification.type === 'thread_like' && notification.category === 'interactions') {
      return notificationPrefs?.likes !== false;
    }
    if (notification.type === 'message_reply') {
      return notificationPrefs?.replies !== false;
    }
    if (notification.type === 'mention') {
      return notificationPrefs?.mentions !== false;
    }
    if (notification.type === 'group_invite' || notification.type === 'thread_invite') {
      return notificationPrefs?.groupInvites !== false;
    }
    return true;
  };

  const filteredNotifications = notifications.filter(n => {
    if (!isAllowedByPrefs(n)) return false;
    if (activeFilter === 'all') return true;
    return n.category === activeFilter;
  });

  const visibleUnreadCount = filteredNotifications.filter((n) => !n.isRead).length;

  const getCategoryIcon = (category: NotificationCategory) => {
    switch (category) {
      case 'interactions': return <MessageSquare className="w-4 h-4" />;
      case 'social': return <Users className="w-4 h-4" />;
      case 'system': return <Bell className="w-4 h-4" />;
      default: return <Bell className="w-4 h-4" />;
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        ref={panelRef}
        initial={{ opacity: 0, x: 300 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 300 }}
        transition={{ duration: 0.3 }}
        className="fixed top-0 right-0 app-full-height w-full max-w-sm bg-[#1A1A1A] shadow-lg flex flex-col z-50 border-l border-gray-800 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <h2 className="text-xl font-bold text-white">Notifications ({visibleUnreadCount > 0 ? visibleUnreadCount : ''})</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Filter Tabs */}
        <div className="flex px-4 py-2 border-b border-gray-800 bg-[#121212]">
          {['all', 'interactions', 'social', 'system'].map((filter) => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter as NotificationCategory | 'all')}
              className={`flex-1 py-2 text-center text-sm font-medium transition-colors ${
                activeFilter === filter ? 'text-white border-b-2 border-purple-500' : 'text-gray-500 hover:text-white'
              }`}
            >
              {filter.charAt(0).toUpperCase() + filter.slice(1)}
            </button>
          ))}
        </div>

        {/* Notification List */}
        <div className="flex-1 overflow-y-auto scrollbar-hide">
          {!inAppEnabled ? (
            <div className="p-4 text-gray-400">
              In-app notifications are turned off.
            </div>
          ) : isLoading ? (
            <div className="p-4 text-white">Loading notifications...</div>
          ) : error ? (
            <div className="p-4 text-red-500">Error: {error}</div>
          ) : filteredNotifications.length > 0 ? (
            <div>
              {filteredNotifications.map(notification => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onMarkAsRead={() => markAsRead(notification.id)}
                  onDelete={() => deleteNotification(notification.id)}
                />
              ))}
            </div>
          ) : (
            <p className="p-4 text-gray-400 text-center">No notifications to display.</p>
          )}
        </div>

        {/* Actions */}
        {filteredNotifications.length > 0 && (
          <div className="p-4 border-t border-gray-800 flex justify-end gap-3">
            {visibleUnreadCount > 0 && (
              <button 
                onClick={markAllAsRead}
                className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors text-sm"
              >
                Mark All as Read
              </button>
            )}
            <button
              onClick={deleteAllRead}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
            >
              Clear Read
            </button>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
};

export default NotificationPanel;
