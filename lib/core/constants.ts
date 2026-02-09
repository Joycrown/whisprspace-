// Application Constants
// Centralized configuration and constant values

// App Configuration
export const APP_CONFIG = {
  name: 'WhisprSpace',
  version: '1.0.0',
  description: 'Anonymous community platform for authentic conversations',
  url: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  api: {
    baseUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api',
    timeout: 10000, // 10 seconds
  },
} as const;

// Authentication Constants
export const AUTH_CONFIG = {
  sessionDuration: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
  refreshThreshold: 60 * 60 * 1000, // 1 hour before expiry
  anonymousIdLength: 12,
  sessionTokenLength: 32,
  maxLoginAttempts: 5,
  lockoutDuration: 15 * 60 * 1000, // 15 minutes
} as const;

// Thread Constants
export const THREAD_CONFIG = {
  maxTitleLength: 200,
  maxContentLength: 5000,
  maxAttachments: 5,
  maxFileSize: 10 * 1024 * 1024, // 10MB
  allowedFileTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'audio/mpeg', 'audio/wav'],
  maxVoiceRecordingDuration: 300, // 5 minutes in seconds
  defaultPageSize: 20,
  maxPageSize: 100,
} as const;

// Group Constants
export const GROUP_CONFIG = {
  maxNameLength: 100,
  maxDescriptionLength: 500,
  maxRulesLength: 1000,
  maxMembers: {
    public: 1000,
    invite_only: 500,
    private: 100,
  },
  inviteCodeLength: 8,
  inviteCodeExpiry: 7 * 24 * 60 * 60 * 1000, // 7 days
} as const;

// Message Constants
export const MESSAGE_CONFIG = {
  maxLength: 2000,
  maxAttachments: 3,
  editTimeLimit: 15 * 60 * 1000, // 15 minutes
  deleteTimeLimit: 60 * 60 * 1000, // 1 hour
  typingIndicatorTimeout: 3000, // 3 seconds
} as const;

// Notification Constants
export const NOTIFICATION_CONFIG = {
  maxRetention: 30 * 24 * 60 * 60 * 1000, // 30 days
  batchSize: 50,
  pushEnabled: true,
  emailEnabled: false, // Disabled for anonymous platform
} as const;

// UI Constants
export const UI_CONFIG = {
  breakpoints: {
    sm: 640,
    md: 768,
    lg: 1024,
    xl: 1280,
    '2xl': 1536,
  },
  animations: {
    fast: 150,
    normal: 300,
    slow: 500,
  },
  toast: {
    defaultDuration: 5000,
    errorDuration: 7000,
    successDuration: 3000,
    maxToasts: 5,
  },
  sidebar: {
    width: 280,
    collapsedWidth: 80,
  },
} as const;

// Theme Constants
export const THEME_CONFIG = {
  colors: {
    primary: {
      50: '#eff6ff',
      100: '#dbeafe',
      200: '#bfdbfe',
      300: '#93c5fd',
      400: '#60a5fa',
      500: '#3b82f6',
      600: '#2563eb',
      700: '#1d4ed8',
      800: '#1e40af',
      900: '#1e3a8a',
    },
    gray: {
      50: '#f9fafb',
      100: '#f3f4f6',
      200: '#e5e7eb',
      300: '#d1d5db',
      400: '#9ca3af',
      500: '#6b7280',
      600: '#4b5563',
      700: '#374151',
      800: '#1f2937',
      900: '#111827',
    },
  },
  fonts: {
    sans: ['Inter', 'system-ui', 'sans-serif'],
    mono: ['JetBrains Mono', 'Consolas', 'monospace'],
  },
} as const;

