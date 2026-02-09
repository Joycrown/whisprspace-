import { create } from 'zustand';
import { User } from '@/types';
import { mockUsers } from '@/lib/utils/utils/DummyData';

interface UserSearchStore {
  searchResults: User[];
  searchQuery: string;
  isLoading: boolean;
  error: string | null;
  sortBy: 'newest' | 'oldest';

  setSearchQuery: (query: string) => void;
  setFilter: (filter: Partial<{ sortBy: 'newest' | 'oldest' }>) => void;
  searchUsers: (query: string, filters?: { sortBy?: 'newest' | 'oldest' }) => Promise<void>;
  clearResults: () => void;
  clearError: () => void;
}

const mockUserSearch = async (query: string, filters?: { sortBy?: 'newest' | 'oldest' }): Promise<User[]> => {
  await new Promise(resolve => setTimeout(resolve, 300)); // Simulate API call delay
  const lowerCaseQuery = query.toLowerCase();

  let results = mockUsers.filter(user =>
    user.anonymousId.toLowerCase().includes(lowerCaseQuery)
  );

  if (filters?.sortBy) {
    switch (filters.sortBy) {
      case 'newest':
        results.sort((a, b) => new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime());
        break;
      case 'oldest':
        results.sort((a, b) => new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime());
        break;
    }
  }

  return results;
};

export const useUserSearchStore = create<UserSearchStore>((set, get) => ({
  searchResults: [],
  searchQuery: '',
  isLoading: false,
  error: null,
  sortBy: 'newest',

  setSearchQuery: (query: string) => set({ searchQuery: query }),

  setFilter: (filter: Partial<{ sortBy: 'newest' | 'oldest' }>) => {
    set(state => ({
      ...state,
      ...filter,
    }));
    const { searchQuery, sortBy } = get();
    get().searchUsers(searchQuery, { sortBy });
  },

  searchUsers: async (query: string, filters?: { sortBy?: 'newest' | 'oldest' }) => {
    set({ isLoading: true, error: null });
    try {
      const currentFilters = filters || { sortBy: get().sortBy };
      const results = await mockUserSearch(query, currentFilters);
      set({ searchResults: results, isLoading: false });
    } catch (error) {
      set({ error: 'Failed to search users', isLoading: false });
    }
  },

  clearResults: () => set({ searchResults: [] }),
  clearError: () => set({ error: null }),
}));
