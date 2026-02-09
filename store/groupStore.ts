/* eslint-disable @typescript-eslint/no-unused-vars */
import { create } from 'zustand';
import { Group, GroupMember, CreateGroupForm, GroupPrivacy } from '@/types';

export interface GroupStore {
  // State
  groups: Group[];
  myGroups: Group[];
  currentGroup: Group | null;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  fetchGroups: () => Promise<void>;
  fetchMyGroups: () => Promise<void>;
  fetchGroupById: (id: string) => Promise<void>;
  createGroup: (groupData: CreateGroupForm) => Promise<string | null>;
  joinGroup: (groupId: string, inviteCode?: string) => Promise<boolean>;
  leaveGroup: (groupId: string) => Promise<boolean>;
  updateGroup: (id: string, updates: Partial<Group>) => void;
  deleteGroup: (id: string) => Promise<boolean>;
  generateInviteCode: (groupId: string) => Promise<string | null>;
  clearCurrentGroup: () => void;
  clearError: () => void;
}

// Mock group data
const generateMockGroups = (): Group[] => {
  const now = new Date();
  
  return [
    {
      id: 'group_1',
      name: 'Tech Enthusiasts',
      description: 'A community for discussing the latest in technology, programming, and innovation.',
      privacy: 'public',
      maxMembers: 100,
      currentMembers: 45,
      members: [],
      createdBy: 'user_123',
      createdAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days ago
      avatar: '#3B82F6',
      rules: 'Be respectful, stay on topic, no spam or self-promotion without permission.',
    },
    {
      id: 'group_2',
      name: 'Anonymous Thoughts',
      description: 'Share your deepest thoughts and feelings in a safe, anonymous environment.',
      privacy: 'invite_only',
      maxMembers: 50,
      currentMembers: 23,
      members: [],
      createdBy: 'user_456',
      createdAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
      avatar: '#8B5CF6',
      inviteCode: 'ANON2024',
      rules: 'Maintain anonymity, be supportive, no judgment zone.',
    },
    {
      id: 'group_3',
      name: 'Creative Minds',
      description: 'Artists, writers, and creators sharing inspiration and feedback.',
      privacy: 'public',
      maxMembers: 75,
      currentMembers: 67,
      members: [],
      createdBy: 'user_789',
      createdAt: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString(), // 14 days ago
      avatar: '#F59E0B',
      rules: 'Share constructive feedback, respect intellectual property, encourage creativity.',
    },
    {
      id: 'group_4',
      name: 'Startup Founders',
      description: 'Exclusive group for startup founders to share experiences and network.',
      privacy: 'private',
      maxMembers: 25,
      currentMembers: 18,
      members: [],
      createdBy: 'user_101',
      createdAt: new Date(now.getTime() - 21 * 24 * 60 * 60 * 1000).toISOString(), // 21 days ago
      avatar: '#10B981',
      inviteCode: 'STARTUP2024',
      rules: 'Verified founders only, no solicitation, share knowledge freely.',
    },
    {
      id: 'group_5',
      name: 'Mental Health Support',
      description: 'A supportive community for mental health discussions and resources.',
      privacy: 'invite_only',
      maxMembers: 200,
      currentMembers: 156,
      members: [],
      createdBy: 'user_202',
      createdAt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days ago
      avatar: '#EF4444',
      inviteCode: 'SUPPORT2024',
      rules: 'Be kind and supportive, no medical advice, respect privacy, trigger warnings required.',
    },
  ];
};

const mockFetchGroups = async (): Promise<Group[]> => {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 400));
  return generateMockGroups().filter(group => group.privacy === 'public');
};

const mockFetchMyGroups = async (): Promise<Group[]> => {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 300));
  // Return groups user is a member of (mock data)
  return generateMockGroups().slice(0, 2);
};

const mockFetchGroupById = async (id: string): Promise<Group | null> => {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 250));
  return generateMockGroups().find(group => group.id === id) || null;
};

const mockCreateGroup = async (groupData: CreateGroupForm): Promise<string> => {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 600));
  return `group_${Date.now()}`;
};

const mockJoinGroup = async (groupId: string, inviteCode?: string): Promise<boolean> => {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 400));
  
  // Mock validation logic
  const groups = generateMockGroups();
  const group = groups.find(g => g.id === groupId);
  
  if (!group) return false;
  
  if (group.privacy === 'private' || group.privacy === 'invite_only') {
    return group.inviteCode === inviteCode;
  }
  
  return true;
};

