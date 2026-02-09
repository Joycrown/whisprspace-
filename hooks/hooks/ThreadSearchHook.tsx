import React, { createContext, useContext, useState, useEffect } from 'react';
import { Message } from '../utils/types';

export interface SearchResult {
  participants: Array<{
    id: string;
    name: string;
    avatar: string;
    messageCount?: number; // Make optional to align with Participant interface
  }>;
  messages: Array<Message>;
}

interface SearchContextType {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  searchResults: SearchResult;
  isLoading: boolean; // Add isLoading to context type
}

const SearchContext = createContext<SearchContextType | undefined>(undefined);

export const useSearch = () => {
  const context = useContext(SearchContext);
  if (!context) {
    throw new Error('useSearch must be used within a SearchProvider');
  }
  return context;
};

interface SearchProviderProps {
  children: React.ReactNode;
  initialData?: {
    participants: SearchResult['participants'];
    messages: SearchResult['messages'];
  };
}

export const SearchProvider: React.FC<SearchProviderProps> = ({ 
  children, 
  initialData = { participants: [], messages: [] } 
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult>({
    participants: initialData.participants,
    messages: initialData.messages
  });
  const [isLoading, setIsLoading] = useState(false); // Add isLoading state

  // Effect to debounce searchQuery
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300); // 300ms debounce time

    return () => {
      clearTimeout(handler);
    };
  }, [searchQuery]);

  useEffect(() => {
    const performSearch = () => {
      setIsLoading(true); // Set loading to true when search starts
      
      if (!debouncedSearchQuery.trim()) {
        setSearchResults({
          participants: initialData.participants,
          messages: initialData.messages
        });
        setIsLoading(false); // Set loading to false if no search query
        return;
      }

      const query = debouncedSearchQuery.toLowerCase();
      
      // Simulate API delay for search
      setTimeout(() => {
        const filteredParticipants = initialData.participants.filter(participant =>
          participant.name.toLowerCase().includes(query)
        );
    
        const filteredMessages = initialData.messages.filter(message =>
          message.content.toLowerCase().includes(query)
        );
    
        setSearchResults({
          participants: filteredParticipants,
          messages: filteredMessages
        });
        setIsLoading(false); // Set loading to false when results are ready
      }, 300); // Simulate network delay
    };

    performSearch();
  }, [debouncedSearchQuery, initialData]);

  return (
    <SearchContext.Provider value={{ searchQuery, setSearchQuery, searchResults, isLoading }}>
      {children}
    </SearchContext.Provider>
  );
};
