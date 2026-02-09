import { create } from 'zustand';

export interface UIStore {
  // Modal states
  isCreateThreadModalOpen: boolean;
  isCreateGroupModalOpen: boolean;
  isJoinGroupModalOpen: boolean;
  isProfileModalOpen: boolean;
  isSettingsModalOpen: boolean;
  isAnonymousMessageModalOpen: boolean;
  
  // Navigation states
  isSidebarOpen: boolean;
  isMobileMenuOpen: boolean;
  activeTab: string;
  
  // Loading states
  isGlobalLoading: boolean;
  loadingMessage: string;
  
  // Toast/notification states
  toasts: Toast[];
  
  // Search states
  isSearchOpen: boolean;
  searchQuery: string;
  
  // Theme states
  theme: 'light' | 'dark' | 'system';
  
  // Actions
  openCreateThreadModal: () => void;
  closeCreateThreadModal: () => void;
  openCreateGroupModal: () => void;
  closeCreateGroupModal: () => void;
  openJoinGroupModal: () => void;
  closeJoinGroupModal: () => void;
  openProfileModal: () => void;
  closeProfileModal: () => void;
  openSettingsModal: () => void;
  closeSettingsModal: () => void;
  openAnonymousMessageModal: () => void;
  closeAnonymousMessageModal: () => void;
  closeAllModals: () => void;
  
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  toggleMobileMenu: () => void;
  setMobileMenuOpen: (open: boolean) => void;
  setActiveTab: (tab: string) => void;
  
  setGlobalLoading: (loading: boolean, message?: string) => void;
  
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
  clearToasts: () => void;
  
  setSearchOpen: (open: boolean) => void;
  setSearchQuery: (query: string) => void;
  
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
}

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number; // in milliseconds, 0 means persistent
  action?: {
    label: string;
    onClick: () => void;
  };
}

const generateToastId = (): string => {
  return `toast_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

export const useUIStore = create<UIStore>()((set, get) => ({
  // Initial modal states
  isCreateThreadModalOpen: false,
  isCreateGroupModalOpen: false,
  isJoinGroupModalOpen: false,
  isProfileModalOpen: false,
  isSettingsModalOpen: false,
  isAnonymousMessageModalOpen: false,
  
  // Initial navigation states
  isSidebarOpen: true,
  isMobileMenuOpen: false,
  activeTab: 'home',
  
  // Initial loading states
  isGlobalLoading: false,
  loadingMessage: '',
  
  // Initial toast states
  toasts: [],
  
  // Initial search states
  isSearchOpen: false,
  searchQuery: '',
  
  // Initial theme state
  theme: 'system',
  
  // Modal actions
  openCreateThreadModal: () => set({ isCreateThreadModalOpen: true }),
  closeCreateThreadModal: () => set({ isCreateThreadModalOpen: false }),
  
  openCreateGroupModal: () => set({ isCreateGroupModalOpen: true }),
  closeCreateGroupModal: () => set({ isCreateGroupModalOpen: false }),
  
  openJoinGroupModal: () => set({ isJoinGroupModalOpen: true }),
  closeJoinGroupModal: () => set({ isJoinGroupModalOpen: false }),
  
  openProfileModal: () => set({ isProfileModalOpen: true }),
  closeProfileModal: () => set({ isProfileModalOpen: false }),
  
  openSettingsModal: () => set({ isSettingsModalOpen: true }),
  closeSettingsModal: () => set({ isSettingsModalOpen: false }),
  
  openAnonymousMessageModal: () => set({ isAnonymousMessageModalOpen: true }),
  closeAnonymousMessageModal: () => set({ isAnonymousMessageModalOpen: false }),
  
  closeAllModals: () => set({
    isCreateThreadModalOpen: false,
    isCreateGroupModalOpen: false,
    isJoinGroupModalOpen: false,
    isProfileModalOpen: false,
    isSettingsModalOpen: false,
    isAnonymousMessageModalOpen: false,
  }),
  
  // Navigation actions
  toggleSidebar: () => set(state => ({ isSidebarOpen: !state.isSidebarOpen })),
  setSidebarOpen: (open: boolean) => set({ isSidebarOpen: open }),
  
  toggleMobileMenu: () => set(state => ({ isMobileMenuOpen: !state.isMobileMenuOpen })),
  setMobileMenuOpen: (open: boolean) => set({ isMobileMenuOpen: open }),
  
  setActiveTab: (tab: string) => set({ activeTab: tab }),
  
  // Loading actions
  setGlobalLoading: (loading: boolean, message = '') => set({ 
    isGlobalLoading: loading, 
    loadingMessage: message 
  }),
  
  // Toast actions
  addToast: (toast: Omit<Toast, 'id'>) => {
    const newToast: Toast = {
      ...toast,
      id: generateToastId(),
      duration: toast.duration ?? 5000, // Default 5 seconds
    };
    
    set(state => ({ toasts: [...state.toasts, newToast] }));
    
    // Auto-remove toast after duration (if not persistent)
    if (newToast.duration && newToast.duration > 0) {
      setTimeout(() => {
        get().removeToast(newToast.id);
      }, newToast.duration);
    }
  },
  
  removeToast: (id: string) => {
    set(state => ({ toasts: state.toasts.filter(toast => toast.id !== id) }));
  },
  
  clearToasts: () => set({ toasts: [] }),
  
  // Search actions
  setSearchOpen: (open: boolean) => set({ isSearchOpen: open }),
  setSearchQuery: (query: string) => set({ searchQuery: query }),
  
  // Theme actions
  setTheme: (theme: 'light' | 'dark' | 'system') => set({ theme }),
}));

// Helper functions for common toast types
export const showSuccessToast = (title: string, message?: string) => {
  useUIStore.getState().addToast({
    type: 'success',
    title,
    message,
  });
};

export const showErrorToast = (title: string, message?: string) => {
  useUIStore.getState().addToast({
    type: 'error',
    title,
    message,
    duration: 7000, // Longer duration for errors
  });
};

export const showWarningToast = (title: string, message?: string) => {
  useUIStore.getState().addToast({
    type: 'warning',
    title,
    message,
  });
};

export const showInfoToast = (title: string, message?: string) => {
  useUIStore.getState().addToast({
    type: 'info',
    title,
    message,
  });
};
