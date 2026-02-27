/* eslint-disable @typescript-eslint/no-unused-vars */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User, UserSession, UserPreferences } from '@/types';
import * as authService from '../lib/auth/auth-service';
import { getAnonymousSessionExpiry, getRegisteredSessionExpiry } from '@/lib/utils/session-expiry';
import { hasRequiredLegalConsent, LEGAL_CONSENT_REQUIRED_ERROR } from '@/lib/legal/consent';

// Anonymous session for users who join anonymously (can interact but not create)
export interface AnonymousSession {
  anonymousId: string;
  sessionToken: string;
  isAnonymous: true;
  createdAt: string;
}

export interface UserStore {
  // State
  sessionInfo: AnonymousSession | null; // Anonymous users (can interact)
  session: UserSession; // Authenticated users (can create)
  isLoading: boolean;
  error: string | null;
  sessionValidated: boolean; // Track if session has been validated by AuthProvider
  rememberMe: boolean;

  // Actions
  loginAnonymously: () => Promise<void>;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updatePreferences: (preferences: Partial<UserPreferences>) => Promise<void>;
  updateUsername: (username: string) => void;
  clearError: () => void;
  refreshSession: () => Promise<void>;
  refreshUser: () => Promise<void>;
  applyPremiumUpgrade: (expiresAt?: string | null) => void;
  setRememberMe: (rememberMe: boolean) => void;
  
  // Helpers
  canCreateThread: () => boolean;
  canInteract: () => boolean;
}

// Generate anonymous user ID
const generateAnonymousId = (): string => {
  const randomNum = Math.floor(Math.random() * 100000000);
  return `ANON_${randomNum.toString().padStart(8, '0')}`;
};

// Generate session token (mock JWT)
const generateSessionToken = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 64; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// Create mock anonymous user
const createMockAnonymousUser = (): User => {
  const now = new Date().toISOString();
  const anonymousId = generateAnonymousId();
  return {
    id: `anon_${anonymousId}`,
    anonymousId,
    sessionToken: generateSessionToken(),
    isAnonymous: true,
    points: 0,
    level: 1,
    joinedAt: now,
    lastActiveAt: now,
    preferences: {
        theme: 'system',
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
          showOnlineStatus: false, // Anonymous users default to hidden status
          allowDirectMessages: false, // Anonymous users can't receive DMs
        },
      },
  };
};

