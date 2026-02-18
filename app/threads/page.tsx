'use client'
import { ThreadList } from "@/components/features/threads/ThreadList";
import Link from "next/link";
import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import ThreadListSidebar from "@/components/features/threads/ThreadListSideBar";
import { useThreadsQuery } from "@/lib/threads";
import { useUserStore } from "@/store/userStore";
import { useThreadStore } from "@/store/threadStore";
import { ThreadFilters, Thread } from "@/types";
import GlobalSearchBar from "@/components/features/threads/GlobalSearchBar";
import { useRealtimeFeed } from "@/lib/core/realtime/useRealtimeThread";
import AppLoadingState from "@/components/ui/AppLoadingState";

type TabType = 'all' | 'popular' | 'recent';

const ThreadsPage = () => {
  const { session } = useUserStore();
  const { searchQuery } = useThreadStore();
  useRealtimeFeed(); // Enable real-time updates for thread list (new threads, participant changes)
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const loader = useRef(null);

  const isAnonymous = session.user?.isAnonymous ?? true;
  // Direct check for permissions to avoid stale helper state
  const canCreate = session.isAuthenticated && !isAnonymous;

  // Build filters based on active tab
  const filters = useMemo<ThreadFilters>(() => {
    const baseFilters: ThreadFilters = {};

    switch (activeTab) {
      case 'all':
        // No filters, show all threads
        break;
      case 'popular':
        baseFilters.sortBy = 'popular';
        break;
      case 'recent':
        baseFilters.sortBy = 'newest';
        break;
    }

    return baseFilters;
  }, [activeTab]);

  // Use React Query for threads
  const { data, isLoading, error, fetchNextPage, hasNextPage, isFetchingNextPage } = useThreadsQuery(
    filters,
    searchQuery,
    session.user?.id
  );

  // Flatten pages into single threads array
  const threads = useMemo(() => {
    return data?.pages.flatMap(page => page.threads) ?? [];
  }, [data]);

  // Prevent hydration mismatch by waiting for client-side mount
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const tabs = [
    { id: 'all' as const, label: 'All' },
    { id: 'popular' as const, label: 'Popular' },
    { id: 'recent' as const, label: 'Recent' },
  ];

  // Infinite scroll logic with React Query
  const handleObserver = useCallback((entries: IntersectionObserverEntry[]) => {
    const target = entries[0];
    if (target.isIntersecting && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  useEffect(() => {
    const option = {
      root: null,
      rootMargin: "20px",
      threshold: 0
    };
    const observer = new IntersectionObserver(handleObserver, option);
    const currentLoader = loader.current;

    if (currentLoader) {
      observer.observe(currentLoader);
    }

    return () => {
      if (currentLoader) {
        observer.unobserve(currentLoader);
      }
    };
  }, [handleObserver]);

  // Scroll to top button visibility
  useEffect(() => {
    const scrollContainer = document.getElementById('thread-list-container');
    const handleScroll = () => {
      if (scrollContainer) {
        setIsScrolled(scrollContainer.scrollTop > 100);
      }
    };

    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', handleScroll);
      return () => scrollContainer.removeEventListener('scroll', handleScroll);
    }
  }, []);

  const scrollToTop = () => {
    document.getElementById('thread-list-container')?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="flex h-screen bg-[#121212] overflow-x-hidden w-full">
      {/* Main content area */}
      <div className="flex-1 min-w-0 border-x-0 md:border-x border-gray-800 flex flex-col relative overflow-x-hidden max-w-full">
        {/* Create Button */}
        <div
          className={`px-3 md:px-4 pt-3 md:pt-4 flex-shrink-0 transition-all duration-300 w-full ${isScrolled ? 'opacity-0 -translate-y-full absolute top-0 left-0 right-0' : 'opacity-100 translate-y-0 relative'
            }`}
        >
          {!isMounted ? (
            /* Skeleton placeholder during SSR/hydration */
            <div className="w-full bg-gray-700 py-3 md:py-4 px-4 md:px-6 rounded-xl md:rounded-2xl min-h-[48px] animate-pulse" />
          ) : canCreate ? (
            <Link href="/threads/create">
              <button className="w-full bg-gradient-to-r from-purple-600 to-orange-500 hover:from-purple-700 hover:to-orange-600 active:scale-[0.98] py-3 md:py-4 px-4 md:px-6 rounded-xl md:rounded-2xl text-white font-bold text-base md:text-lg shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center gap-2 group min-h-[48px]">
                <span className="text-xl md:text-2xl group-hover:rotate-90 transition-transform duration-300">+</span>
                <span className="hidden sm:inline">Create New Thread</span>
                <span className="sm:hidden">New Thread</span>
              </button>
            </Link>
          ) : (
            <div className="relative group flex flex-col items-center gap-2">
              <button
                disabled
                className="w-full bg-gray-800 cursor-not-allowed py-3 md:py-4 px-4 md:px-6 rounded-xl md:rounded-2xl text-gray-600 font-bold text-base md:text-lg shadow-lg border border-gray-700 transition-all duration-300 flex items-center justify-center gap-2 min-h-[48px]"
              >
                <div className="flex items-center justify-center gap-2 w-full">
                  <span className="text-xl md:text-2xl line-through opacity-50">+</span>
                  <span className="hidden sm:inline line-through opacity-50">Create New Thread</span>
                  <span className="sm:hidden line-through opacity-50">New Thread</span>
                </div>
              </button>
              <div className="text-xs text-red-400 font-medium">Guest accounts cannot create threads</div>

              {/* Tooltip */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50 shadow-xl border border-gray-700">
                <div className="text-center">
                  <p className="font-semibold">Sign up to create threads</p>
                </div>
                <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900"></div>
              </div>
              {/* CTA Link */}
              <Link
                href="/auth"
                className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity duration-200 bg-black/50 rounded-xl md:rounded-2xl backdrop-blur-sm"
              >
                <span className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-lg text-white font-semibold text-sm shadow-lg">
                  Sign Up Now
                </span>
              </Link>
            </div>
          )}
        </div>

        {/* Navigation Tabs - Mobile optimized with horizontal scroll */}
        <div className="pt-2 md:pt-4 border-b border-gray-800 flex-shrink-0 w-full overflow-hidden">
          <div className="flex gap-1 md:gap-4 overflow-x-auto scrollbar-hide px-3 md:px-4 pb-0">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`pb-2 md:pb-3 px-2 md:px-4 font-semibold text-xs md:text-base whitespace-nowrap transition-colors border-b-2 flex-shrink-0 ${activeTab === tab.id
                  ? 'text-white border-purple-600'
                  : 'text-gray-500 border-transparent hover:text-gray-300 active:text-gray-200'
                  }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Global Search Bar */}
        <div className="px-3 md:px-4 py-2 md:py-3 w-full max-w-full">
          <div className="w-full max-w-full">
            <GlobalSearchBar />
          </div>
        </div>

        {/* Thread List - Scrollable Container */}
        <div
          id="thread-list-container"
          className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-hide w-full"
        >
          <div className="divide-y divide-gray-800 w-full pb-28 md:pb-4">
            {error && (
              <div className="p-4 bg-red-900/20 border border-red-500 rounded-lg m-4">
                <p className="text-red-500 text-center">{error?.message || 'Failed to load threads'}</p>
              </div>
            )}

            {isLoading && threads.length === 0 ? (
              <AppLoadingState
                fullScreen={false}
                className="bg-transparent py-12"
                title="Syncing your conversations..."
              />
            ) : (
              <>
                {threads.length === 0 && !isLoading && !error ? (
                  <div className="text-center py-12">
                    <p className="text-gray-400 text-lg">No threads found</p>
                    <p className="text-gray-500 text-sm mt-2">Try adjusting your filters or create a new thread</p>
                  </div>
                ) : (
                  threads.map((thread: Thread) => (
                    <ThreadList key={thread.id} thread={thread} />
                  ))
                )}

                {threads.length > 0 && (
                  <div ref={loader} className="loading-indicator p-3 md:p-4 text-center text-gray-500 text-sm md:text-base">
                    {isFetchingNextPage && hasNextPage && (
                      <div className="flex justify-center items-center gap-2">
                        <div className="w-5 h-5 border-2 border-purple-200 border-t-purple-600 rounded-full animate-spin"></div>
                        <span>Loading more threads...</span>
                      </div>
                    )}
                    {!hasNextPage && !isLoading && (
                      <p className="text-gray-600">You&apos;ve reached the end</p>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Right Sidebar - Hidden on mobile/tablet */}
      <div className="hidden lg:block w-[310px]">
        <ThreadListSidebar threads={threads} />
      </div>

      {/* Scroll to Top Button */}
      <button
        onClick={scrollToTop}
        className={`fixed bottom-24 md:bottom-4 left-1/2 -translate-x-1/2 bg-purple-600 hover:bg-purple-700 active:scale-95 text-white p-3 rounded-full shadow-lg transition-all duration-300 z-30 ${isScrolled ? 'opacity-100 visible translate-y-0' : 'opacity-0 invisible translate-y-full'
          }`}
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5 12 3m0 0 7.5 7.5M12 3v18" />
        </svg>
      </button>
    </div>
  );
};

export default ThreadsPage;
