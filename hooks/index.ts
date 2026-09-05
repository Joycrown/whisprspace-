/* eslint-disable @typescript-eslint/no-unused-vars */
// Custom React hooks for state management and API operations

import { useCallback, useEffect, useState } from 'react';
import {
  useUserStore,
  useThreadStore,
  useNotificationStore,
  useGroupStore,
  useUIStore
} from '../store';
import {
  Thread,
  Message,
  Group,
  Notification,
  User,
  CreateThreadForm,
  CreateGroupForm,
  ThreadFilters,
  AnonymousMessage
} from '@/types';
import { api } from '../lib/api';

export const useAuth = () => {
  const {
    session,
    isLoading,
    error,
    loginAnonymously,
    logout,
    updatePreferences,
    clearError,
    refreshSession
  } = useUserStore();

  const { user, isAuthenticated, sessionExpiry } = session;

  const handleLogin = useCallback(async () => {
    await loginAnonymously();
  }, [loginAnonymously]);

  const handleLogout = useCallback(async () => {
    await logout();
  }, [logout]);

  const handleUpdatePreferences = useCallback(async (preferences: User['preferences']) => {
    await updatePreferences(preferences);
  }, [updatePreferences]);

  const handleRefreshSession = useCallback(async () => {
    if (user?.sessionToken) {
      await refreshSession();
    }
  }, [user?.sessionToken, refreshSession]);

  return {
    user,
    sessionToken: user?.sessionToken || null,
    isAuthenticated,
    isLoading,
    error,
    login: handleLogin,
    logout: handleLogout,
    updatePreferences: handleUpdatePreferences,
    refreshSession: handleRefreshSession,
    clearError
  };
};

// Thread hooks
export const useThreads = (filters?: ThreadFilters) => {
  const {
    threads,
    currentThread,
    filters: storeFilters,
    isLoading,
    error,
    searchQuery,
    fetchThreads,
    createThread,
    updateThread,
    deleteThread,
    likeThread,
    clearCurrentThread,
    setFilters,
    setSearchQuery,
    clearError
  } = useThreadStore();

  useEffect(() => {
    if (filters) {
      setFilters(filters);
    }
  }, [filters, setFilters]);

  useEffect(() => {
    fetchThreads();
  }, [storeFilters, fetchThreads]);

  const handleCreateThread = useCallback(async (data: CreateThreadForm) => {
    return await createThread(data);
  }, [createThread]);

  const handleUpdateThread = useCallback(async (id: string, updates: Partial<Thread>) => {
    return await updateThread(id, updates);
  }, [updateThread]);

  const handleDeleteThread = useCallback(async (id: string) => {
    return await deleteThread(id);
  }, [deleteThread]);

  const handleLikeThread = useCallback(async (id: string) => {
    return await likeThread(id);
  }, [likeThread]);

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
  }, [setSearchQuery]);

  return {
    threads,
    currentThread,
    filters: storeFilters,
    isLoading,
    error,
    searchQuery,
    createThread: handleCreateThread,
    updateThread: handleUpdateThread,
    deleteThread: handleDeleteThread,
    likeThread: handleLikeThread,
    clearCurrentThread,
    search: handleSearch,
    refresh: fetchThreads,
    clearError
  };
};

// Single thread hook
export const useThread = (threadId?: string) => {
  const [thread, setThread] = useState<Thread | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchThread = useCallback(async (id: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.threads.getThread(id);
      if (response.success && response.data) {
        setThread(response.data);
      } else {
        setError(response.message || 'Failed to fetch thread');
      }
    } catch (err) {
      setError('Failed to fetch thread');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (threadId) {
      fetchThread(threadId);
    }
  }, [threadId, fetchThread]);

  return {
    thread,
    isLoading,
    error,
    refetch: () => threadId && fetchThread(threadId)
  };
};