const mockGenerateInviteCode = async (groupId: string): Promise<string> => {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 200));
  
  // Generate random invite code
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

export const useGroupStore = create<GroupStore>()((set, get) => ({
  // Initial state
  groups: [],
  myGroups: [],
  currentGroup: null,
  isLoading: false,
  error: null,

  // Actions
  fetchGroups: async () => {
    set({ isLoading: true, error: null });
    
    try {
      const groups = await mockFetchGroups();
      set({ groups, isLoading: false });
    } catch (error) {
      set({ 
        error: 'Failed to fetch groups', 
        isLoading: false 
      });
    }
  },

  fetchMyGroups: async () => {
    set({ isLoading: true, error: null });
    
    try {
      const myGroups = await mockFetchMyGroups();
      set({ myGroups, isLoading: false });
    } catch (error) {
      set({ 
        error: 'Failed to fetch your groups', 
        isLoading: false 
      });
    }
  },

  fetchGroupById: async (id: string) => {
    set({ isLoading: true, error: null });
    
    try {
      const group = await mockFetchGroupById(id);
      set({ currentGroup: group, isLoading: false });
    } catch (error) {
      set({ 
        error: 'Failed to fetch group', 
        isLoading: false 
      });
    }
  },

  createGroup: async (groupData: CreateGroupForm) => {
    set({ isLoading: true, error: null });
    
    try {
      const groupId = await mockCreateGroup(groupData);
      set({ isLoading: false });
      
      // Refresh groups lists
      get().fetchGroups();
      get().fetchMyGroups();
      
      return groupId;
    } catch (error) {
      set({ 
        error: 'Failed to create group', 
        isLoading: false 
      });
      return null;
    }
  },

  joinGroup: async (groupId: string, inviteCode?: string) => {
    set({ isLoading: true, error: null });
    
    try {
      const success = await mockJoinGroup(groupId, inviteCode);
      
      if (success) {
        // Refresh my groups list
        get().fetchMyGroups();
        set({ isLoading: false });
        return true;
      } else {
        set({ 
          error: 'Failed to join group. Invalid invite code or group not found.', 
          isLoading: false 
        });
        return false;
      }
    } catch (error) {
      set({ 
        error: 'Failed to join group', 
        isLoading: false 
      });
      return false;
    }
  },

  leaveGroup: async (groupId: string) => {
    set({ isLoading: true, error: null });
    
    try {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Remove from my groups
      const { myGroups } = get();
      const updatedMyGroups = myGroups.filter(group => group.id !== groupId);
      
      set({ 
        myGroups: updatedMyGroups, 
        isLoading: false,
        currentGroup: get().currentGroup?.id === groupId ? null : get().currentGroup
      });
      
      return true;
    } catch (error) {
      set({ 
        error: 'Failed to leave group', 
        isLoading: false 
      });
      return false;
    }
  },

  updateGroup: (id: string, updates: Partial<Group>) => {
    const { groups, myGroups, currentGroup } = get();
    
    // Update in groups list
    const updatedGroups = groups.map(group => 
      group.id === id ? { ...group, ...updates } : group
    );
    
    // Update in my groups list
    const updatedMyGroups = myGroups.map(group => 
      group.id === id ? { ...group, ...updates } : group
    );
    
    // Update current group if it matches
    const updatedCurrentGroup = currentGroup?.id === id
      ? { ...currentGroup, ...updates }
      : currentGroup;
    
    set({ 
      groups: updatedGroups,
      myGroups: updatedMyGroups,
      currentGroup: updatedCurrentGroup
    });
  },

  deleteGroup: async (id: string) => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 300));

    const { groups, myGroups } = get();
    
    set({
      groups: groups.filter(group => group.id !== id),
      myGroups: myGroups.filter(group => group.id !== id),
      currentGroup: get().currentGroup?.id === id ? null : get().currentGroup,
    });
    
    return true;
  },

  generateInviteCode: async (groupId: string) => {
    set({ isLoading: true, error: null });
    
    try {
      const inviteCode = await mockGenerateInviteCode(groupId);
      
      // Update the group with new invite code
      get().updateGroup(groupId, { inviteCode });
      
      set({ isLoading: false });
      return inviteCode;
    } catch (error) {
      set({ 
        error: 'Failed to generate invite code', 
        isLoading: false 
      });
      return null;
    }
  },

  clearCurrentGroup: () => {
    set({ currentGroup: null });
  },

  clearError: () => {
    set({ error: null });
  },
}));
