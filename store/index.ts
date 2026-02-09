// Global state management exports
// This file serves as the main entry point for all Zustand stores

// Export store hooks
export { useUserStore } from './userStore';
export { useThreadStore } from './threadStore';
export { useNotificationStore } from './notificationStore';
export { useGroupStore } from './groupStore';
export { useUIStore } from './uiStore';

// Export store types
export type { UserStore } from './userStore';
export type { ThreadStore } from './threadStore';
export type { NotificationStore } from './notificationStore';
export type { GroupStore } from './groupStore';
export type { UIStore, Toast } from './uiStore';

// Export utility functions
export { 
  showSuccessToast, 
  showErrorToast, 
  showWarningToast, 
  showInfoToast 
} from './uiStore';

// Store initialization helper
export const initializeStores = () => {
  // This function can be called on app startup to initialize stores
  // Currently, stores are initialized lazily when first accessed
  console.log('Zustand stores initialized');
};
