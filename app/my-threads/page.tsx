'use client'

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Crown, Settings, Users, MessageCircle, Calendar, TrendingUp, Globe, Lock } from 'lucide-react';
import { useThreadStore } from '@/store/threadStore';
import { useUserStore } from '@/store/userStore';
import { Thread } from '@/types';
import Link from 'next/link';
import { fetchInvitedThreads, joinThread } from '@/lib/threads';
import { useToast } from '@/components/ui/Toast';
import * as rawDb from '@/lib/core/supabase/raw-db';

type TabType = 'joined' | 'created' | 'invited';
type ThreadMessageCountRow = { thread_id: string; message_count: number | null };

export default function MyThreadsPage() {
  const router = useRouter();
  const { threads, fetchThreads } = useThreadStore();
  const { session, canCreateThread } = useUserStore();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<TabType>('joined');
  const [isLoading, setIsLoading] = useState(true);
  const [invitedThreads, setInvitedThreads] = useState<Thread[]>([]);
  const [joiningThreadId, setJoiningThreadId] = useState<string | null>(null);
  const [messageCountsByThread, setMessageCountsByThread] = useState<Record<string, number>>({});

  // Check if user is allowed to create threads
  const canCreate = canCreateThread();



  useEffect(() => {
    const loadThreads = async () => {
      setIsLoading(true);
      const userId = session?.user?.id;
      const invitesPromise = userId
        ? fetchInvitedThreads(userId)
        : Promise.resolve({ data: [], error: 'User not authenticated' });

      const [, invitesResult] = await Promise.all([
        fetchThreads(false, { privacy: 'all' }),
        invitesPromise,
      ]);

      if (invitesResult?.error) {
        showToast({
          type: 'error',
          title: 'Failed to Load Invites',
          message: invitesResult.error,
          duration: 4000,
        });
      } else if (invitesResult?.data) {
        setInvitedThreads(invitesResult.data.map(invite => invite.thread));
      }

      setIsLoading(false);
    };
    loadThreads();
  }, [fetchThreads, session?.user?.id, showToast]);

  useEffect(() => {
    const threadIds = Array.from(
      new Set(
        [...threads, ...invitedThreads]
          .map((thread) => thread.id)
          .filter((id): id is string => Boolean(id))
      )
    );

    if (threadIds.length === 0) {
      setMessageCountsByThread({});
      return;
    }

    let isMounted = true;

    const loadMessageCounts = async () => {
      const { data, error } = await rawDb.rpc<ThreadMessageCountRow[]>('get_thread_message_counts', {
        p_thread_ids: threadIds,
      });

      if (!isMounted) return;

      // Keep UI usable if migration has not been applied yet.
      if (error || !Array.isArray(data)) return;

      const nextCounts: Record<string, number> = {};
      data.forEach((row) => {
        if (!row?.thread_id) return;
        nextCounts[row.thread_id] = typeof row.message_count === 'number' ? row.message_count : 0;
      });

      setMessageCountsByThread(nextCounts);
    };

    loadMessageCounts();

    return () => {
      isMounted = false;
    };
  }, [threads, invitedThreads]);

  // Filter threads based on active tab
  const currentUserId = session?.user?.id || 'user_anon';

  // Debug logging


  const joinedThreads = threads.filter(thread =>
    thread.author.id !== currentUserId && thread.hasJoined
  );

  const createdThreads = threads.filter(thread =>
    thread.author.id === currentUserId
  );



  const displayThreads = activeTab === 'joined'
    ? joinedThreads
    : activeTab === 'invited'
      ? invitedThreads
      : createdThreads;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getThreadStats = (thread: Thread) => {
    return {
      messages: messageCountsByThread[thread.id] ?? thread.messageCount ?? 0,
      participants: thread.participantCount,
      likes: thread.likes,
    };
  };

  const handleThreadAction = async (thread: Thread, isJoinAction: boolean) => {
    if (!isJoinAction) {
      router.push(`/threads/${thread.id}`);
      return;
    }

    const userId = session?.user?.id;
    if (!userId) {
      router.push(`/auth?redirect=${encodeURIComponent(`/threads/${thread.id}`)}`);
      return;
    }

    setJoiningThreadId(thread.id);
    try {
      await joinThread(thread.id, userId);
      setInvitedThreads((prev) => prev.filter((invitedThread) => invitedThread.id !== thread.id));
      fetchThreads(false, { privacy: 'all' }).catch(() => null);
      router.push(`/threads/${thread.id}`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Could not join this thread. Ask the creator to re-send your invite.';
      showToast({
        type: 'error',
        title: 'Unable to Join Thread',
        message,
        duration: 5000,
      });
    } finally {
      setJoiningThreadId((current) => (current === thread.id ? null : current));
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#121212] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#121212] py-4 pb-28 md:py-8">
      <div className="max-w-6xl mx-auto px-3 md:px-4">
        {/* Header */}
        <div className="mb-6 md:mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">My Threads</h1>
          <p className="text-sm md:text-base text-gray-400">Manage your threads and track your activity</p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 mb-6 md:mb-8">
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 md:p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-purple-500/20 rounded-lg">
                <Users className="w-4 h-4 md:w-5 md:h-5 text-purple-400" />
              </div>
              <span className="text-gray-400 text-xs md:text-sm">Threads Joined</span>
            </div>
            <p className="text-2xl md:text-3xl font-bold text-white">{joinedThreads.length}</p>
          </div>

          <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 md:p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-orange-500/20 rounded-lg">
                <MessageCircle className="w-4 h-4 md:w-5 md:h-5 text-orange-400" />
              </div>
              <span className="text-gray-400 text-xs md:text-sm">Threads Created</span>
            </div>
            <p className="text-2xl md:text-3xl font-bold text-white">{createdThreads.length}</p>
          </div>

          <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 md:p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-green-500/20 rounded-lg">
                <Crown className="w-4 h-4 md:w-5 md:h-5 text-green-400" />
              </div>
              <span className="text-gray-400 text-xs md:text-sm">Premium Threads</span>
            </div>
            <p className="text-2xl md:text-3xl font-bold text-white">
              {createdThreads.filter(t => t.isPremium).length}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 md:gap-2 mb-6 border-b border-gray-800 overflow-x-auto">
          <button
            onClick={() => setActiveTab('joined')}
            className={`px-4 md:px-6 py-2 md:py-3 text-sm md:text-base font-semibold transition-colors relative whitespace-nowrap ${activeTab === 'joined'
              ? 'text-white'
              : 'text-gray-500 hover:text-gray-300'
              }`}
          >
            Joined ({joinedThreads.length})
            {activeTab === 'joined' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-600"></div>
            )}
          </button>
          <button
            onClick={() => setActiveTab('invited')}
            className={`px-4 md:px-6 py-2 md:py-3 text-sm md:text-base font-semibold transition-colors relative whitespace-nowrap ${activeTab === 'invited'
              ? 'text-white'
              : 'text-gray-500 hover:text-gray-300'
              }`}
          >
            Invited ({invitedThreads.length})
            {activeTab === 'invited' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-600"></div>
            )}
          </button>
          <button
            onClick={() => setActiveTab('created')}
            className={`px-4 md:px-6 py-2 md:py-3 text-sm md:text-base font-semibold transition-colors relative whitespace-nowrap ${activeTab === 'created'
              ? 'text-white'
              : 'text-gray-500 hover:text-gray-300'
              }`}
          >
            Created ({createdThreads.length})
            {activeTab === 'created' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-600"></div>
            )}
          </button>
        </div>

        {/* Thread List */}
        <div className="space-y-3 md:space-y-4">
          {displayThreads.length === 0 ? (
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-8 md:p-12 text-center">
              <MessageCircle className="w-12 h-12 md:w-16 md:h-16 text-gray-600 mx-auto mb-4" />
              <h3 className="text-lg md:text-xl font-semibold text-white mb-2">
                {activeTab === 'joined'
                  ? 'No Joined Threads'
                  : activeTab === 'invited'
                    ? 'No Invited Threads'
                    : 'No Created Threads'}
              </h3>
              <p className="text-sm md:text-base text-gray-400 mb-6">
                {activeTab === 'joined'
                  ? 'Start exploring and join threads that interest you'
                  : activeTab === 'invited'
                    ? 'You have no pending thread invitations right now'
                    : 'Create your first thread and start a conversation'}
              </p>
              <div className="relative group inline-block">
                {activeTab === 'created' && !canCreate ? (
                  <div className="flex flex-col items-center gap-2">
                    <button
                      disabled
                      className="inline-flex items-center gap-2 px-5 md:px-6 py-2.5 md:py-3 bg-gray-800 text-gray-600 text-sm md:text-base rounded-lg cursor-not-allowed border border-gray-700"
                    >
                      <span className="line-through opacity-50">Create Thread</span>
                    </button>
                    <span className="text-xs text-red-400">Guest accounts cannot create threads</span>
                  </div>
                ) : (
                  <Link
                    href={activeTab === 'created' ? '/threads/create' : '/threads'}
                    className="inline-flex items-center gap-2 px-5 md:px-6 py-2.5 md:py-3 bg-gradient-to-r from-purple-600 to-orange-500 text-white text-sm md:text-base rounded-lg hover:opacity-90 transition-opacity"
                  >
                    {activeTab === 'created' ? 'Create Thread' : 'Browse Threads'}
                  </Link>
                )}

                {/* Tooltip for guest users trying to create */}
                {activeTab === 'created' && !canCreate && (
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50 shadow-xl border border-gray-700">
                    Sign up to create threads
                  </div>
                )}
              </div>
            </div>
          ) : (
            displayThreads.map((thread) => {
              const stats = getThreadStats(thread);
              const isCreator = thread.author.id === currentUserId;
              const isJoinAction =
                activeTab === 'invited' && !isCreator && !thread.hasJoined;
              const isJoining = joiningThreadId === thread.id;
              const actionLabel = isJoinAction ? (isJoining ? 'Joining...' : 'Join') : 'View';

              return (
                <div
                  key={thread.id}
                  className={`bg-gray-800 border rounded-xl transition-all hover:border-purple-500/50 ${thread.isPremium
                    ? 'border-purple-500/30 bg-gradient-to-br from-purple-900/20 to-orange-900/20'
                    : 'border-gray-700'
                    }`}
                >
                  <div className="p-4 md:p-6">
                    {/* Thread Header */}
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between mb-3 md:mb-4 gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start flex-wrap gap-2 mb-2">
                          <Link
                            href={`/threads/${thread.id}`}
                            className="text-base md:text-xl font-semibold text-white hover:text-purple-400 transition-colors line-clamp-2"
                          >
                            {thread.title}
                          </Link>
                          {thread.isPremium && (
                            <div className="flex items-center gap-1 px-2 py-0.5 bg-gradient-to-r from-purple-600 to-orange-500 rounded-full flex-shrink-0">
                              <Crown className="w-3 h-3 text-white" />
                              <span className="text-xs text-white font-semibold">Premium</span>
                            </div>
                          )}
                          {!thread.isPremium && thread.privacy === 'public' && (
                            <div className="flex items-center gap-1 px-2 py-0.5 bg-blue-500/20 rounded-full flex-shrink-0">
                              <Globe className="w-3 h-3 text-blue-400" />
                              <span className="text-xs text-blue-400 font-semibold">Public</span>
                            </div>
                          )}
                          {!thread.isPremium && thread.privacy === 'private' && (
                            <div className="flex items-center gap-1 px-2 py-0.5 bg-amber-500/20 rounded-full flex-shrink-0">
                              <Lock className="w-3 h-3 text-amber-400" />
                              <span className="text-xs text-amber-400 font-semibold">Private</span>
                            </div>
                          )}
                          {!thread.isPremium && thread.privacy === 'invite_only' && (
                            <div className="flex items-center gap-1 px-2 py-0.5 bg-purple-500/20 rounded-full flex-shrink-0">
                              <Lock className="w-3 h-3 text-purple-400" />
                              <span className="text-xs text-purple-400 font-semibold">Invite Only</span>
                            </div>
                          )}
                        </div>
                        <p className="text-gray-400 text-xs md:text-sm line-clamp-2">{thread.content}</p>
                      </div>

                      {/* Actions */}
                      {isCreator && thread.isPremium && (
                        <button
                          onClick={() => router.push(`/threads/${thread.id}/manage`)}
                          className="flex items-center justify-center gap-2 px-3 md:px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-white text-xs md:text-sm font-medium transition-colors w-full md:w-auto"
                          title="Manage Access"
                        >
                          <Settings className="w-4 h-4" />
                          <span>Manage</span>
                        </button>
                      )}
                    </div>

                    {/* Thread Info */}
                    <div className="flex flex-wrap items-center gap-x-3 md:gap-x-4 gap-y-2 text-xs md:text-sm text-gray-400 mb-3 md:mb-4">
                      <div className="flex items-center gap-1 whitespace-nowrap">
                        <MessageCircle className="w-3.5 h-3.5 md:w-4 md:h-4" />
                        <span>{stats.messages} msg</span>
                      </div>
                      <div className="flex items-center gap-1 whitespace-nowrap">
                        <Users className="w-3.5 h-3.5 md:w-4 md:h-4" />
                        <span>{stats.participants}</span>
                      </div>
                      <div className="flex items-center gap-1 whitespace-nowrap">
                        <TrendingUp className="w-3.5 h-3.5 md:w-4 md:h-4" />
                        <span>{stats.likes}</span>
                      </div>
                      <div className="flex items-center gap-1 whitespace-nowrap">
                        <Calendar className="w-3.5 h-3.5 md:w-4 md:h-4" />
                        <span className="hidden sm:inline">{formatDate(thread.createdAt)}</span>
                        <span className="sm:hidden">{new Date(thread.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                      </div>
                      {thread.isPremium && thread.price && (
                        <div className="flex items-center gap-1 text-purple-400 font-semibold whitespace-nowrap">
                          <span>${thread.price.toFixed(2)}</span>
                        </div>
                      )}
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between pt-3 md:pt-4 border-t border-gray-700 gap-3">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        {thread.author.avatar?.startsWith('/avatars/') ? (
                          <img
                            src={thread.author.avatar}
                            alt={thread.author.anonymousId}
                            className="w-7 h-7 md:w-8 md:h-8 rounded-full object-cover flex-shrink-0"
                          />
                        ) : (
                          <div
                            className="w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center text-white text-xs font-medium flex-shrink-0"
                            style={{ backgroundColor: thread.author.avatar || '#666' }}
                          >
                            {thread.author.anonymousId.charAt(0)}
                          </div>
                        )}
                        <p className="text-xs md:text-sm text-gray-400 truncate">
                          {isCreator ? 'Created by you' : `By ${thread.author.anonymousId}`}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleThreadAction(thread, isJoinAction)}
                        disabled={isJoining}
                        className="px-3 md:px-4 py-1.5 md:py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-60 disabled:cursor-not-allowed rounded-lg text-white text-xs md:text-sm font-medium transition-colors whitespace-nowrap"
                      >
                        {actionLabel}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

