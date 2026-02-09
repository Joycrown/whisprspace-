'use client'

import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { MessageSquare, ThumbsUp, GitPullRequest } from 'lucide-react';
import { useUserStore } from '@/store/userStore';
import { useThreadStore } from '@/store/threadStore';
import { Thread, Message } from '@/types';

interface ActivityFeedProps {
  userId: string;
}

const ActivityFeed: React.FC<ActivityFeedProps> = ({ userId }) => {
  const { fetchThreads, threads, isLoading: isThreadsLoading, error: threadsError } = useThreadStore();

  useEffect(() => {
    // In a real application, you would fetch user-specific threads/messages/activities
    // For now, we'll just refetch all threads and filter them by authorId
    fetchThreads();
  }, [fetchThreads, userId]);

  const userThreads = threads.filter(thread => thread.authorId === userId);

  // For demonstration, let's create some mock messages associated with user threads
  const mockUserMessages: Message[] = userThreads.flatMap(thread => {
    return [
      {
        id: `msg_mock_${thread.id}_1`,
        threadId: thread.id,
        authorId: userId,
        authorName: 'You',
        content: `I commented on your thread: ${thread.title}`,
        timestamp: new Date(new Date(thread.createdAt).getTime() + 60 * 1000).toISOString(),
        likes: 0,
        hasLiked: false,
        replies: [],
      },
      {
        id: `msg_mock_${thread.id}_2`,
        threadId: thread.id,
        authorId: 'anonymous',
        authorName: 'Anonymous',
        content: `Someone replied to your thread: ${thread.title}`,
        timestamp: new Date(new Date(thread.createdAt).getTime() + 120 * 1000).toISOString(),
        likes: 0,
        hasLiked: false,
        replies: [],
      }
    ];
  });

  // Combine threads and messages into a single activity feed, sorted by timestamp
  const activityFeed = [...userThreads, ...mockUserMessages]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  if (isThreadsLoading) {
    return <div className="text-white p-4">Loading activity feed...</div>;
  }

  if (threadsError) {
    return <div className="text-red-500 p-4">Error loading activity: {threadsError}</div>;
  }

  if (activityFeed.length === 0) {
    return <div className="text-gray-400 p-4">No recent activity found.</div>;
  }

  return (
    <div className="space-y-4">
      {activityFeed.map((item) => {
        if ('title' in item) { // It's a Thread
          const thread = item as Thread;
          return (
            <motion.div
              key={thread.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="bg-gray-800 rounded-lg p-4 flex items-center gap-3"
            >
              <GitPullRequest className="w-5 h-5 text-purple-400" />
              <div>
                <p className="text-white font-medium">You created a thread:</p>
                <p className="text-gray-300 text-sm">{thread.title}</p>
                <span className="text-xs text-gray-500">{new Date(thread.createdAt).toLocaleString()}</span>
              </div>
            </motion.div>
          );
        } else { // It's a Message (could be a reply or a general message)
          const message = item as Message;
          return (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="bg-gray-800 rounded-lg p-4 flex items-center gap-3"
            >
              <MessageSquare className="w-5 h-5 text-blue-400" />
              <div>
                <p className="text-white font-medium">{message.authorId === userId ? 'You wrote:' : 'Someone replied:'}</p>
                <p className="text-gray-300 text-sm">{message.content}</p>
                <span className="text-xs text-gray-500">{new Date(message.timestamp).toLocaleString()}</span>
              </div>
            </motion.div>
          );
        }
      })}
    </div>
  );
};

export default ActivityFeed;

