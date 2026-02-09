import { create } from 'zustand';

// LocalStorage keys for persistence
const MESSAGES_STORAGE_KEY = 'whisprspace_messages_db';
const REQUESTS_STORAGE_KEY = 'whisprspace_requests_db';

export type MessageSource = 'direct_link' | 'thread';
export type MessageStatus = 'delivered' | 'pending' | 'rejected';

export interface DirectMessage {
  id: string;
  senderId: string | null; // null for anonymous one-way messages
  senderAnonymousId: string | null; // null for anonymous
  recipientId: string;
  recipientAnonymousId: string;
  content: string;
  timestamp: string;
  read: boolean;
  canReply: boolean; // false for anonymous messages
  threadId?: string; // Group messages into conversations
  source: MessageSource; // How message was sent
  status: MessageStatus; // Message approval status
  threadContext?: string; // Which thread they met in (for thread-based DMs)
  requestedAt?: string; // When request was sent (for pending)
  respondedAt?: string; // When approved/rejected
}

export interface MessageRequest {
  id: string;
  messageId: string;
  senderId: string;
  senderAnonymousId: string;
  recipientId: string;
  messagePreview: string;
  threadContext: string;
  timestamp: string;
  status: 'pending' | 'accepted' | 'rejected';
}

export interface MessageThread {
  id: string;
  participants: string[]; // Array of user IDs
  lastMessage: DirectMessage;
  unreadCount: number;
  messages: DirectMessage[];
}

interface MessageStore {
  messages: DirectMessage[];
  threads: MessageThread[];
  messageRequests: MessageRequest[];
  isLoading: boolean;
  error: string | null;
  
  // Actions
  fetchMessages: () => Promise<void>;
  sendMessage: (
    recipientId: string, 
    content: string, 
    anonymous: boolean,
    source?: MessageSource,
    threadContext?: string
  ) => Promise<boolean>;
  markAsRead: (messageId: string) => void;
  getThreadMessages: (threadId: string) => DirectMessage[];
  getUnreadCount: () => number;
  getPendingRequestCount: () => number;
  deleteMessage: (messageId: string) => void;
  approveMessageRequest: (messageId: string) => Promise<boolean>;
  rejectMessageRequest: (messageId: string) => Promise<boolean>;
  fetchMessageRequests: () => Promise<void>;
}

// Helper functions for localStorage persistence
const getMessagesFromStorage = (): DirectMessage[] => {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(MESSAGES_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Error reading messages from storage:', error);
    return [];
  }
};

const saveMessagesToStorage = (messages: DirectMessage[]) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(MESSAGES_STORAGE_KEY, JSON.stringify(messages));
  } catch (error) {
    console.error('Error saving messages to storage:', error);
  }
};

const getRequestsFromStorage = (): MessageRequest[] => {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(REQUESTS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Error reading requests from storage:', error);
    return [];
  }
};

const saveRequestsToStorage = (requests: MessageRequest[]) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(REQUESTS_STORAGE_KEY, JSON.stringify(requests));
  } catch (error) {
    console.error('Error saving requests to storage:', error);
  }
};

// Mock data - This will store all messages globally (simulating backend persistence)
// In production, this would be replaced with actual API calls
const initialMockMessages: DirectMessage[] = [
  {
    id: 'msg_1',
    senderId: null,
    senderAnonymousId: null,
    recipientId: 'user_anon',
    recipientAnonymousId: 'AnonymousUser',
    content: 'Hey, I just wanted to say your thread about digital privacy was really insightful. Thanks for sharing!',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    read: false,
    canReply: false,
    source: 'direct_link',
    status: 'delivered',
  },
  {
    id: 'msg_2',
    senderId: 'user_123',
    senderAnonymousId: 'Whisper_Ghost',
    recipientId: 'user_anon',
    recipientAnonymousId: 'AnonymousUser',
    content: 'Can we discuss collaboration on that premium thread idea?',
    timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    read: false,
    canReply: true,
    threadId: 'thread_1',
    source: 'direct_link',
    status: 'delivered',
  },
  {
    id: 'msg_3',
    senderId: 'user_456',
    senderAnonymousId: 'Silent_Observer',
    recipientId: 'user_anon',
    recipientAnonymousId: 'AnonymousUser',
    content: 'Thanks for the invite code! Really appreciate it.',
    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    read: true,
    canReply: true,
    threadId: 'thread_2',
    source: 'direct_link',
    status: 'delivered',
  },
];

const initialMockRequests: MessageRequest[] = [
  {
    id: 'req_1',
    messageId: 'msg_pending_1',
    senderId: 'user_789',
    senderAnonymousId: 'Curious_Mind',
    recipientId: 'user_anon',
    messagePreview: 'I saw your comment in the mental health thread...',
    threadContext: 'thread_mental_health',
    timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    status: 'pending',
  },
];

