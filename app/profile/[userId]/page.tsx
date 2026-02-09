import React from 'react';
import { format } from 'date-fns';
import { createClient } from '@/lib/core/supabase/server';
import MessageForm from './components/MessageForm';
import { User } from '@/types';

interface UserProfilePageProps {
  params: Promise<{ userId: string }>;
}

export default async function UserProfilePage({ params }: UserProfilePageProps) {
  const { userId } = await params;
  const supabase = await createClient();

  // Helper patterns
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId);

  // 1. Fetch User
  // Try anonymous_id first (most common for this route)
  let { data: userData } = await supabase
    .from('users')
    .select('*')
    .eq('anonymous_id', userId)
    .single();

  // Fallback: Try ID if not found and is valid UUID
  if (!userData && isUuid) {
    const { data: dataById } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();
    userData = dataById;
  }

  // If still not found, show 404
  if (!userData) {
    // We can render a custom not found UI here or use Next.js default
    return (
      <div className="text-center text-white py-8 bg-[#121212] min-h-screen pt-20">
        <h2 className="text-2xl font-bold mb-2">User not found</h2>
        <p className="text-gray-400">The profile you are looking for does not exist.</p>
      </div>
    );
  }

  // Map to domain types
  const user: User = {
    ...userData,
    id: userData.id,
    anonymousId: userData.anonymous_id,
    isAnonymous: userData.is_anonymous,
    joinedAt: userData.created_at,
    lastActiveAt: userData.last_active_at,
  };

  return (
    <div className="flex flex-col items-center min-h-screen bg-[#121212] text-white p-6 pb-20">
      <div className="w-full max-w-4xl space-y-6">

        {/* Profile Header */}
        <div className="bg-gray-900 rounded-lg shadow-lg p-8 flex flex-col items-center">
          <div className="w-24 h-24 bg-purple-600 rounded-full flex items-center justify-center text-3xl font-bold mb-4 shadow-lg ring-4 ring-gray-800">
          </div>
          <h1 className="text-3xl font-bold mb-2">{user.anonymousId}</h1>
          <div className="flex gap-4 text-sm text-gray-400">
            <span>Joined: {user.joinedAt ? format(new Date(user.joinedAt), 'MMM yyyy') : 'Unknown'}</span>
          </div>
        </div>

        {/* Message Section */}
        {/* Pass user data to the client-side form */}
        <MessageForm
          recipientId={user.id}
          recipientName={user.anonymousId}
        />

        {/* Info Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Activity Placeholder */}
          <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
            <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
              <span>Recent Activity</span>
            </h2>
            <p className="text-gray-400 text-sm">
              This user's recent public activity will appear here.
            </p>
          </div>


        </div>
      </div>
    </div>
  );
}
