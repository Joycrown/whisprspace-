'use client'
import React, { useEffect } from 'react';
import { useUserSearchStore } from '@/store/userSearchStore';
import UserSearchResults from '@/components/features/user/UserSearchResults'; // To be created

const UserSearchPage: React.FC = () => {
  const { searchQuery, searchUsers, clearResults } = useUserSearchStore();

  useEffect(() => {
    if (searchQuery) {
      searchUsers(searchQuery);
    } else {
      clearResults();
    }
  }, [searchQuery, searchUsers, clearResults]);

  return (
    <div className="min-h-screen bg-[#121212] text-white p-6">
      <div className="max-w-3xl mx-auto bg-gray-900 rounded-lg shadow-lg p-6">
        <h1 className="text-3xl font-bold mb-6">Search Users</h1>
        <p className="text-gray-400 mb-4">Search for other users by their anonymous ID.</p>
        <UserSearchResults />
      </div>
    </div>
  );
};

export default UserSearchPage;
