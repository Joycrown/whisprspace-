/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
// API service layer for handling all data operations
// This file simulates backend API calls using mock data

import {
  User,
  Thread,
  Message,
  Group,
  Notification,
  AnonymousMessage,
  CreateThreadForm,
  CreateGroupForm,
  ThreadFilters,
  ApiResponse,
  PaginatedResponse
} from '@/types';

import {
  mockUsers,
  mockThreads,
  mockMessages,
  mockGroups,
  mockNotifications,
  mockAnonymousMessages
} from '@/lib/utils/utils/DummyData';

import { generateAnonymousId, generateSessionToken, sleep } from './utils';

// Simulate network delay
const NETWORK_DELAY = 500;

// Mock API base class
class MockAPI {
  private async delay(ms: number = NETWORK_DELAY): Promise<void> {
    await sleep(ms);
  }

  protected async mockRequest<T>(data: T, delay: number = NETWORK_DELAY): Promise<ApiResponse<T>> {
    await this.delay(delay);
    return {
      success: true,
      data,
      message: 'Request successful'
    };
  }

  protected async mockError(message: string, delay: number = NETWORK_DELAY): Promise<ApiResponse<null>> {
    await this.delay(delay);
    return {
      success: false,
      data: null,
      message,
      error: message
    };
  }

  protected mockPagination<T>(items: T[], page: number = 1, limit: number = 10): PaginatedResponse<T> {
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedItems = items.slice(startIndex, endIndex);
    
    return {
      items: paginatedItems,
      pagination: {
        page,
        limit,
        total: items.length,
        totalPages: Math.ceil(items.length / limit),
        hasNext: endIndex < items.length,
        hasPrev: page > 1
      }
    };
  }
}

// Authentication API
export class AuthAPI extends MockAPI {
  async loginAnonymously(): Promise<ApiResponse<{ user: User; sessionToken: string }>> {
    const user: User = {
      id: `user_${Date.now()}`,
      anonymousId: generateAnonymousId(),
      isAnonymous: true,
      joinedAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      preferences: {
        theme: 'system',
        notifications: {
          email: false,
          push: true,
          inApp: true,
          likes: true,
          replies: true,
          mentions: true,
          groupInvites: true
        },
        privacy: {
          showOnlineStatus: false,
          allowDirectMessages: true
        }
      }
    };

    const sessionToken = generateSessionToken();
    
    return this.mockRequest({ user, sessionToken });
  }

  async refreshSession(sessionToken: string): Promise<ApiResponse<{ user: User; sessionToken: string }>> {
    // Find user by session token (in real app, this would be validated server-side)
    const user = mockUsers[0]; // Mock user for demo
    const newSessionToken = generateSessionToken();
    
    return this.mockRequest({ user, sessionToken: newSessionToken });
  }

  async logout(): Promise<ApiResponse<null>> {
    return this.mockRequest(null);
  }

  async updatePreferences(preferences: User['preferences']): Promise<ApiResponse<User>> {
    const user = { ...mockUsers[0], preferences };
    return this.mockRequest(user);
  }
}

// Thread API
export class ThreadAPI extends MockAPI {
  async getThreads(filters?: ThreadFilters, page: number = 1, limit: number = 10): Promise<ApiResponse<PaginatedResponse<Thread>>> {
    let filteredThreads = [...mockThreads];

    // Apply filters
    if (filters) {
      if (filters.category && filters.category !== 'all') {
        filteredThreads = filteredThreads.filter(thread => thread.category === filters.category);
      }
      
      if (filters.type && filters.type !== 'all') {
        filteredThreads = filteredThreads.filter(thread => thread.type === filters.type);
      }
      
      if (filters.groupId) {
        filteredThreads = filteredThreads.filter(thread => thread.groupId === filters.groupId);
      }
      
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        filteredThreads = filteredThreads.filter(thread => 
          thread.title.toLowerCase().includes(searchLower) ||
          thread.content.toLowerCase().includes(searchLower) ||
          thread.tags.some(tag => tag.toLowerCase().includes(searchLower))
        );
      }
    }

    // Apply sorting
    filteredThreads.sort((a, b) => {
      switch (filters?.sortBy) {
        case 'likes':
          return b.likes - a.likes;
        case 'messages':
          return b.messageCount - a.messageCount;
        case 'oldest':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'newest':
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });

    const paginatedData = this.mockPagination(filteredThreads, page, limit);
    return this.mockRequest(paginatedData);
  }

  async getThread(id: string): Promise<ApiResponse<Thread>> {
    const thread = mockThreads.find(t => t.id === id);
    if (!thread) {
      return this.mockError('Thread not found') as unknown as ApiResponse<Thread>;
    }
    return this.mockRequest(thread);
  }