// Messages hook
export const useMessages = (threadId?: string) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);

  const fetchMessages = useCallback(async (threadId: string, pageNum: number = 1, append: boolean = false) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.messages.getMessages(threadId, pageNum);
      if (response.success && response.data) {
        const newMessages = response.data.items;
        setMessages(prev => append ? [...prev, ...newMessages] : newMessages);
        setHasMore(response.data.pagination.hasNext);
        setPage(pageNum);
      } else {
        setError(response.message || 'Failed to fetch messages');
      }
    } catch (err) {
      setError('Failed to fetch messages');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createMessage = useCallback(async (content: string, parentId?: string) => {
    if (!threadId) return;
    
    try {
      const response = await api.messages.createMessage(threadId, content, parentId);
      if (response.success && response.data) {
        setMessages(prev => [...prev, response.data!]);
        return response.data;
      } else {
        setError(response.message || 'Failed to create message');
      }
    } catch (err) {
      setError('Failed to create message');
    }
  }, [threadId]);

  const likeMessage = useCallback(async (messageId: string) => {
    try {
      const response = await api.messages.likeMessage(messageId);
      if (response.success && response.data) {
        // Since Message interface doesn't have likes/isLiked properties,
        // we'll just return the response data without updating the message
        return response.data;
      } else {
        setError(response.message || 'Failed to like message');
      }
    } catch (err) {
      setError('Failed to like message');
    }
  }, []);

  const loadMore = useCallback(() => {
    if (threadId && hasMore && !isLoading) {
      fetchMessages(threadId, page + 1, true);
    }
  }, [threadId, hasMore, isLoading, page, fetchMessages]);

  useEffect(() => {
    if (threadId) {
      setMessages([]);
      setPage(1);
      setHasMore(true);
      fetchMessages(threadId);
    }
  }, [threadId, fetchMessages]);

  return {
    messages,
    isLoading,
    error,
    hasMore,
    createMessage,
    likeMessage,
    loadMore,
    refresh: () => threadId && fetchMessages(threadId)
  };
};

// Groups hook
export const useGroups = () => {
  const {
    groups,
    currentGroup,
    isLoading,
    error,
    fetchGroups,
    createGroup,
    joinGroup,
    leaveGroup,
    updateGroup,
    deleteGroup,
    generateInviteCode,
    // setCurrentGroup, // This property doesn't exist in GroupStore
    clearError
  } = useGroupStore();

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  const handleCreateGroup = useCallback(async (data: CreateGroupForm) => {
    return await createGroup(data);
  }, [createGroup]);

  const handleJoinGroup = useCallback(async (groupId: string, inviteCode?: string) => {
    return await joinGroup(groupId, inviteCode);
  }, [joinGroup]);

  const handleLeaveGroup = useCallback(async (groupId: string) => {
    return await leaveGroup(groupId);
  }, [leaveGroup]);

  const handleUpdateGroup = useCallback(async (groupId: string, updates: Partial<Group>) => {
    return await updateGroup(groupId, updates);
  }, [updateGroup]);

  const handleDeleteGroup = useCallback(async (groupId: string) => {
    return await deleteGroup(groupId);
  }, [deleteGroup]);

  const handleGenerateInviteCode = useCallback(async (groupId: string) => {
    return await generateInviteCode(groupId);
  }, [generateInviteCode]);

  return {
    groups,
    currentGroup,
    isLoading,
    error,
    createGroup: handleCreateGroup,
    joinGroup: handleJoinGroup,
    leaveGroup: handleLeaveGroup,
    updateGroup: handleUpdateGroup,
    deleteGroup: handleDeleteGroup,
    generateInviteCode: handleGenerateInviteCode,
    // setCurrentGroup, // Property doesn't exist
    refresh: fetchGroups,
    clearError
  };
};

// Single group hook
export const useGroup = (groupId?: string) => {
  const [group, setGroup] = useState<Group | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchGroup = useCallback(async (id: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.groups.getGroup(id);
      if (response.success && response.data) {
        setGroup(response.data);
      } else {
        setError(response.message || 'Failed to fetch group');
      }
    } catch (err) {
      setError('Failed to fetch group');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (groupId) {
      fetchGroup(groupId);
    }
  }, [groupId, fetchGroup]);

  return {
    group,
    isLoading,
    error,
    refetch: () => groupId && fetchGroup(groupId)
  };
};

// Notifications hook
export const useNotifications = () => {
  const {
    notifications,
    unreadCount,
    isLoading,
    error,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    // clearNotifications, // This property doesn't exist in NotificationStore
    clearError
  } = useNotificationStore();

  const { session: { user } } = useUserStore();

  useEffect(() => {
    if (user?.id) {
      fetchNotifications(user.id);
    }
  }, [fetchNotifications, user?.id]);

  const handleMarkAsRead = useCallback(async (id: string) => {
    await markAsRead(id);
  }, [markAsRead]);

  const handleMarkAllAsRead = useCallback(async () => {
    if (user?.id) {
      await markAllAsRead(user.id);
    }
  }, [markAllAsRead, user?.id]);

  const handleDeleteNotification = useCallback(async (id: string) => {
    await deleteNotification(id);
  }, [deleteNotification]);

  return {
    notifications,
    unreadCount,
    isLoading,
    error,
    markAsRead: handleMarkAsRead,
    markAllAsRead: handleMarkAllAsRead,
    deleteNotification: handleDeleteNotification,
    // clearAll: clearNotifications, // Property doesn't exist
    refresh: fetchNotifications,
    clearError
  };
};

