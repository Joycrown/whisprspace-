'use client'
import React from 'react';
import { useUserStore } from '@/store/userStore';
import AnonymousMessageComposer from '@/components/features/anonymousMessages/AnonymousMessageComposer';
import AnonymousMessageFeed from '@/components/features/anonymousMessages/AnonymousMessageFeed';

const AnonymousMessagesPage: React.FC = () => {
  const { session } = useUserStore();
  const currentUserId = session.user?.id || 'user_1'; // Default to user_1 for mock recipient

  return (
    <div className="min-h-screen bg-[#121212] text-white p-6">
      <div className="max-w-4xl mx-auto space-y-8">
        <h1 className="text-3xl font-bold mb-6">Anonymous Messaging</h1>
        <AnonymousMessageComposer recipientId={currentUserId} />
        <AnonymousMessageFeed recipientId={currentUserId} />
      </div>
    </div>
  );
};

export default AnonymousMessagesPage;