  async createThread(data: CreateThreadForm): Promise<ApiResponse<Thread>> {
    const newThread: Thread = {
      id: `thread_${Date.now()}`,
      title: data.title,
      content: data.content,
      type: data.type,
      category: data.category,
      author: {
        id: 'current_user',
        anonymousId: 'CurrentUser123'
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      likes: 0,
      messageCount: 0,
      isLiked: false,
      tags: data.tags || [],
      groupId: null,
      isPinned: false,
      isLocked: false,
      poll: data.pollOptions ? {
        id: `poll_${Date.now()}`,
        question: data.title,
        options: data.pollOptions.map((opt, index) => ({
          id: `opt_${index + 1}`,
          text: opt,
          votes: 0,
          percentage: 0,
          hasVoted: false
        })),
        totalVotes: 0,
        allowMultipleVotes: false,
        expiresAt: new Date(Date.now() + (data.pollDuration || 24) * 60 * 60 * 1000).toISOString(),
        createdBy: 'current_user'
      } : undefined
    };

    return this.mockRequest(newThread);
  }

  async updateThread(id: string, updates: Partial<Thread>): Promise<ApiResponse<Thread>> {
    const thread = mockThreads.find(t => t.id === id);
    if (!thread) {
      return this.mockError('Thread not found') as unknown as ApiResponse<Thread>;
    }

    const updatedThread = {
      ...thread,
      ...updates,
      updatedAt: new Date().toISOString()
    };

    return this.mockRequest(updatedThread);
  }

  async deleteThread(id: string): Promise<ApiResponse<null>> {
    const threadIndex = mockThreads.findIndex(t => t.id === id);
    if (threadIndex === -1) {
      return this.mockError('Thread not found');
    }

    return this.mockRequest(null);
  }

  async likeThread(id: string): Promise<ApiResponse<{ likes: number; isLiked: boolean }>> {
    const thread = mockThreads.find(t => t.id === id);
    if (!thread) {
      return this.mockError('Thread not found') as unknown as ApiResponse<{ likes: number; isLiked: boolean }>;
    }

    const newLikes = thread.isLiked ? thread.likes - 1 : thread.likes + 1;
    const isLiked = !thread.isLiked;

    return this.mockRequest({ likes: newLikes, isLiked });
  }

  async reportThread(id: string, reason: string): Promise<ApiResponse<null>> {
    return this.mockRequest(null);
  }
}

// Message API
export class MessageAPI extends MockAPI {
  async getMessages(threadId: string, page: number = 1, limit: number = 20): Promise<ApiResponse<PaginatedResponse<Message>>> {
    // For now, return all mock messages since Message interface doesn't have threadId
    const paginatedData = this.mockPagination(mockMessages, page, limit);
    return this.mockRequest(paginatedData);
  }

  async createMessage(threadId: string, content: string, parentId?: string): Promise<ApiResponse<Message>> {
    const newMessage: Message = {
      id: `msg_${Date.now()}`,
      sender: {
        id: 'current_user',
        anonymousId: 'CurrentUser123',
        name: 'CurrentUser123',
        avatar: '#3B82F6',
        status: 'online'
      },
      content,
      timestamp: new Date().toISOString(),
      type: 'text',
      threadId: threadId,
      authorId: 'current_user',
      authorName: 'CurrentUser123',
      likes: 0,
      hasLiked: false,
      replies: []
    };

    return this.mockRequest(newMessage);
  }

  async likeMessage(id: string): Promise<ApiResponse<{ likes: number; isLiked: boolean }>> {
    const message = mockMessages.find(m => m.id === id);
    if (!message) {
      return this.mockError('Message not found') as unknown as ApiResponse<{ likes: number; isLiked: boolean }>;
    }

    // Since Message interface doesn't have likes/isLiked, return mock data
    const likes = Math.floor(Math.random() * 10);
    const isLiked = Math.random() > 0.5;

    return this.mockRequest({ likes, isLiked });
  }

  async deleteMessage(id: string): Promise<ApiResponse<null>> {
    return this.mockRequest(null);
  }
}

// Group API
export class GroupAPI extends MockAPI {
  async getGroups(page: number = 1, limit: number = 10): Promise<ApiResponse<PaginatedResponse<Group>>> {
    const paginatedData = this.mockPagination(mockGroups, page, limit);
    return this.mockRequest(paginatedData);
  }

  async getGroup(id: string): Promise<ApiResponse<Group>> {
    const group = mockGroups.find(g => g.id === id);
    if (!group) {
      return this.mockError('Group not found') as unknown as ApiResponse<Group>;
    }
    return this.mockRequest(group);
  }

