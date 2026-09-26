'use client'

import React, { useState } from 'react';
import { Home, User, MessageCircle, FolderOpen, Sparkles, BookOpen, Plus, LogIn } from 'lucide-react';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useUserStore } from '@/store/userStore';
import SessionPanel from '../SessionPanel';
import { useMessageBadge } from '@/lib/messaging';
import { STORIES_FEED_PATH, isStoriesPath } from '@/lib/stories/config';
import type { GatedFeature } from '@/lib/navigation/feature-gates';
import { useFeatureGate } from './useFeatureGate';

const navItems: Array<{ icon: typeof Home; label: string; href: string; showMessageBadge?: boolean; gate?: GatedFeature }> = [
  { icon: BookOpen, label: 'Stories', href: STORIES_FEED_PATH },
  { icon: Home, label: 'Discussions', href: '/discussions', gate: 'discussions' },
  { icon: FolderOpen, label: 'My Discussions', href: '/my-discussions', gate: 'discussions' },
  { icon: MessageCircle, label: 'Messages', href: '/inbox', showMessageBadge: true, gate: 'inbox' },
  { icon: Sparkles, label: 'Curiosity Ask', href: '/curiosity-ask', gate: 'ask' },
  { icon: User, label: 'Profile', href: '/profile', gate: 'profile' },
];

const Sidebar = () => {
  const pathname = usePathname();
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [isSessionPanelOpen, setIsSessionPanelOpen] = useState(false);
  const { session } = useUserStore();
  const { viewer, guard, openCreate, sheets } = useFeatureGate();
  const { unreadCount: unreadMessageCount } = useMessageBadge({
    enableRealtime: false,
    refetchInterval: false,
  });

  return (
    <>
      {/* Sidebar - Hidden on mobile, visible on desktop */}
      <aside
        className="hidden md:flex fixed top-0 left-0 h-full w-20 bg-gray-950 shadow-xl z-40 border-r border-white/5 flex-col"
      >
        {/* Logo Section — fixed, never scrolls */}
        <div className="px-4 py-8 flex justify-center flex-shrink-0">
          <div className="relative w-12 h-12">
            <Image
              src="/assets/WS icon.png"
              alt="WhisprSpace Logo"
              fill
              className="object-contain"
              priority
            />
          </div>
        </div>

        {/* Navigation — scrolls if it doesn't fit between the logo and the
            bottom cluster, instead of overlapping either one. */}
        <nav className="flex-1 min-h-0 overflow-y-auto scrollbar-hide px-3 py-4 flex flex-col items-center gap-6">
          <div className="relative">
            {hoveredItem === 'create' && (
              <div className="absolute left-16 top-3 bg-gray-900 text-white text-sm py-1 px-3 rounded-md whitespace-nowrap">
                Create
              </div>
            )}
            <button
              type="button"
              onClick={openCreate}
              onMouseEnter={() => setHoveredItem('create')}
              onMouseLeave={() => setHoveredItem(null)}
              aria-label="Create"
              className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-purple-600 to-orange-500 text-white shadow-lg shadow-purple-500/30 transition-transform hover:scale-105 active:scale-95"
            >
              <Plus size={22} />
            </button>
          </div>
          {navItems.map((item) => {
            let isActive;
            if (item.href === STORIES_FEED_PATH) {
              isActive = isStoriesPath(pathname);
            } else if (pathname?.startsWith('/discussions/') && item.href === '/my-discussions') {
              isActive = true;
            } else if (item.href === '/discussions' && pathname === '/discussions') {
              isActive = true;
            } else if (item.href !== '/discussions' && item.href !== '/my-discussions') {
              isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
            } else if (item.href === '/my-discussions' && pathname === '/my-discussions') {
              isActive = true;
            } else {
              isActive = false;
            }

            const isHovered = hoveredItem === item.href;

            return (
              <div key={item.href} className="relative group">
                {/* Tooltip */}
                {isHovered && (
                  <div className="absolute left-16 bg-gray-900 text-white text-sm py-1 px-3 rounded-md whitespace-nowrap">
                    {item.label}
                  </div>
                )}

                <a
                  href={item.href}
                  onClick={(e) => {
                    if (item.gate && guard(item.gate, e)) return;
                    setSidebarOpen(false);
                  }}
                  onMouseEnter={() => setHoveredItem(item.href)}
                  onMouseLeave={() => setHoveredItem(null)}
                  className={`relative flex items-center justify-center w-12 h-12 rounded-xl transition-all duration-200 group
                    ${isActive
                      ? 'bg-gray-800/50 text-white'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800/30'
                    }`}
                >
                  <item.icon
                    size={22}
                    className={`transition-all duration-200 transform
                      ${isActive ? 'scale-110' : 'group-hover:scale-110'}
                      ${isHovered ? 'rotate-6' : ''}`}
                  />

                  {item.showMessageBadge && viewer.isRegistered && unreadMessageCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-orange-600 text-white text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full">
                      {unreadMessageCount}
                    </span>
                  )}
                  {/* Active Indicator */}
                  {isActive && (
                    <div className="absolute -right-3 w-1 h-6 bg-purple-500 rounded-l-full" />
                  )}
                </a>
              </div>
            );
          })}
        </nav>

        {/* Profile Section — fixed, never scrolls */}
        <div className="flex-shrink-0 py-6 flex flex-col items-center gap-3">
          <div className="relative group">
            {hoveredItem === 'session' && (
              <div className="absolute left-16 bg-gray-900 text-white text-sm py-1 px-3 rounded-md whitespace-nowrap">
                {viewer.hasSession ? 'Session Info' : 'Sign in'}
              </div>
            )}

            {!viewer.hasSession ? (
              <a
                href={`/auth?${new URLSearchParams({ view: 'login', redirect: pathname || '/' }).toString()}`}
                onMouseEnter={() => setHoveredItem('session')}
                onMouseLeave={() => setHoveredItem(null)}
                aria-label="Sign in"
                className="relative w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/10 to-orange-400/10 flex items-center justify-center hover:from-purple-500/20 hover:to-orange-400/20 transition-all duration-300"
              >
                <LogIn size={20} className="text-gray-400 group-hover:text-white transition-colors" />
              </a>
            ) : (
            <button
              onClick={() => setIsSessionPanelOpen(true)}
              onMouseEnter={() => setHoveredItem('session')}
              onMouseLeave={() => setHoveredItem(null)}
              className="relative w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/10 to-orange-400/10 flex items-center justify-center hover:from-purple-500/20 hover:to-orange-400/20 transition-all duration-300"
            >
              <User size={20} className="text-gray-400 group-hover:text-white transition-colors" />

              {/* Active session indicator */}
              {session.isAuthenticated && (
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-gray-950" />
              )}
            </button>
            )}
          </div>
        </div>
      </aside>
      {/* Session Panel */}
      <SessionPanel
        isOpen={isSessionPanelOpen}
        onClose={() => setIsSessionPanelOpen(false)}
      />
      {sheets}
    </>
  );
};

export default Sidebar;