// UI state hooks
export const useUI = () => {
  const {
    // modals, // Property doesn't exist in UIStore
    // navigation, // Property doesn't exist in UIStore
    isGlobalLoading,
    // toasts, // Property doesn't exist in UIStore
    // searchState, // Property doesn't exist in UIStore
    theme,
    // openModal, // Property doesn't exist in UIStore
    // closeModal, // Property doesn't exist in UIStore
    toggleSidebar,
    toggleMobileMenu,
    setActiveTab,
    setGlobalLoading,
    // showToast, // Property doesn't exist in UIStore
    // hideToast, // Property doesn't exist in UIStore
    setSearchQuery,
    // setSearchResults, // Property doesn't exist in UIStore
    // clearSearch, // Property doesn't exist in UIStore
    setTheme
  } = useUIStore();

  // Toast functions are now inline since showToast doesn't exist in UIStore

  return {
    // modals, // Property doesn't exist in UIStore
    // navigation, // Property doesn't exist in UIStore
    isGlobalLoading,
    // toasts, // Property doesn't exist in UIStore
    // searchState, // Property doesn't exist in UIStore
    theme,
    // openModal, // Property doesn't exist in UIStore
    // closeModal, // Property doesn't exist in UIStore
    toggleSidebar,
    toggleMobileMenu,
    setActiveTab,
    setGlobalLoading,
    // showToast, // Property doesn't exist in UIStore
    // hideToast, // Property doesn't exist in UIStore
    showSuccess: (message: string) => console.log('Success:', message),
    showError: (message: string) => console.error('Error:', message),
    showWarning: (message: string) => console.warn('Warning:', message),
    showInfo: (message: string) => console.info('Info:', message),
    setSearchQuery,
    // setSearchResults, // Property doesn't exist in UIStore
    // clearSearch, // Property doesn't exist in UIStore
    setTheme
  };
};

// Anonymous messages hook
export const useAnonymousMessages = () => {
  const [messages, setMessages] = useState<AnonymousMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMessages = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.anonymousMessages.getMessages();
      if (response.success && response.data) {
        setMessages(response.data.items);
      } else {
        setError(response.message || 'Failed to fetch anonymous messages');
      }
    } catch (err) {
      setError('Failed to fetch anonymous messages');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const sendMessage = useCallback(async (recipientId: string, content: string) => {
    try {
      const response = await api.anonymousMessages.sendMessage(recipientId, content);
      if (response.success && response.data) {
        return response.data;
      } else {
        setError(response.message || 'Failed to send message');
      }
    } catch (err) {
      setError('Failed to send message');
    }
  }, []);

  const markAsRead = useCallback(async (id: string) => {
    try {
      const response = await api.anonymousMessages.markAsRead(id);
      if (response.success) {
        setMessages(prev => prev.map(msg => 
          msg.id === id ? { ...msg, isRead: true } : msg
        ));
      } else {
        setError(response.message || 'Failed to mark message as read');
      }
    } catch (err) {
      setError('Failed to mark message as read');
    }
  }, []);

  const deleteMessage = useCallback(async (id: string) => {
    try {
      const response = await api.anonymousMessages.deleteMessage(id);
      if (response.success) {
        setMessages(prev => prev.filter(msg => msg.id !== id));
      } else {
        setError(response.message || 'Failed to delete message');
      }
    } catch (err) {
      setError('Failed to delete message');
    }
  }, []);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    markAsRead,
    deleteMessage,
    refresh: fetchMessages
  };
};

// Local storage hook
export const useLocalStorage = <T>(key: string, initialValue: T) => {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      if (typeof window !== 'undefined') {
        const item = window.localStorage.getItem(key);
        return item ? JSON.parse(item) : initialValue;
      }
      return initialValue;
    } catch (error) {
      console.error(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  const setValue = useCallback((value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
      }
    } catch (error) {
      console.error(`Error setting localStorage key "${key}":`, error);
    }
  }, [key, storedValue]);

  const removeValue = useCallback(() => {
    try {
      setStoredValue(initialValue);
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(key);
      }
    } catch (error) {
      console.error(`Error removing localStorage key "${key}":`, error);
    }
  }, [key, initialValue]);

  return [storedValue, setValue, removeValue] as const;
};

// Debounced value hook
export const useDebounce = <T>(value: T, delay: number): T => {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

// Media query hook
export const useMediaQuery = (query: string): boolean => {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const media = window.matchMedia(query);
      if (media.matches !== matches) {
        setMatches(media.matches);
      }
      const listener = () => setMatches(media.matches);
      media.addEventListener('change', listener);
      return () => media.removeEventListener('change', listener);
    }
  }, [matches, query]);

  return matches;
};

// Export all hooks
export * from '../store';
