'use client'
import React, { useState } from 'react';
import { useUserSearchStore } from '@/store/userSearchStore';
import Link from 'next/link';
import { FaSearch } from 'react-icons/fa';

const UserSearchResults: React.FC = () => {
  const { searchResults, searchQuery, isLoading, error, setSearchQuery, sortBy, setFilter } = useUserSearchStore();
  const [internalSearchQuery, setInternalSearchQuery] = useState(searchQuery);
  const [internalSortBy, setInternalSortBy] = useState(sortBy);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInternalSearchQuery(e.target.value);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchQuery(internalSearchQuery);
  };

  const handleFilterChange = () => {
    setFilter({ sortBy: internalSortBy });
  };

  return (
    <div className="space-y-6">
      {/* Search Input */}
      <form onSubmit={handleSearchSubmit} className="flex gap-2 mb-6">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <FaSearch className="h-5 w-5 text-gray-400" aria-hidden="true" />
          </div>
          <input
            type="text"
            placeholder="Search users by anonymous ID..."
            value={internalSearchQuery}
            onChange={handleInputChange}
            className="block w-full rounded-md border-0 bg-gray-800 py-2 pl-10 pr-3 text-white ring-1 ring-inset ring-gray-700 placeholder:text-gray-500 focus:ring-2 focus:ring-inset focus:ring-purple-500 sm:text-sm"
          />
        </div>
        <button
          type="submit"
          className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors disabled:opacity-50"
          disabled={!internalSearchQuery.trim() || isLoading}
        >
          Search
        </button>
      </form>

      {/* Filter Options */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1">
          <label htmlFor="sort-by" className="block text-sm font-medium text-gray-400 mb-1">Sort By</label>
          <select
            id="sort-by"
            value={internalSortBy}
            onChange={(e) => setInternalSortBy(e.target.value as 'newest' | 'oldest')}
            className="block w-full rounded-md bg-gray-800 border-gray-700 text-white shadow-sm focus:border-purple-500 focus:ring-purple-500 sm:text-sm"
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
          </select>
        </div>
        <button
          onClick={handleFilterChange}
          className="mt-auto px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          Apply Filters
        </button>
      </div>

      {/* Loading, Error, or No Results */}
      {isLoading && <p className="text-center text-gray-400">Searching for users...</p>}
      {error && <p className="text-center text-red-500">Error: {error}</p>}
      {!isLoading && !error && searchResults.length === 0 && searchQuery.trim() && (
        <p className="text-center text-gray-400">No users found matching "{searchQuery}".</p>
      )}
      {!isLoading && !error && searchResults.length === 0 && !searchQuery.trim() && (
        <p className="text-center text-gray-400">Start typing to search for users.</p>
      )}

      {/* Search Results List */}
      {!isLoading && !error && searchResults.length > 0 && (
        <div className="space-y-4">
          {searchResults.map(user => (
            <Link key={user.id} href={`/profile/${user.id}`} className="block">
              <div className="flex items-center gap-4 bg-gray-800 p-4 rounded-lg hover:bg-gray-700 transition-colors">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-xl"
                  style={{ backgroundColor: `#${(user.anonymousId.length * 100).toString(16).slice(0, 6)}` }}
                >
                  {user.anonymousId.charAt(0)}
                </div>
                <div>
                  <p className="text-lg font-semibold text-white">{user.anonymousId}</p>
                  <p className="text-sm text-gray-400">Joined: {new Date(user.joinedAt).toLocaleDateString()}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default UserSearchResults;