export const useUserStore = create<UserStore>()(
  persist(
    (set, get) => ({
      // Initial state
      sessionInfo: null, // Anonymous session
      session: {
        user: null,
        isAuthenticated: false,
        sessionExpiry: null,
      },
      isLoading: false,
      error: null,
      sessionValidated: false, // Not validated until AuthProvider checks
      rememberMe: false,

      // Actions
      loginAnonymously: async () => {
        if (!hasRequiredLegalConsent()) {
          set({
            error: LEGAL_CONSENT_REQUIRED_ERROR,
            isLoading: false,
          });

          if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/auth')) {
            const redirectPath = `${window.location.pathname}${window.location.search || ''}`;
            window.location.href = `/auth?force=1&view=anonymous&redirect=${encodeURIComponent(redirectPath)}`;
          }
          return;
        }

        set({ isLoading: true, error: null });
        
        try {
          const user = await authService.signInAnonymously();
          
          // Create anonymous session (can interact but not create)
          set({
            sessionInfo: {
              anonymousId: user.anonymousId,
              sessionToken: '',
              isAnonymous: true,
              createdAt: user.joinedAt,
            },
            session: {
              user,
              isAuthenticated: false,
              sessionExpiry: getAnonymousSessionExpiry(), // 24 hours for anonymous
            },
            isLoading: false,
            rememberMe: false,
          });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to create anonymous session',
            isLoading: false,
          });
        }
      },

      login: async (email: string, password: string, rememberMe?: boolean) => {
        const remember = typeof rememberMe === 'boolean' ? rememberMe : get().rememberMe;
        set({ isLoading: true, error: null, rememberMe: remember });
        
        try {
          const user = await authService.signInWithEmail(email, password);
          
          set({
            session: {
              user,
              isAuthenticated: true,
              sessionExpiry: getRegisteredSessionExpiry(remember),
            },
            sessionInfo: null, // Clear anonymous session
            isLoading: false,
            rememberMe: remember,
          });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to log in',
            isLoading: false,
          });
        }
      },

      signup: async (email: string, password: string) => {
        if (!hasRequiredLegalConsent()) {
          set({
            error: LEGAL_CONSENT_REQUIRED_ERROR,
            isLoading: false,
          });
          return;
        }

        set({ isLoading: true, error: null });
        
        try {
          // User will get system-generated anonymous ID as initial username
          // They can change it later in profile with cooldown period
          const user = await authService.signUpWithEmail(email, password);
          
          set({
            session: {
              user,
              isAuthenticated: true,
              sessionExpiry: getRegisteredSessionExpiry(false),
            },
            sessionInfo: null, // Clear anonymous session
            isLoading: false,
            rememberMe: false,
          });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to sign up',
            isLoading: false,
          });
        }
      },

      logout: async () => {
        console.log('[UserStore] Logout initiated');
        try {
          // Sign out from Supabase (clears cookies and localStorage)
          await authService.signOut();
          console.log('[UserStore] SignOut completed');
          
          // Clear local state
          set({
            session: {
              user: null,
              isAuthenticated: false,
              sessionExpiry: null,
            },
            sessionInfo: null, // Clear anonymous session too
            error: null,
            rememberMe: false,
          });
          
          // Force a hard refresh to clear any cached state
          if (typeof window !== 'undefined') {
            window.location.href = '/auth';
          }
        } catch (error) {
          console.error('Logout error:', error);
          // Still clear local state even if server logout fails
          set({
            session: {
              user: null,
              isAuthenticated: false,
              sessionExpiry: null,
            },
            sessionInfo: null,
            error: null,
            rememberMe: false,
          });
          
          // Force refresh even on error
          if (typeof window !== 'undefined') {
            window.location.href = '/auth';
          }
        }
      },

      updatePreferences: async (preferences: Partial<UserPreferences>) => {
        const { session } = get();
        if (session.user) {
          try {
            await authService.updateUserPreferences(session.user.id, preferences);
            set({
              session: {
                ...session,
                user: {
                  ...session.user,
                  preferences: {
                    ...session.user.preferences,
                    ...preferences,
                  },
                },
              },
            });
          } catch (error) {
            console.error('Update preferences error:', error);
          }
        }
      },

      updateUsername: (newUsername: string) => {
        set((state) => {
          if (!state.session.user) return state;
          return {
            session: {
              ...state.session,
              user: {
                ...state.session.user,
                username: newUsername,
              },
            },
          };
        });
      },

      clearError: () => {
        set({ error: null });
      },

      refreshSession: async () => {
        const { session } = get();
        if (session.user) {
          try {
            await authService.updateUserActivity(session.user.id);
            set({
              session: {
                ...session,
                user: {
                  ...session.user,
                  lastActiveAt: new Date().toISOString(),
                },
              },
            });
          } catch (error) {
            console.error('Refresh session error:', error);
          }
        }
      },

      refreshUser: async () => {
        const { session } = get();
        if (!session.user) return;
        try {
          const updatedUser = await authService.getCurrentSession();
          if (updatedUser) {
            set({
              session: {
                ...session,
                user: updatedUser,
              },
            });
          }
        } catch (error) {
          console.error('Refresh user error:', error);
        }
      },

      applyPremiumUpgrade: (expiresAt?: string | null) => {
        set((state) => {
          if (!state.session.user) return state;
          return {
            session: {
              ...state.session,
              user: {
                ...state.session.user,
                isPremium: true,
                premiumExpiresAt: expiresAt ?? state.session.user.premiumExpiresAt ?? null,
              },
            },
          };
        });
      },

      setRememberMe: (rememberMe: boolean) => {
        set({ rememberMe });
      },

      // Helpers
      canCreateThread: () => {
        const { session } = get();
        // Only authenticated, non-anonymous users can create threads
        return session.isAuthenticated && 
               session.user !== null && 
               !session.user.isAnonymous;
      },

      canInteract: () => {
        const { session, sessionInfo } = get();
        return session.isAuthenticated || sessionInfo !== null;
      },
    }),
    {
      name: 'whisprspace-user-session',
      partialize: (state) => ({ 
        session: state.session, // This includes sessionExpiry
        sessionInfo: state.sessionInfo,
        rememberMe: state.rememberMe,
      }),
    }
  )
);
