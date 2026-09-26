'use client'

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BookOpen, Home, LogIn, MessageCircle, Plus, Sparkles, User } from 'lucide-react';
import { motion } from 'framer-motion';
import { STORIES_FEED_PATH, isStoriesPath, isStoryReaderPath, storiesIsHome } from '@/lib/stories/config';
import type { GatedFeature } from '@/lib/navigation/feature-gates';
import { useMessageBadge } from '@/lib/messaging';
import { useFeatureGate } from './useFeatureGate';

interface NavItem {
  icon: typeof Home;
  label: string;
  href: string;
  isActive: boolean;
  gate?: GatedFeature;
  badge?: number;
}

const BottomNav = () => {
  const pathname = usePathname();
  const { viewer, guard, openCreate, sheets } = useFeatureGate();
  const { unreadCount: unreadMessageCount } = useMessageBadge({
    enableRealtime: false,
    refetchInterval: 120000,
  });

  if (pathname?.startsWith('/discussions/') && pathname !== '/discussions/create') {
    return sheets;
  }

  if (isStoryReaderPath(pathname)) {
    return sheets;
  }

  const leftItems: NavItem[] = [
    {
      icon: BookOpen,
      label: 'Stories',
      href: STORIES_FEED_PATH,
      isActive: isStoriesPath(pathname),
    },
    {
      icon: Home,
      label: 'Discussions',
      href: '/discussions',
      isActive: pathname === '/discussions' || pathname === '/my-discussions' || (pathname === '/' && !storiesIsHome),
      gate: 'discussions',
    },
  ];

  const rightItems: NavItem[] = [
    {
      icon: MessageCircle,
      label: 'Inbox',
      href: '/inbox',
      badge: viewer.isRegistered ? unreadMessageCount : 0,
      isActive: pathname === '/inbox' || (pathname?.startsWith('/inbox/') ?? false),
      gate: 'inbox',
    },
    {
      icon: Sparkles,
      label: 'Ask',
      href: '/curiosity-ask',
      isActive: pathname?.startsWith('/curiosity-ask') ?? false,
      gate: 'ask',
    },
    viewer.hasSession
      ? {
          icon: User,
          label: 'Profile',
          href: '/profile',
          isActive: pathname === '/profile',
          gate: 'profile' as GatedFeature,
        }
      : {
          icon: LogIn,
          label: 'Sign in',
          href: `/auth?${new URLSearchParams({ view: 'login', redirect: pathname || '/' }).toString()}`,
          isActive: false,
        },
  ];

  const renderItem = (item: NavItem) => {
    const Icon = item.icon;
    return (
      <Link
        key={item.label}
        href={item.href}
        prefetch={false}
        onClick={(event) => { if (item.gate) guard(item.gate, event); }}
        className="relative flex flex-col items-center min-w-[48px] py-0.5"
      >
        <motion.div
          className={`relative flex items-center justify-center w-10 h-10 rounded-xl transition-colors ${item.isActive
            ? 'bg-purple-600/20 text-purple-400'
            : 'text-gray-400 hover:text-gray-200'
            }`}
          whileTap={{ scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 400, damping: 17 }}
        >
          <Icon className="w-4.5 h-4.5" />

          {item.badge && item.badge > 0 ? (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-orange-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center"
            >
              {item.badge > 99 ? '99+' : item.badge}
            </motion.span>
          ) : null}

          {item.isActive && (
            <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-8 h-1">
              <motion.div
                initial={{ opacity: 0, scaleX: 0.6 }}
                animate={{ opacity: 1, scaleX: 1 }}
                className="h-full w-full bg-purple-600 rounded-full"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            </div>
          )}
        </motion.div>

        <span className={`text-[10px] font-medium mt-0.5 transition-colors ${item.isActive ? 'text-purple-400' : 'text-gray-500'}`}>
          {item.label}
        </span>
      </Link>
    );
  };

  return (
    <>
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-gray-950/95 backdrop-blur-lg border-t border-gray-800"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-center justify-between px-2 pt-1.5 pb-0.5">
          <div className="flex flex-1 items-center justify-around">{leftItems.map(renderItem)}</div>

          <div className="relative flex items-center justify-center w-14">
            <button type="button" onClick={openCreate} aria-label="Create" className="relative flex flex-col items-center">
              <motion.div
                className="absolute -top-5 w-12 h-12 bg-gradient-to-br from-purple-600 to-orange-500 rounded-full flex items-center justify-center shadow-lg shadow-purple-500/50"
                whileTap={{ scale: 0.9 }}
                transition={{ type: 'spring', stiffness: 400, damping: 17 }}
              >
                <Plus className="w-5 h-5 text-white" />
              </motion.div>
              <span className="text-[10px] text-gray-500 mt-3">Create</span>
            </button>
          </div>

          <div className="flex flex-1 items-center justify-around">{rightItems.map(renderItem)}</div>
        </div>
      </nav>
      {sheets}
    </>
  );
};

export default BottomNav;
