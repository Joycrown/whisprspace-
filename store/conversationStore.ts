import { create } from 'zustand'
import { Conversation, fetchConversations, getUnreadCount } from '@/lib/messaging/messaging-service'

interface ConversationStore {
  conversations: Conversation[]
  unreadCount: number
  isLoading: boolean
  error: string | null
  
  // To track if we have ever loaded data for the current session
  hasLoaded: boolean

  // Actions
  setConversations: (conversations: Conversation[]) => void
  setUnreadCount: (count: number) => void
  setLoading: (isLoading: boolean) => void
  setError: (error: string | null) => void
  
  // Async Actions
  syncConversations: (silent?: boolean) => Promise<void>
  syncUnreadCount: () => Promise<void>
  reset: () => void
}

export const useConversationStore = create<ConversationStore>((set, get) => ({
  conversations: [],
  unreadCount: 0,
  isLoading: false,
  error: null,
  hasLoaded: false,

  setConversations: (data) => set({ conversations: data, hasLoaded: true }),
  setUnreadCount: (count) => set({ unreadCount: count }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (err) => set({ error: err }),

  syncConversations: async (silent = false) => {
    const { hasLoaded } = get()
    
    // If we have loaded once, default to silent unless forced otherwise
    // Actually, "silent" arg overrides everything.
    // Logic: If silent=true, no loading state.
    // If silent=false (default):
    //    If we already have data/loaded once, maybe we SHOULD be silent to avoid flash?
    //    Let's trust the caller, but caller (hook) will be smart.
    
    const shouldShowLoading = !silent
    
    if (shouldShowLoading) {
        set({ isLoading: true, error: null })
    }

    try {
        const { data, error } = await fetchConversations()
        
        if (error) {
            set({ error })
        } else {
            set({ conversations: data, hasLoaded: true })
        }
    } catch (e: any) {
        set({ error: e.message || 'Unknown error' })
    } finally {
        if (shouldShowLoading) {
            set({ isLoading: false })
        }
    }
  },
  
  syncUnreadCount: async () => {
    const { count } = await getUnreadCount()
    set({ unreadCount: count })
  },

  reset: () => set({ conversations: [], unreadCount: 0, hasLoaded: false, isLoading: false, error: null })
}))
