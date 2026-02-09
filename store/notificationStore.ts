/* eslint-disable @typescript-eslint/no-unused-vars */
import { create } from 'zustand';
import { Notification, NotificationCategory, NotificationType } from '@/types';
import { mockNotifications } from '@/lib/utils/utils/DummyData';

interface NotificationStore {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  error: string | null;
  filters: { category: NotificationCategory };

  fetchNotifications: (userId: string) => Promise<void>;
  markAsRead: (notificationId: string) => void;
  markAllAsRead: (userId: string) => void;
  deleteNotification: (notificationId: string) => void;
  setNotificationFilter: (category: NotificationCategory) => void;
  clearError: () => void;
}

const mockFetchNotifications = async (
  userId: string,
  filterCategory: NotificationCategory
): Promise<Notification[]> => {
  await new Promise((resolve) => setTimeout(resolve, 500));

  let filteredNotifications = mockNotifications.filter(notif => notif.userId === userId);

  if (filterCategory !== 'all') {
    filteredNotifications = filteredNotifications.filter(notif => notif.category === filterCategory);
  }

  return filteredNotifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
};

export const useNotificationStore = create<NotificationStore>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  isLoading: false,
  error: null,
  filters: { category: 'all' },

  fetchNotifications: async (userId: string) => {
    set({ isLoading: true, error: null });
    try {
      const { filters } = get();
      const fetchedNotifications = await mockFetchNotifications(userId, filters.category);
      const unread = fetchedNotifications.filter(notif => !notif.read).length;
      set({ notifications: fetchedNotifications, unreadCount: unread, isLoading: false });
    } catch (error) {
      set({ error: 'Failed to fetch notifications', isLoading: false });
    }
  },

  markAsRead: (notificationId: string) => {
    set(state => {
      const updatedNotifications = state.notifications.map(notif =>
        notif.id === notificationId ? { ...notif, read: true } : notif
      );
      const unread = updatedNotifications.filter(notif => !notif.read).length;
      return { notifications: updatedNotifications, unreadCount: unread };
    });
  },

  markAllAsRead: (userId: string) => {
    set(state => {
      const updatedNotifications = state.notifications.map(notif =>
        notif.userId === userId && !notif.read ? { ...notif, read: true } : notif
      );
      return { notifications: updatedNotifications, unreadCount: 0 };
    });
  },

  deleteNotification: (notificationId: string) => {
    set(state => ({
      notifications: state.notifications.filter(n => n.id !== notificationId)
    }));
  },

  setNotificationFilter: (category: NotificationCategory) => {
    set(state => ({
      filters: { ...state.filters, category },
      // Re-fetch notifications with new filter (or simply re-filter existing ones if already fetched)
      // For this mock, we'll trigger a full fetch.
    }));
    get().fetchNotifications('current_user'); // Assuming 'current_user' for mock
  },

  clearError: () => {
    set({ error: null });
  },
}));
