'use client'
import React, { useMemo } from 'react';
import GlobalSearchBar from './GlobalSearchBar'; // Import GlobalSearchBar
import { useThreadStore } from '@/store/threadStore';
import { stringUtils } from '@/lib/utils';
import { Thread } from '@/types';

interface ThreadListSidebarProps {
  threads?: Thread[];
}

const ThreadListSidebar = ({ threads: threadsProp }: ThreadListSidebarProps) => {
  const { threads: storeThreads, setSearchQuery } = useThreadStore();
  const threads = threadsProp && threadsProp.length > 0 ? threadsProp : storeThreads;

  const trendingTopics = useMemo(() => {
    const fallbackTopics = ['#General', '#Tech', '#Lifestyle', '#Education', '#Business', '#Health'];
    if (!threads || threads.length === 0) return fallbackTopics;

    const topicMap = new Map<string, { score: number; label: string }>();
    const now = Date.now();

    const getRecencyMultiplier = (createdAt?: string) => {
      if (!createdAt) return 0.6;
      const ageHours = (now - new Date(createdAt).getTime()) / (1000 * 60 * 60);
      if (ageHours <= 24) return 1.5;
      if (ageHours <= 168) return 1.0;
      if (ageHours <= 720) return 0.6;
      return 0.3;
    };

    const toHashtag = (raw: string) => {
      const cleaned = raw.replace(/^#/, '').trim();
      if (!cleaned) return null;
      const display = cleaned
        .split(/[\s_-]+/)
        .filter(Boolean)
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join('');
      return display ? `#${display}` : null;
    };

    const addTopic = (raw: string, score: number) => {
      const tag = toHashtag(raw);
      if (!tag) return;
      const key = tag.toLowerCase();
      const existing = topicMap.get(key);
      topicMap.set(key, {
        label: existing?.label || tag,
        score: (existing?.score || 0) + score,
      });
    };

    const scoreThread = (thread: Thread) => {
      const likes = thread.likes || 0;
      const messages = thread.messageCount || 0;
      const participants = thread.participantCount || 0;
      const engagement = likes * 1 + messages * 2 + participants * 1.5;
      const recency = getRecencyMultiplier(thread.createdAt);
      return Math.max(1, engagement * recency);
    };

    threads.forEach(thread => {
      const baseScore = scoreThread(thread);

      if (thread.category) {
        addTopic(thread.category, baseScore * 0.6);
      }

      const tagSet = new Set<string>();
      (thread.tags || []).forEach(tag => tagSet.add(tag));
      const extracted = stringUtils.extractHashtags(`${thread.title} ${thread.content}`);
      extracted.forEach(tag => tagSet.add(tag));

      tagSet.forEach(tag => addTopic(tag, baseScore));
    });

    const ranked = Array.from(topicMap.values())
      .sort((a, b) => b.score - a.score)
      .map(item => item.label);

    return ranked.length > 0 ? ranked.slice(0, 6) : fallbackTopics;
  }, [threads]);

  const handleTopicClick = (topic: string) => {
    const query = topic.replace(/^#/, '').trim();
    setSearchQuery(query);
    document.getElementById('thread-list-container')?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="hidden lg:block w-80 border-l border-gray-800">
      <div className="sticky top-0 h-screen overflow-hidden">
        <div className="h-full overflow-y-auto scrollbar-hide">
          <div className="p-4 space-y-4">
            {/* Search Bar */}
            <GlobalSearchBar className="w-full" />

            {/* Active Threads - Hidden until we have actual data */}
            {/* 
            <div className="bg-gray-900 rounded-xl p-4">
              <h2 className="text-white font-bold mb-3">Active Threads</h2>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex -space-x-2">
                    <div className="w-8 h-8 rounded-full bg-purple-600 border-2 border-gray-900" />
                    <div className="w-8 h-8 rounded-full bg-orange-500 border-2 border-gray-900" />
                    <div className="w-8 h-8 rounded-full bg-green-500 border-2 border-gray-900" />
                  </div>
                  <div>
                    <h3 className="text-white font-medium">Privacy Discussion</h3>
                    <p className="text-sm text-gray-400">12 active users</p>
                  </div>
                </div>
              </div>
            </div>
            */}

            {/* Trending Topics */}
            <div className="bg-gray-900 rounded-xl p-4">
              <h2 className="text-white font-bold mb-3">Trending Topics</h2>
              <div className="space-y-2">
                {trendingTopics.map((topic, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => handleTopicClick(topic)}
                    className="text-left text-gray-400 hover:text-white transition-colors"
                  >
                    {topic}
                  </button>
                ))}
              </div>
            </div>

            {/* Premium Upgrade */}
            <div className="bg-gradient-to-r from-purple-900 to-purple-800 rounded-xl p-4">
              <h2 className="text-white font-bold">Upgrade to Premium</h2>
              <p className="text-gray-300 text-sm mt-1">Get extended thread duration and more features</p>
              <button className="w-full bg-white text-purple-900 font-semibold py-2 rounded-full mt-3 hover:bg-gray-100 transition-colors">
                Upgrade Now
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ThreadListSidebar;
