import { create } from 'zustand';
import { AnonymousMessage } from '@/types';
import { mockAnonymousMessages } from '@/lib/utils/utils/DummyData';

interface AnonymousMessageStore {
  anonymousMessages: AnonymousMessage[];
  isLoading: boolean;
  error: string | null;

  fetchAnonymousMessages: (recipientId: string) => Promise<void>;
  sendAnonymousMessage: (recipientId: string, content: string) => Promise<void>;
  markAnonymousMessageAsRead: (messageId: string) => void;
  clearError: () => void;
}

const mockFetchAnonymousMessages = async (recipientId: string): Promise<AnonymousMessage[]> => {
  await new Promise(resolve => setTimeout(resolve, 300)); // Simulate API delay
  return mockAnonymousMessages.filter(msg => msg.recipientId === recipientId).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
};

const mockSendAnonymousMessage = async (recipientId: string, content: string): Promise<AnonymousMessage> => {
  await new Promise(resolve => setTimeout(resolve, 300)); // Simulate API delay
  const newMsg: AnonymousMessage = {
    id: `anon_msg_${Date.now()}`,
    sender: 'Anonymous',
    recipientId,
    content,
    timestamp: new Date().toISOString(),
    read: false,
  };
  mockAnonymousMessages.push(newMsg); // Add to mock data
  return newMsg;
};

export const useAnonymousMessageStore = create<AnonymousMessageStore>((set, get) => ({
  anonymousMessages: [],
  isLoading: false,
  error: null,

  fetchAnonymousMessages: async (recipientId: string) => {
    set({ isLoading: true, error: null });
    try {
      const messages = await mockFetchAnonymousMessages(recipientId);
      set({ anonymousMessages: messages, isLoading: false });
    } catch (error) {
      set({ error: 'Failed to fetch anonymous messages', isLoading: false });
    }
  },

  sendAnonymousMessage: async (recipientId: string, content: string) => {
    set({ isLoading: true, error: null });
    try {
      const newMessage = await mockSendAnonymousMessage(recipientId, content);
      set(state => ({
        anonymousMessages: [...state.anonymousMessages, newMessage],
        isLoading: false,
      }));
    } catch (error) {
      set({ error: 'Failed to send anonymous message', isLoading: false });
    }
  },

  markAnonymousMessageAsRead: (messageId: string) => {
    set(state => ({
      anonymousMessages: state.anonymousMessages.map(msg =>
        msg.id === messageId ? { ...msg, read: true } : msg
      ),
    }));
  },

  clearError: () => set({ error: null }),
}));
