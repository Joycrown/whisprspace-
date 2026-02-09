/* eslint-disable @typescript-eslint/no-explicit-any */
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { VALIDATION_PATTERNS, THREAD_CONFIG, GROUP_CONFIG, MESSAGE_CONFIG } from './core/constants';

// Tailwind CSS class merging utility
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Date and Time Utilities
export const formatDate = {
  // Relative time formatting (e.g., "2 hours ago")
  relative: (date: string | Date): string => {
    const now = new Date();
    const target = new Date(date);
    const diffInSeconds = Math.floor((now.getTime() - target.getTime()) / 1000);

    if (diffInSeconds < 60) {
      return 'just now';
    }

    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) {
      return `${diffInMinutes}m ago`;
    }

    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) {
      return `${diffInHours}h ago`;
    }

    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) {
      return `${diffInDays}d ago`;
    }

    const diffInWeeks = Math.floor(diffInDays / 7);
    if (diffInWeeks < 4) {
      return `${diffInWeeks}w ago`;
    }

    const diffInMonths = Math.floor(diffInDays / 30);
    if (diffInMonths < 12) {
      return `${diffInMonths}mo ago`;
    }

    const diffInYears = Math.floor(diffInDays / 365);
    return `${diffInYears}y ago`;
  },

  // Absolute date formatting
  absolute: (date: string | Date): string => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  },

  // Short date format
  short: (date: string | Date): string => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  },

  // Time only
  time: (date: string | Date): string => {
    return new Date(date).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  },
};

// String Utilities
export const stringUtils = {
  // Truncate text with ellipsis
  truncate: (text: string, maxLength: number): string => {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength - 3) + '...';
  },

  // Capitalize first letter
  capitalize: (text: string): string => {
    return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
  },

  // Convert to title case
  titleCase: (text: string): string => {
    return text
      .split(' ')
      .map(word => stringUtils.capitalize(word))
      .join(' ');
  },

  // Generate random string
  random: (length: number, charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'): string => {
    let result = '';
    for (let i = 0; i < length; i++) {
      result += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return result;
  },

  // Generate slug from text
  slugify: (text: string): string => {
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '') // Remove special characters
      .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with hyphens
      .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
  },

  // Extract mentions from text
  extractMentions: (text: string): string[] => {
    const mentionRegex = /@([a-zA-Z0-9_]+)/g;
    const mentions = [];
    let match;
    while ((match = mentionRegex.exec(text)) !== null) {
      mentions.push(match[1]);
    }
    return mentions;
  },

  // Extract hashtags from text
  extractHashtags: (text: string): string[] => {
    const hashtagRegex = /#([a-zA-Z0-9_]+)/g;
    const hashtags = [];
    let match;
    while ((match = hashtagRegex.exec(text)) !== null) {
      hashtags.push(match[1]);
    }
    return hashtags;
  },
};

