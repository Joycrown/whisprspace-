'use client';

import React from 'react';
import { X, LogOut, User } from 'lucide-react';
import { useUserStore } from '@/store/userStore';
import { useRouter } from 'next/navigation';

interface SessionPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const SessionPanel: React.FC<SessionPanelProps> = ({ isOpen, onClose }) => {
  const { session, logout } = useUserStore();
  const router = useRouter();

  if (!isOpen) return null;

  const handleLogout = async () => {
    await logout();
    onClose();
    router.push('/auth');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:justify-end pointer-events-none p-4">
      <div
        className="absolute inset-0 bg-black/50 pointer-events-auto"
        onClick={onClose}
      />
      <div className="relative w-full max-w-sm bg-gray-900 border border-gray-800 rounded-xl shadow-xl pointer-events-auto p-4 z-50">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-semibold flex items-center gap-2">
            <User size={18} />
            Session Info
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          {session.user ? (
            <div className="space-y-2">
              <div className="p-3 bg-gray-800 rounded-lg">
                <p className="text-sm text-gray-400">Signed in as</p>
                <p className="text-white font-medium">{session.user.username || session.user.anonymousId}</p>
                <p className="text-xs text-gray-500 mt-1">ID: {session.user.id}</p>
              </div>

              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 p-3 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-lg transition-colors font-medium"
              >
                <LogOut size={18} />
                Sign Out
              </button>
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-gray-400 mb-4">You are currently browsing as a guest.</p>
              <button
                onClick={() => {
                  onClose();
                  router.push('/auth');
                }}
                className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors"
              >
                Sign In
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SessionPanel;