// API Endpoints
export const API_ENDPOINTS = {
  auth: {
    login: '/auth/login',
    logout: '/auth/logout',
    refresh: '/auth/refresh',
    anonymous: '/auth/anonymous',
  },
  threads: {
    list: '/threads',
    create: '/threads',
    detail: (id: string) => `/threads/${id}`,
    update: (id: string) => `/threads/${id}`,
    delete: (id: string) => `/threads/${id}`,
    like: (id: string) => `/threads/${id}/like`,
    messages: (id: string) => `/threads/${id}/messages`,
  },
  groups: {
    list: '/groups',
    create: '/groups',
    detail: (id: string) => `/groups/${id}`,
    join: (id: string) => `/groups/${id}/join`,
    leave: (id: string) => `/groups/${id}/leave`,
    members: (id: string) => `/groups/${id}/members`,
    invite: (id: string) => `/groups/${id}/invite`,
  },
  notifications: {
    list: '/notifications',
    markRead: (id: string) => `/notifications/${id}/read`,
    markAllRead: '/notifications/read-all',
    delete: (id: string) => `/notifications/${id}`,
  },
  user: {
    profile: '/user/profile',
    preferences: '/user/preferences',
  },
} as const;

// Error Messages
export const ERROR_MESSAGES = {
  network: 'Network error. Please check your connection.',
  unauthorized: 'You are not authorized to perform this action.',
  forbidden: 'Access denied.',
  notFound: 'The requested resource was not found.',
  serverError: 'Server error. Please try again later.',
  validation: 'Please check your input and try again.',
  timeout: 'Request timed out. Please try again.',
  unknown: 'An unexpected error occurred.',
} as const;

// Success Messages
export const SUCCESS_MESSAGES = {
  threadCreated: 'Thread created successfully!',
  threadUpdated: 'Thread updated successfully!',
  threadDeleted: 'Thread deleted successfully!',
  groupCreated: 'Group created successfully!',
  groupJoined: 'Successfully joined the group!',
  groupLeft: 'Successfully left the group!',
  messagePosted: 'Message posted successfully!',
  profileUpdated: 'Profile updated successfully!',
  preferencesUpdated: 'Preferences updated successfully!',
} as const;

// Local Storage Keys
export const STORAGE_KEYS = {
  userSession: 'whispr_user_session',
  userPreferences: 'whispr_user_preferences',
  theme: 'whispr_theme',
  sidebarState: 'whispr_sidebar_state',
  draftThreads: 'whispr_draft_threads',
  recentSearches: 'whispr_recent_searches',
} as const;

// Feature Flags
export const FEATURE_FLAGS = {
  enableVoiceMessages: true,
  enablePolls: true,
  enableGroupSpaces: true,
  enablePremiumContent: false, // Future feature
  enableAnalytics: true,
  enablePushNotifications: true,
  enableRealTimeChat: true,
} as const;

// Validation Patterns
export const VALIDATION_PATTERNS = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  username: /^[a-zA-Z0-9_]{3,20}$/,
  groupName: /^[\w\s-]{1,100}$/,
  inviteCode: /^[A-Z0-9]{8}$/,
  url: /^https?:\/\/.+/,
} as const;

// Rate Limiting
export const RATE_LIMITS = {
  threadCreation: { requests: 5, window: 60 * 60 * 1000 }, // 5 per hour
  messagePosting: { requests: 30, window: 60 * 1000 }, // 30 per minute
  groupCreation: { requests: 2, window: 24 * 60 * 60 * 1000 }, // 2 per day
  likeAction: { requests: 100, window: 60 * 1000 }, // 100 per minute
  search: { requests: 50, window: 60 * 1000 }, // 50 per minute
} as const;

// Export all constants as a single object for convenience
export const CONSTANTS = {
  APP_CONFIG,
  AUTH_CONFIG,
  THREAD_CONFIG,
  GROUP_CONFIG,
  MESSAGE_CONFIG,
  NOTIFICATION_CONFIG,
  UI_CONFIG,
  THEME_CONFIG,
  API_ENDPOINTS,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  STORAGE_KEYS,
  FEATURE_FLAGS,
  VALIDATION_PATTERNS,
  RATE_LIMITS,
} as const;