// Number Utilities
export const numberUtils = {
  // Format large numbers (e.g., 1.2K, 1.5M)
  format: (num: number): string => {
    if (num < 1000) return num.toString();
    if (num < 1000000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    if (num < 1000000000) return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    return (num / 1000000000).toFixed(1).replace(/\.0$/, '') + 'B';
  },

  // Generate random number in range
  randomInRange: (min: number, max: number): number => {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  },

  // Clamp number between min and max
  clamp: (num: number, min: number, max: number): number => {
    return Math.min(Math.max(num, min), max);
  },

  // Round to specified decimal places
  round: (num: number, decimals: number): number => {
    return Math.round(num * Math.pow(10, decimals)) / Math.pow(10, decimals);
  },
};

// File Utilities
export const fileUtils = {
  // Format file size
  formatSize: (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  },

  // Get file extension
  getExtension: (filename: string): string => {
    return filename.slice(((filename.lastIndexOf('.') - 1) >>> 0) + 2);
  },

  // Check if file type is allowed
  isAllowedType: (fileType: string): boolean => {
    if (!fileType) return false;
    return THREAD_CONFIG.allowedFileTypes.includes(fileType as any);
  },

  // Check if file size is within limit
  isWithinSizeLimit: (fileSize: number): boolean => {
    return fileSize <= THREAD_CONFIG.maxFileSize;
  },

  // Generate file preview URL (for images)
  generatePreviewUrl: (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith('image/')) {
        reject(new Error('File is not an image'));
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        resolve(e.target?.result as string);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  },
};

// Validation Utilities
export const validate = {
  email: (email: string): boolean => {
    return VALIDATION_PATTERNS.email.test(email);
  },

  username: (username: string): boolean => {
    return VALIDATION_PATTERNS.username.test(username);
  },

  groupName: (name: string): boolean => {
    return VALIDATION_PATTERNS.groupName.test(name) && name.length <= GROUP_CONFIG.maxNameLength;
  },

  inviteCode: (code: string): boolean => {
    return VALIDATION_PATTERNS.inviteCode.test(code);
  },

  url: (url: string): boolean => {
    return VALIDATION_PATTERNS.url.test(url);
  },

  threadTitle: (title: string): boolean => {
    return title.length > 0 && title.length <= THREAD_CONFIG.maxTitleLength;
  },

  threadContent: (content: string): boolean => {
    return content.length <= THREAD_CONFIG.maxContentLength;
  },

  messageContent: (content: string): boolean => {
    return content.length > 0 && content.length <= MESSAGE_CONFIG.maxLength;
  },

  groupDescription: (description: string): boolean => {
    return description.length <= GROUP_CONFIG.maxDescriptionLength;
  },
};

// Color Utilities
export const colorUtils = {
  // Generate random color
  random: (): string => {
    const colors = [
      '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
      '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1',
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  },

  // Generate avatar color based on string
  fromString: (str: string): string => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    const colors = [
      '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
      '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1',
    ];
    
    return colors[Math.abs(hash) % colors.length];
  },

  // Check if color is light or dark
  isLight: (color: string): boolean => {
    const hex = color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness > 128;
  },
};

// Array Utilities
export const arrayUtils = {
  // Shuffle array
  shuffle: <T>(array: T[]): T[] => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  },

  // Get unique values
  unique: <T>(array: T[]): T[] => {
    return [...new Set(array)];
  },

  // Group array by key
  groupBy: <T, K extends keyof T>(array: T[], key: K): Record<string, T[]> => {
    return array.reduce((groups, item) => {
      const group = String(item[key]);
      groups[group] = groups[group] || [];
      groups[group].push(item);
      return groups;
    }, {} as Record<string, T[]>);
  },

  // Chunk array into smaller arrays
  chunk: <T>(array: T[], size: number): T[][] => {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  },
};

// Local Storage Utilities
export const storage = {
  get: <T>(key: string, defaultValue?: T): T | null => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue || null;
    } catch {
      return defaultValue || null;
    }
  },

  set: <T>(key: string, value: T): void => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Handle storage errors silently
    }
  },

  remove: (key: string): void => {
    try {
      localStorage.removeItem(key);
    } catch {
      // Handle storage errors silently
    }
  },

  clear: (): void => {
    try {
      localStorage.clear();
    } catch {
      // Handle storage errors silently
    }
  },
};

// Debounce Utility
export const debounce = <T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

// Throttle Utility
export const throttle = <T extends (...args: unknown[]) => unknown>(
  func: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle: boolean;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
};

// Copy to Clipboard
export const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for older browsers
    try {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      return true;
    } catch {
      return false;
    }
  }
};

// Generate Anonymous ID
export const generateAnonymousId = (): string => {
  const adjectives = [
    'Anonymous', 'Mysterious', 'Silent', 'Hidden', 'Secret', 'Quiet',
    'Invisible', 'Unknown', 'Nameless', 'Faceless', 'Shadowy', 'Enigmatic'
  ];
  
  const nouns = [
    'Whisper', 'Voice', 'Soul', 'Mind', 'Spirit', 'Thought',
    'Dream', 'Echo', 'Shadow', 'Phantom', 'Ghost', 'Wanderer'
  ];
  
  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const number = Math.floor(Math.random() * 9999) + 1;
  
  return `${adjective}${noun}${number}`;
};

// Generate Session Token
export const generateSessionToken = (): string => {
  return stringUtils.random(32, 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789');
};

// Sleep utility for async operations
export const sleep = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

// Check if device is mobile
export const isMobile = (): boolean => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
};

// Get device type
export const getDeviceType = (): 'mobile' | 'tablet' | 'desktop' => {
  const width = window.innerWidth;
  if (width < 768) return 'mobile';
  if (width < 1024) return 'tablet';
  return 'desktop';
};

// Format duration (for voice messages)
export const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// Generate initials from name
export const getInitials = (name: string): string => {
  return name
    .split(' ')
    .map(word => word.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 2);
};
