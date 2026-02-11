'use client'

import React, { useState } from 'react';
import { Home, Settings, User, MessageCircle, FolderOpen, DollarSign } from 'lucide-react';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useUserStore } from '@/store/userStore';
import SessionPanel from '../SessionPanel';
import { useMessageBadge } from '@/lib/messaging';

const navItems = [
  { icon: Home, label: 'Home', href: '/threads' },
  { icon: FolderOpen, label: 'My Threads', href: '/my-threads' },
  { icon: MessageCircle, label: 'Messages', href: '/inbox', showMessageBadge: true },
  { icon: DollarSign, label: 'My Earnings', href: '/profile/earnings' },
  { icon: User, label: 'Profile', href: '/profile' },
  { icon: Settings, label: 'Settings', href: '/settings' },
];

const Sidebar = () => {
  const pathname = usePathname();
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [isSessionPanelOpen, setIsSessionPanelOpen] = useState(false);
  const { session } = useUserStore();
  const { unreadCount: unreadMessageCount } = useMessageBadge();

  return (
    <>
      {/* Sidebar - Hidden on mobile, visible on desktop */}
      <aside
        className="hidden md:flex fixed top-0 left-0 h-full w-20 bg-gray-950 shadow-xl z-40 border-r border-white/5 flex-col"
      >
        {/* Logo Section */}
        <div className="px-4 py-8 flex justify-center">
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

        {/* Navigation */}
        <nav className="px-3 py-4 flex flex-col items-center gap-6">
          {navItems.map((item) => {
            // Special handling for thread detail pages: they should highlight "My Threads"
            let isActive;
            if (pathname?.startsWith('/threads/') && item.href === '/my-threads') {
              // Thread detail pages should highlight "My Threads"
              isActive = true;
            } else if (item.href === '/threads' && pathname === '/threads') {
              // Only highlight Home when on the exact /threads route
              isActive = true;
            } else if (item.href !== '/threads' && item.href !== '/my-threads') {
              // For other routes, use normal matching
              isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
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
                    setSidebarOpen(false); // Close mobile menu on navigation
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

                  {item.showMessageBadge && unreadMessageCount > 0 && (
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

        {/* Profile Section */}
        <div className="absolute bottom-6 left-0 right-0 flex justify-center">
          <div className="relative group">
            {/* Tooltip */}
            {hoveredItem === 'session' && (
              <div className="absolute left-16 bg-gray-900 text-white text-sm py-1 px-3 rounded-md whitespace-nowrap">
                Session Info
              </div>
            )}

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
          </div>
        </div>
      </aside>
      {/* Session Panel */}
      <SessionPanel
        isOpen={isSessionPanelOpen}
        onClose={() => setIsSessionPanelOpen(false)}
      />
    </>
  );
};

export default Sidebar;
