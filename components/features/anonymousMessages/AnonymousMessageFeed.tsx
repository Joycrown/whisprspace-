'use client'
import React, { useEffect } from 'react';
import { useAnonymousMessageStore } from '@/store/anonymousMessageStore';
import { useUserStore } from '@/store/userStore';
import { formatDistanceToNow } from 'date-fns';
import { FaCheckCircle, FaUserSecret } from 'react-icons/fa';

interface AnonymousMessageFeedProps {
  recipientId: string;
}

const AnonymousMessageFeed: React.FC<AnonymousMessageFeedProps> = ({ recipientId }) => {
  const { anonymousMessages, isLoading, error, fetchAnonymousMessages, markAnonymousMessageAsRead } = useAnonymousMessageStore();

  useEffect(() => {
    fetchAnonymousMessages(recipientId);
  }, [fetchAnonymousMessages, recipientId]);

  if (isLoading) return <div className="p-4 text-white">Loading anonymous messages...</div>;
  if (error) return <div className="p-4 text-red-500">Error: {error}</div>;

  return (
    <div className="bg-gray-900 rounded-lg shadow-lg p-6 max-w-xl mx-auto text-white">
      <h2 className="text-2xl font-bold mb-6">Anonymous Messages</h2>

      {anonymousMessages.length > 0 ? (
        <div className="space-y-4">
          {anonymousMessages.map(message => (
            <div
              key={message.id}
              className={`flex items-start gap-3 p-4 rounded-lg transition-colors 
                         ${message.read ? 'bg-gray-800 text-gray-400' : 'bg-gray-700 hover:bg-gray-600 text-white'}`}
            >
              <div className="flex-shrink-0 text-2xl mt-1">
                <FaUserSecret className="text-gray-500" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-lg">Anonymous Message</p>
                <p className="text-sm">{message.content}</p>
                <p className="text-xs text-gray-500 mt-1">
                  Received {formatDistanceToNow(new Date(message.timestamp), { addSuffix: true })} ago
                </p>
              </div>
              {!message.read && (
                <button 
                  onClick={() => markAnonymousMessageAsRead(message.id)}
                  className="flex-shrink-0 text-purple-400 hover:text-purple-300 p-2 rounded-full hover:bg-gray-800 transition-colors"
                  title="Mark as Read"
                >
                  <FaCheckCircle className="w-5 h-5" />
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          No anonymous messages received yet.
        </div>
      )}
    </div>
  );
};

export default AnonymousMessageFeed;
