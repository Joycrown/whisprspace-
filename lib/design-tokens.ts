/**
 * WhisprSpace Design System - Design Tokens
 * Central source of truth for design values
 */

export const colors = {
  // Brand Colors
  brand: {
    purple: {
      50: '#faf5ff',
      100: '#f3e8ff',
      200: '#e9d5ff',
      300: '#d8b4fe',
      400: '#c084fc',
      500: '#a855f7',
      600: '#9333ea',
      700: '#7e22ce',
      800: '#6b21a8',
      900: '#581c87',
    },
    orange: {
      50: '#fff7ed',
      100: '#ffedd5',
      200: '#fed7aa',
      300: '#fdba74',
      400: '#fb923c',
      500: '#f97316',
      600: '#ea580c',
      700: '#c2410c',
      800: '#9a3412',
      900: '#7c2d12',
    },
  },

  // Semantic Colors
  background: {
    primary: '#121212',
    secondary: '#1a1a1a',
    tertiary: '#1f2937',
    card: '#1f2937',
    elevated: '#374151',
  },

  text: {
    primary: '#ffffff',
    secondary: '#9ca3af',
    tertiary: '#6b7280',
    inverse: '#121212',
  },

  border: {
    default: '#374151',
    light: '#4b5563',
    heavy: '#1f2937',
  },

  // Feedback Colors
  success: {
    bg: '#065f46',
    text: '#34d399',
    border: '#10b981',
  },

  error: {
    bg: '#7f1d1d',
    text: '#fca5a5',
    border: '#ef4444',
  },

  warning: {
    bg: '#78350f',
    text: '#fbbf24',
    border: '#f59e0b',
  },

  info: {
    bg: '#1e3a8a',
    text: '#93c5fd',
    border: '#3b82f6',
  },

  // Gradients
  gradients: {
    primary: 'linear-gradient(to right, #9333ea, #f97316)',
    secondary: 'linear-gradient(to bottom right, #581c87, #7c2d12)',
    success: 'linear-gradient(to right, #065f46, #10b981)',
    danger: 'linear-gradient(to right, #7f1d1d, #ef4444)',
  },
} as const;

export const typography = {
  fontFamily: {
    sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    mono: '"SF Mono", Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
  },

  fontSize: {
    xs: '0.75rem',      // 12px
    sm: '0.875rem',     // 14px
    base: '1rem',       // 16px
    lg: '1.125rem',     // 18px
    xl: '1.25rem',      // 20px
    '2xl': '1.5rem',    // 24px
    '3xl': '1.875rem',  // 30px
    '4xl': '2.25rem',   // 36px
    '5xl': '3rem',      // 48px
  },

  fontWeight: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },

  lineHeight: {
    tight: '1.25',
    normal: '1.5',
    relaxed: '1.75',
  },
} as const;

export const spacing = {
  0: '0',
  1: '0.25rem',   // 4px
  2: '0.5rem',    // 8px
  3: '0.75rem',   // 12px
  4: '1rem',      // 16px
  5: '1.25rem',   // 20px
  6: '1.5rem',    // 24px
  8: '2rem',      // 32px
  10: '2.5rem',   // 40px
  12: '3rem',     // 48px
  16: '4rem',     // 64px
  20: '5rem',     // 80px
  24: '6rem',     // 96px
} as const;

export const borderRadius = {
  none: '0',
  sm: '0.125rem',    // 2px
  base: '0.25rem',   // 4px
  md: '0.375rem',    // 6px
  lg: '0.5rem',      // 8px
  xl: '0.75rem',     // 12px
  '2xl': '1rem',     // 16px
  '3xl': '1.5rem',   // 24px
  full: '9999px',
} as const;

export const shadows = {
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  base: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
  xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
  '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
  inner: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.05)',
  glow: '0 0 20px rgba(147, 51, 234, 0.4)',
} as const;

export const animations = {
  duration: {
    fast: '150ms',
    base: '200ms',
    slow: '300ms',
    slower: '500ms',
  },

  easing: {
    linear: 'linear',
    easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
    easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
    easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
    spring: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
  },
} as const;

export const breakpoints = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
} as const;

export const zIndex = {
  dropdown: 1000,
  sticky: 1020,
  fixed: 1030,
  modalBackdrop: 1040,
  modal: 1050,
  popover: 1060,
  tooltip: 1070,
} as const;

// Theme configuration
export const themes = {
  dark: {
    background: colors.background.primary,
    text: colors.text.primary,
    border: colors.border.default,
  },
  light: {
    background: '#ffffff',
    text: '#111827',
    border: '#e5e7eb',
  },
} as const;

export type Theme = keyof typeof themes;