  async createGroup(data: CreateGroupForm): Promise<ApiResponse<Group>> {
    const newGroup: Group = {
      id: `group_${Date.now()}`,
      name: data.name,
      description: data.description,
      privacy: data.privacy,
      maxMembers: data.maxMembers || 100,
      currentMembers: 1,
      members: [],
      createdBy: 'current_user',
      createdAt: new Date().toISOString(),
      avatar: '#3B82F6',
      inviteCode: data.privacy === 'invite_only' ? generateAnonymousId().slice(0, 8).toUpperCase() : undefined,
      rules: data.rules
    };

    return this.mockRequest(newGroup);
  }

  async joinGroup(id: string, inviteCode?: string): Promise<ApiResponse<Group>> {
    const group = mockGroups.find(g => g.id === id);
    if (!group) {
      return this.mockError('Group not found') as unknown as ApiResponse<Group>;
    }

    if (group.privacy === 'invite_only' && group.inviteCode !== inviteCode) {
      return this.mockError('Invalid invite code') as unknown as ApiResponse<Group>;
    }

    if (group.currentMembers >= group.maxMembers) {
      return this.mockError('Group is full') as unknown as ApiResponse<Group>;
    }

    const updatedGroup = {
      ...group,
      currentMembers: group.currentMembers + 1
    };

    return this.mockRequest(updatedGroup);
  }

  async leaveGroup(id: string): Promise<ApiResponse<null>> {
    return this.mockRequest(null);
  }

  async updateGroup(id: string, updates: Partial<Group>): Promise<ApiResponse<Group>> {
    const group = mockGroups.find(g => g.id === id);
    if (!group) {
      return this.mockError('Group not found') as unknown as ApiResponse<Group>;
    }

    const updatedGroup = { ...group, ...updates };
    return this.mockRequest(updatedGroup);
  }

  async deleteGroup(id: string): Promise<ApiResponse<null>> {
    return this.mockRequest(null);
  }

  async generateInviteCode(id: string): Promise<ApiResponse<{ inviteCode: string }>> {
    const inviteCode = generateAnonymousId().slice(0, 8).toUpperCase();
    return this.mockRequest({ inviteCode });
  }
}

// Notification API
export class NotificationAPI extends MockAPI {
  async getNotifications(page: number = 1, limit: number = 20): Promise<ApiResponse<PaginatedResponse<Notification>>> {
    const userNotifications = mockNotifications.filter(n => n.userId === 'current_user');
    const paginatedData = this.mockPagination(userNotifications, page, limit);
    return this.mockRequest(paginatedData);
  }

  async markAsRead(id: string): Promise<ApiResponse<null>> {
    return this.mockRequest(null);
  }

  async markAllAsRead(): Promise<ApiResponse<null>> {
    return this.mockRequest(null);
  }

  async deleteNotification(id: string): Promise<ApiResponse<null>> {
    return this.mockRequest(null);
  }

  async getUnreadCount(): Promise<ApiResponse<{ count: number }>> {
    const unreadCount = mockNotifications.filter(n => n.userId === 'current_user' && !n.isRead).length;
    return this.mockRequest({ count: unreadCount });
  }
}

// Anonymous Message API
export class AnonymousMessageAPI extends MockAPI {
  async getMessages(page: number = 1, limit: number = 20): Promise<ApiResponse<PaginatedResponse<AnonymousMessage>>> {
    const userMessages = mockAnonymousMessages.filter(m => m.recipientId === 'current_user');
    const paginatedData = this.mockPagination(userMessages, page, limit);
    return this.mockRequest(paginatedData);
  }

  async sendMessage(recipientId: string, content: string): Promise<ApiResponse<AnonymousMessage>> {
    const newMessage: AnonymousMessage = {
      id: `anon_${Date.now()}`,
      recipientId,
      content,
      sender: 'Anonymous',
      timestamp: new Date().toISOString(),
      read: false
    };

    return this.mockRequest(newMessage);
  }

  async markAsRead(id: string): Promise<ApiResponse<null>> {
    return this.mockRequest(null);
  }

  async deleteMessage(id: string): Promise<ApiResponse<null>> {
    return this.mockRequest(null);
  }
}

// Export API instances
export const authAPI = new AuthAPI();
export const threadAPI = new ThreadAPI();
export const messageAPI = new MessageAPI();
export const groupAPI = new GroupAPI();
export const notificationAPI = new NotificationAPI();
export const anonymousMessageAPI = new AnonymousMessageAPI();

// Export all APIs as a single object
export const api = {
  auth: authAPI,
  threads: threadAPI,
  messages: messageAPI,
  groups: groupAPI,
  notifications: notificationAPI,
  anonymousMessages: anonymousMessageAPI
};

export default api;
