'use client'

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, FolderOpen, MessageCircle, User, Plus, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { useMessageBadge } from '@/lib/messaging';
import { useUserStore } from '@/store/userStore';

const BottomNav = () => {
  const pathname = usePathname();
  const { session } = useUserStore();
  const isAnonymous = session.user?.isAnonymous ?? true;
  const canCreateThread = session.isAuthenticated && !isAnonymous;
  const { unreadCount: unreadMessageCount } = useMessageBadge({
    enableRealtime: false,
    refetchInterval: 30000,
  });
  const leftItems = [
    {
      icon: Home,
      label: 'Home',
      href: '/threads',
      isActive: pathname === '/threads' || pathname === '/',
    },
    {
      icon: FolderOpen,
      label: 'My Discussions',
      href: '/my-threads',
      isActive: pathname === '/my-threads',
    },
  ];

  const rightItems = [
    {
      icon: MessageCircle,
      label: 'Inbox',
      href: '/inbox',
      badge: unreadMessageCount,
      isActive: pathname === '/inbox',
    },
    {
      icon: Sparkles,
      label: 'Curiosity Ask',
      href: '/curiosity-ask',
      isActive: pathname?.startsWith('/curiosity-ask') ?? false,
    },
    {
      icon: User,
      label: 'Profile',
      href: '/profile',
      isActive: pathname === '/profile',
    },
  ];

  // Hide bottom nav on thread detail pages to make room for input
  if (pathname?.startsWith('/threads/') && pathname !== '/threads' && pathname !== '/threads/create') {
    return null;
  }

  return (
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-gray-950/95 backdrop-blur-lg border-t border-gray-800"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-center justify-between px-2 pt-1.5 pb-0.5">
          <div className="flex flex-1 items-center justify-around">
            {leftItems.map((item) => {
              const Icon = item.icon;
              const isActive = item.isActive;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="relative flex flex-col items-center min-w-[48px] py-0.5"
                >
                  <motion.div
                    className={`relative flex items-center justify-center w-10 h-10 rounded-xl transition-colors ${isActive
                      ? 'bg-purple-600/20 text-purple-400'
                      : 'text-gray-400 hover:text-gray-200'
                      }`}
                    whileTap={{ scale: 0.9 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                  >
                    <Icon className="w-4.5 h-4.5" />

                    {isActive && (
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

                  <span
                    className={`text-[9px] font-medium mt-0.5 transition-colors ${isActive ? 'text-purple-400' : 'text-gray-500'
                      }`}
                  >
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>

          <div className="relative flex items-center justify-center w-14">
            {canCreateThread ? (
              <Link
                href="/threads/create"
                className="relative flex flex-col items-center"
              >
                <motion.div
                  className="absolute -top-5 w-12 h-12 bg-gradient-to-br from-purple-600 to-orange-500 rounded-full flex items-center justify-center shadow-lg shadow-purple-500/50"
                  whileTap={{ scale: 0.9 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                >
                  <Plus className="w-5 h-5 text-white" />
                </motion.div>
                <span className="text-[9px] text-gray-500 mt-3">Create</span>
              </Link>
            ) : (
              <button
                type="button"
                disabled
                aria-label="Create discussion disabled for guest users"
                className="relative flex flex-col items-center cursor-not-allowed"
              >
                <motion.div
                  className="absolute -top-5 w-12 h-12 bg-gray-800 border border-gray-700 rounded-full flex items-center justify-center"
                  transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                >
                  <Plus className="w-5 h-5 text-gray-500" />
                </motion.div>
                <span className="text-[9px] text-gray-600 mt-3 line-through opacity-70">Create</span>
              </button>
            )}
          </div>

          <div className="flex flex-1 items-center justify-around">
            {rightItems.map((item) => {
              const Icon = item.icon;
              const isActive = item.isActive;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="relative flex flex-col items-center min-w-[48px] py-0.5"
                >
                  <motion.div
                    className={`relative flex items-center justify-center w-10 h-10 rounded-xl transition-colors ${isActive
                      ? 'bg-purple-600/20 text-purple-400'
                      : 'text-gray-400 hover:text-gray-200'
                      }`}
                    whileTap={{ scale: 0.9 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                  >
                    <Icon className="w-4.5 h-4.5" />

                    {item.badge && item.badge > 0 && (
                      <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-orange-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center"
                      >
                        {item.badge > 99 ? '99+' : item.badge}
                      </motion.span>
                    )}

                    {isActive && (
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

                  <span
                    className={`text-[9px] font-medium mt-0.5 transition-colors ${isActive ? 'text-purple-400' : 'text-gray-500'
                      }`}
                  >
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>
  );
};

export default BottomNav;