const mockSendMessage = async (
  recipientId: string,
  content: string,
  senderId: string | null,
  senderAnonymousId: string | null,
  source: MessageSource = 'direct_link',
  threadContext?: string
): Promise<DirectMessage> => {
  await new Promise(resolve => setTimeout(resolve, 500));

  // Determine status based on source
  const status: MessageStatus = source === 'direct_link' ? 'delivered' : 'pending';

  const newMessage: DirectMessage = {
    id: `msg_${Date.now()}`,
    senderId,
    senderAnonymousId,
    recipientId,
    recipientAnonymousId: 'RecipientAnonymousId', // Would be fetched from user data
    content,
    timestamp: new Date().toISOString(),
    read: false,
    canReply: senderId !== null,
    threadId: senderId ? `thread_${recipientId}_${senderId}` : undefined,
    source,
    status,
    threadContext,
    requestedAt: status === 'pending' ? new Date().toISOString() : undefined,
  };

  return newMessage;
};

export const useMessageStore = create<MessageStore>()((set, get) => ({
  messages: [],
  threads: [],
  messageRequests: [],
  isLoading: false,
  error: null,

  fetchMessages: async () => {
    set({ isLoading: true, error: null });
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Get messages from localStorage (simulates backend fetch)
      let allMessages = getMessagesFromStorage();
      
      // Initialize with mock data if empty
      if (allMessages.length === 0) {
        allMessages = initialMockMessages;
        saveMessagesToStorage(allMessages);
      }
      
      // Get current user's messages
      const currentUserId = 'user_anon'; // Would get from useUserStore
      const userMessages = allMessages.filter(msg => msg.recipientId === currentUserId);
      
      console.log('📬 Fetched messages from storage:', userMessages.length, 'messages');
      
      // Group messages into threads
      const threadMap = new Map<string, DirectMessage[]>();
      userMessages.forEach(msg => {
        if (msg.threadId) {
          if (!threadMap.has(msg.threadId)) {
            threadMap.set(msg.threadId, []);
          }
          threadMap.get(msg.threadId)!.push(msg);
        }
      });

      const threads: MessageThread[] = Array.from(threadMap.entries()).map(([threadId, messages]) => {
        const sortedMessages = messages.sort((a, b) => 
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        return {
          id: threadId,
          participants: [...new Set(messages.map(m => m.senderId).filter(Boolean) as string[])],
          lastMessage: sortedMessages[0],
          unreadCount: messages.filter(m => !m.read).length,
          messages: sortedMessages,
        };
      });

      set({ 
        messages: userMessages,
        threads,
        isLoading: false 
      });
    } catch (error) {
      set({ 
        error: 'Failed to fetch messages', 
        isLoading: false 
      });
    }
  },

  sendMessage: async (
    recipientId: string, 
    content: string, 
    anonymous: boolean,
    source: MessageSource = 'direct_link',
    threadContext?: string
  ) => {
    set({ isLoading: true, error: null });
    try {
      const senderId = anonymous ? null : 'user_anon'; // Would get from useUserStore
      const senderAnonymousId = anonymous ? null : 'AnonymousUser';

      const newMessage = await mockSendMessage(
        recipientId, 
        content, 
        senderId, 
        senderAnonymousId,
        source,
        threadContext
      );
      
      // Save to localStorage (simulates backend persistence)
      const allMessages = getMessagesFromStorage();
      allMessages.push(newMessage);
      saveMessagesToStorage(allMessages);
      
      console.log('💾 Message saved to storage:', newMessage.id, 'Source:', source, 'Status:', newMessage.status);
      
      // If message is pending (thread-based), add to requests instead of messages
      if (newMessage.status === 'pending') {
        const newRequest: MessageRequest = {
          id: `req_${Date.now()}`,
          messageId: newMessage.id,
          senderId: senderId || '',
          senderAnonymousId: senderAnonymousId || 'Anonymous',
          recipientId,
          messagePreview: content.substring(0, 50) + (content.length > 50 ? '...' : ''),
          threadContext: threadContext || '',
          timestamp: new Date().toISOString(),
          status: 'pending',
        };

        // Save to localStorage
        const allRequests = getRequestsFromStorage();
        allRequests.push(newRequest);
        saveRequestsToStorage(allRequests);
        
        console.log('💾 Request saved to storage:', newRequest.id);

        set(state => ({
          messageRequests: [newRequest, ...state.messageRequests],
          isLoading: false
        }));
      } else {
        // Direct link messages go straight to inbox
        set(state => ({
          messages: [newMessage, ...state.messages],
          isLoading: false
        }));
      }

      return true;
    } catch (error) {
      set({ 
        error: 'Failed to send message', 
        isLoading: false 
      });
      return false;
    }
  },

  markAsRead: (messageId: string) => {
    set(state => ({
      messages: state.messages.map(msg =>
        msg.id === messageId ? { ...msg, read: true } : msg
      ),
      threads: state.threads.map(thread => ({
        ...thread,
        messages: thread.messages.map(msg =>
          msg.id === messageId ? { ...msg, read: true } : msg
        ),
        unreadCount: thread.messages.filter(m => !m.read && m.id !== messageId).length,
      })),
    }));
  },

  getThreadMessages: (threadId: string) => {
    const thread = get().threads.find(t => t.id === threadId);
    return thread?.messages || [];
  },

  getUnreadCount: () => {
    return get().messages.filter(msg => !msg.read && msg.status === 'delivered').length;
  },

  getPendingRequestCount: () => {
    return get().messageRequests.filter(req => req.status === 'pending').length;
  },

  deleteMessage: (messageId: string) => {
    // Remove from localStorage
    const allMessages = getMessagesFromStorage();
    const updatedMessages = allMessages.filter(msg => msg.id !== messageId);
    saveMessagesToStorage(updatedMessages);
    
    console.log('🗑️ Message deleted from storage:', messageId);
    
    set(state => ({
      messages: state.messages.filter(msg => msg.id !== messageId),
      threads: state.threads.map(thread => ({
        ...thread,
        messages: thread.messages.filter(msg => msg.id !== messageId),
      })).filter(thread => thread.messages.length > 0),
    }));
  },

  fetchMessageRequests: async () => {
    set({ isLoading: true, error: null });
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Get requests from localStorage
      let allRequests = getRequestsFromStorage();
      
      // Initialize with mock data if empty
      if (allRequests.length === 0) {
        allRequests = initialMockRequests;
        saveRequestsToStorage(allRequests);
      }
      
      // Get current user's message requests
      const currentUserId = 'user_anon'; // Would get from useUserStore
      const userRequests = allRequests.filter(req => req.recipientId === currentUserId);
      
      console.log('📬 Fetched requests from storage:', userRequests.length, 'requests');
      
      set({ 
        messageRequests: userRequests,
        isLoading: false 
      });
    } catch (error) {
      set({ 
        error: 'Failed to fetch message requests', 
        isLoading: false 
      });
    }
  },

  approveMessageRequest: async (messageId: string) => {
    set({ isLoading: true });
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Get requests from storage
      const allRequests = getRequestsFromStorage();
      const request = allRequests.find(req => req.messageId === messageId);
      if (!request) {
        set({ isLoading: false });
        return false;
      }
      
      // Update request status in storage
      const updatedRequests = allRequests.map(req => 
        req.messageId === messageId ? { ...req, status: 'accepted' as const } : req
      );
      saveRequestsToStorage(updatedRequests);
      
      console.log('✅ Request approved in storage:', messageId);

      // Get messages from storage and find the pending message
      const allMessages = getMessagesFromStorage();
      const pendingMessage = allMessages.find(msg => msg.id === messageId);
      
      if (!pendingMessage) {
        set({ isLoading: false });
        return false;
      }
      
      // Update message status to delivered in storage
      const updatedMessages = allMessages.map(msg => 
        msg.id === messageId 
          ? { ...msg, status: 'delivered' as MessageStatus, respondedAt: new Date().toISOString() }
          : msg
      );
      saveMessagesToStorage(updatedMessages);
      
      console.log('✅ Message delivered in storage:', messageId);
      
      // Create delivered message for local state
      const deliveredMessage: DirectMessage = {
        id: messageId,
        senderId: request.senderId,
        senderAnonymousId: request.senderAnonymousId,
        recipientId: request.recipientId,
        recipientAnonymousId: 'AnonymousUser', // Would get from user data
        content: pendingMessage!.content,
        timestamp: pendingMessage!.timestamp,
        read: false,
        canReply: true,
        source: 'thread',
        status: 'delivered',
        threadContext: request.threadContext,
        requestedAt: request.timestamp,
        respondedAt: new Date().toISOString(),
      };
      
      // Update local state
      set(state => ({
        messageRequests: state.messageRequests.filter(req => req.messageId !== messageId),
        messages: [...state.messages, deliveredMessage],
        isLoading: false
      }));
      
      return true;
    } catch (error) {
      set({ 
        error: 'Failed to approve message request', 
        isLoading: false 
      });
      return false;
    }
  },

  rejectMessageRequest: async (messageId: string) => {
    set({ isLoading: true });
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Remove request from storage
      const allRequests = getRequestsFromStorage();
      const updatedRequests = allRequests.filter(req => req.messageId !== messageId);
      saveRequestsToStorage(updatedRequests);
      
      // Update message status to rejected in storage
      const allMessages = getMessagesFromStorage();
      const updatedMessages = allMessages.map(msg => 
        msg.id === messageId 
          ? { ...msg, status: 'rejected' as MessageStatus, respondedAt: new Date().toISOString() }
          : msg
      );
      saveMessagesToStorage(updatedMessages);
      
      console.log('❌ Request rejected in storage:', messageId);
      
      // Update request status
      set(state => ({
        messageRequests: state.messageRequests.filter(req => req.messageId !== messageId),
        isLoading: false
      }));
      
      return true;
    } catch (error) {
      set({ 
        error: 'Failed to reject message request', 
        isLoading: false 
      });
      return false;
    }
  },
}));
