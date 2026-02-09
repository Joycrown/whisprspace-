'use client'

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, FolderOpen, MessageCircle, Bell, User, Plus } from 'lucide-react';
import { motion } from 'framer-motion';
import { useNotificationStore } from '@/store/notificationStore';
import { useMessageBadge } from '@/lib/messaging';
import { useUserStore } from '@/store/userStore';

const BottomNav = () => {
  const pathname = usePathname();
  const { session } = useUserStore();
  const { unreadCount } = useNotificationStore();
  const { unreadCount: unreadMessageCount } = useMessageBadge();



  const navItems = [
    {
      icon: Home,
      label: 'Home',
      href: '/threads',
      isActive: pathname === '/threads' || pathname === '/'
    },
    {
      icon: FolderOpen,
      label: 'My Threads',
      href: '/my-threads',
      isActive: pathname === '/my-threads'
    },
    {
      icon: Plus,
      label: 'Create',
      href: '/threads/create',
      isCenter: true,
      isActive: pathname === '/threads/create'
    },
    {
      icon: MessageCircle,
      label: 'Inbox',
      href: '/inbox',
      badge: unreadMessageCount,
      isActive: pathname === '/inbox'
    },
    {
      icon: User,
      label: 'Profile',
      href: '/profile',
      isActive: pathname === '/profile'
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
      <div className="flex items-center justify-around px-2 pt-1.5 pb-0.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.isActive;

          // Center "Create" button
          if (item.isCenter) {
            return (
              <Link
                key={item.href}
                href={item.href}
                className="relative flex flex-col items-center"
              >
                <motion.div
                  className="absolute -top-5 w-12 h-12 bg-gradient-to-br from-purple-600 to-orange-500 rounded-full flex items-center justify-center shadow-lg shadow-purple-500/50"
                  whileTap={{ scale: 0.9 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                >
                  <Icon className="w-5 h-5 text-white" />
                </motion.div>
                <span className="text-[9px] text-gray-500 mt-3">{item.label}</span>
              </Link>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className="relative flex flex-col items-center min-w-[52px] py-0.5"
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

                {/* Badge */}
                {item.badge && item.badge > 0 && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-orange-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center"
                  >
                    {item.badge > 99 ? '99+' : item.badge}
                  </motion.span>
                )}
              </motion.div>

              <span
                className={`text-[9px] font-medium mt-0.5 transition-colors ${isActive ? 'text-purple-400' : 'text-gray-500'
                  }`}
              >
                {item.label}
              </span>

              {/* Active indicator */}
              {isActive && (
                <motion.div
                  layoutId="bottomNavIndicator"
                  className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-8 h-1 bg-purple-600 rounded-full"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
