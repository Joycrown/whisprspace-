import React, { useEffect, useState } from 'react';
import { useUserStore } from '@/store/userStore';
import { useNotifications, NotificationCategory, NotificationType } from '@/lib/notifications';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import { FaCheckCircle, FaHeart, FaUsers, FaBell, FaAt, FaReply, FaClock, FaTrophy, FaTrash, FaEnvelopeOpenText } from 'react-icons/fa';
import AppLoadingState from '@/components/ui/AppLoadingState';
import { buildThreadPath } from '@/lib/threads/thread-url';

const NotificationFeed: React.FC = () => {
  const { session } = useUserStore();
  const {
    notifications,
    isLoading,
    error,
    loadNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  } = useNotifications({ enableRealtime: true });

  const [activeFilter, setActiveFilter] = useState<NotificationCategory>('all');

  const notificationPrefs = session.user?.preferences?.notifications;
  const inAppEnabled = notificationPrefs?.inApp !== false;

  const isAllowedByPrefs = (notification: { type: NotificationType; category: NotificationCategory }) => {
    if (!inAppEnabled) return false;
    if (notification.type === 'thread_like' && notification.category === 'interactions') {
      return notificationPrefs?.likes !== false;
    }
    if (notification.type === 'message_reply') {
      return notificationPrefs?.replies !== false;
    }
    if (notification.type === 'thread_message') {
      return notificationPrefs?.replies !== false;
    }
    if (notification.type === 'direct_message') {
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

  useEffect(() => {
    if (!session.user || !inAppEnabled) return;
    loadNotifications({
      category: activeFilter === 'all' ? undefined : activeFilter,
    });
  }, [session.user, activeFilter, inAppEnabled, loadNotifications]);

  const notificationIcons: Partial<Record<NotificationType, React.ReactNode>> = {
    thread_like: <FaHeart className="text-red-400" />,
    thread_message: <FaEnvelopeOpenText className="text-blue-400" />,
    direct_message: <FaEnvelopeOpenText className="text-blue-400" />,
    message_reply: <FaReply className="text-teal-400" />,
    mention: <FaAt className="text-indigo-400" />,
    group_invite: <FaUsers className="text-purple-400" />,
    thread_invite: <FaUsers className="text-purple-400" />,
    poll_ending_soon: <FaClock className="text-yellow-400" />,
    thread_expiring_soon: <FaClock className="text-orange-400" />,
    achievement_unlocked: <FaTrophy className="text-yellow-500" />,
  };

  const filterOptions: { value: NotificationCategory; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'interactions', label: 'Interactions' },
    { value: 'social', label: 'Social' },
    { value: 'system', label: 'System' },
  ];

  const getActionUrl = (notification: { data?: Record<string, unknown> }) => {
    const data = notification.data || {};
    const conversationId =
      (typeof data.conversation_id === 'string' && data.conversation_id) ||
      (typeof data.conversationId === 'string' && data.conversationId) ||
      null;
    if (typeof data.thread_id === 'string') {
      const threadTitle =
        (typeof data.thread_title === 'string' && data.thread_title) ||
        (typeof data.threadTitle === 'string' && data.threadTitle) ||
        undefined;
      return buildThreadPath({ id: data.thread_id, title: threadTitle });
    }
    if (conversationId) return `/inbox?conversationId=${encodeURIComponent(conversationId)}`;
    if (typeof data.group_id === 'string') return `/groups/${data.group_id}`;
    return null;
  };

  if (!session.user) {
    return (
      <div className="min-h-screen bg-[#121212] text-white p-6">
        <div className="max-w-3xl mx-auto bg-gray-900 rounded-lg shadow-lg p-6">
          <h1 className="text-3xl font-bold mb-4">Notifications</h1>
          <p className="text-gray-400">Sign in to view your notifications.</p>
        </div>
      </div>
    );
  }

  if (!inAppEnabled) {
    return (
      <div className="min-h-screen bg-[#121212] text-white p-6">
        <div className="max-w-3xl mx-auto bg-gray-900 rounded-lg shadow-lg p-6">
          <h1 className="text-3xl font-bold mb-4">Notifications</h1>
          <p className="text-gray-400">
            In-app notifications are turned off. Enable them in your notification preferences to see updates here.
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <AppLoadingState
        fullScreen={false}
        className="bg-transparent py-12"
        title="Pulling your latest alerts..."
      />
    );
  }
  if (error) return <div className="p-4 text-red-500">Error: {error}</div>;

  const visibleNotifications = notifications.filter(isAllowedByPrefs);
  const visibleUnreadCount = visibleNotifications.filter((n) => !n.isRead).length;

  return (
    <div className="min-h-screen bg-[#121212] text-white p-6">
      <div className="max-w-3xl mx-auto bg-gray-900 rounded-lg shadow-lg p-6">
        <h1 className="text-3xl font-bold mb-6">Notifications ({visibleUnreadCount} unread)</h1>

        {/* Filter and Mark All as Read */}
        <div className="flex flex-col sm:flex-row items-center justify-between mb-6 gap-4">
          <div className="flex-1 w-full sm:w-auto">
            <label htmlFor="notification-filter" className="sr-only">Filter Notifications</label>
            <select
              id="notification-filter"
              className="block w-full rounded-md bg-gray-800 border-gray-700 text-white shadow-sm focus:border-purple-500 focus:ring-purple-500 sm:text-sm"
              value={activeFilter}
              onChange={(e) => setActiveFilter(e.target.value as NotificationCategory)}
            >
              {filterOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={() => markAllAsRead()}
            className="w-full sm:w-auto px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors flex items-center justify-center gap-2"
            disabled={visibleUnreadCount === 0}
          >
            <FaCheckCircle className="w-4 h-4" /> Mark All As Read
          </button>
        </div>

        {/* Notification List */}
        {visibleNotifications.length > 0 ? (
          <div className="space-y-4">
            {visibleNotifications.map(notification => {
              const actionUrl = getActionUrl(notification);
              return (
              <div
                key={notification.id}
                className={`flex items-start gap-4 p-4 rounded-lg transition-colors 
                           ${notification.isRead ? 'bg-gray-800 text-gray-400' : 'bg-gray-700 hover:bg-gray-600 text-white'}`}
              >
                <div className="flex-shrink-0 text-2xl mt-1">
                  {notificationIcons[notification.type] || <FaBell className="text-gray-500" />}
                </div>
                <div className="flex-1">
                  {actionUrl ? (
                    <Link href={actionUrl} onClick={() => markAsRead(notification.id)} className="block">
                      <h3 className="font-semibold text-lg">{notification.title}</h3>
                      <p className="text-sm">{notification.message}</p>
                    </Link>
                  ) : (
                    <>
                      <h3 className="font-semibold text-lg">{notification.title}</h3>
                      <p className="text-sm">{notification.message}</p>
                    </>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                  </p>
                </div>
                {!notification.isRead && (
                  <button 
                    onClick={() => markAsRead(notification.id)}
                    className="flex-shrink-0 text-purple-400 hover:text-purple-300 p-2 rounded-full hover:bg-gray-800 transition-colors"
                    title="Mark as Read"
                  >
                    <FaCheckCircle className="w-5 h-5" />
                  </button>
                )}
                <button
                  onClick={() => deleteNotification(notification.id)}
                  className="flex-shrink-0 text-gray-400 hover:text-red-400 p-2 rounded-full hover:bg-gray-800 transition-colors"
                  title="Delete"
                >
                  <FaTrash className="w-4 h-4" />
                </button>
              </div>
            )})}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            No notifications yet.
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationFeed;
