import React from 'react';
import { FaSearch } from 'react-icons/fa';
import { Message, Participant, Thread } from '@/types';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';

interface SearchBarProps {
  placeholder?: string;
  className?: string;
  searchQuery: string; // Now a prop
  setSearchQuery: (query: string) => void; // Now a prop
}

export const SearchBar: React.FC<SearchBarProps> = ({
  placeholder = "Search in discussion...",
  className = "",
  searchQuery,
  setSearchQuery,
}) => {
  return (
    <div className={`relative w-full max-w-full ${className}`}>
      <input
        type="text"
        placeholder={placeholder}
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="w-full max-w-full bg-gray-800 text-white rounded-full py-2 px-4 pl-10 focus:outline-none focus:ring-1 focus:ring-purple-600"
      />
      <FaSearch className="absolute left-3 top-3 text-gray-500" />
    </div>
  );
};

interface SearchResultsProps {
  className?: string;
  onParticipantClick?: (participantId: string) => void;
  onMessageClick?: (messageId: string) => void;
  searchQuery: string; // Now a prop
  searchResults: { // Now a prop
    participants: Participant[];
    messages: Message[];
  };
  isLoading: boolean; // Now a prop
}

export const SearchResults: React.FC<SearchResultsProps> = ({
  className = "",
  onParticipantClick,
  onMessageClick,
  searchQuery,
  searchResults,
  isLoading,
}) => {
  if (isLoading) {
    return <div className={`bg-gray-800 rounded-lg p-4 ${className} text-center text-gray-400`}>Searching...</div>;
  }

  if (searchQuery.trim()) {
    // Display search results when search is active
    return (
      <div className={`bg-gray-800 rounded-lg p-4 ${className}`}>
        {searchResults.participants.length > 0 && (
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-gray-400 mb-2">Participants</h3>
            <div className="space-y-2">
              {searchResults.participants.map(participant => (
                <button
                  key={participant.id}
                  onClick={() => onParticipantClick?.(participant.id)}
                  className="block w-full text-left p-2 hover:bg-gray-700 rounded cursor-pointer"
                >
                  <p className="text-white font-medium">{participant.name || 'Anonymous'}</p>
                  <p className="text-sm text-gray-400">{participant.messageCount} messages</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {searchResults.messages.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-400 mb-2">Messages</h3>
            <div className="space-y-2">
              {searchResults.messages.map(message => (
                <button
                  key={message.id}
                  onClick={() => onMessageClick?.(message.id)}
                  className="block w-full text-left p-2 hover:bg-gray-700 rounded cursor-pointer"
                >
                  <p className="text-white font-medium line-clamp-1">{message.content}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {searchResults.participants.length === 0 && searchResults.messages.length === 0 && (
          <p className="text-gray-400 text-center">No results found for "{searchQuery}"</p>
        )}
      </div>
    );
  }

  // If search is not active and not loading, display a prompt to search.
  return (
    <div className={`bg-gray-800 rounded-lg p-4 ${className} text-center text-gray-400`}>
      Start typing to search...
    </div>
  );
};
