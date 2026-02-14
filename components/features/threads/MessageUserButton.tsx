'use client'

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Send, X } from 'lucide-react';

interface MessageUserButtonProps {
  userId: string;
  userAnonymousId: string;
  threadId: string;
  variant?: 'icon' | 'button';
}

export default function MessageUserButton({
  userId,
  userAnonymousId,
  threadId,
  variant = 'icon'
}: MessageUserButtonProps) {
  const router = useRouter();
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const handleConfirm = () => {
    // Navigate to DM page with thread context
    router.push(`/dm/${userId}?from=thread&threadId=${threadId}`);
  };

  const buttonContent = variant === 'icon' ? (
    <button
      onClick={() => setShowConfirmModal(true)}
      className="p-2 hover:bg-gray-700 rounded-lg text-gray-400 hover:text-purple-400 transition-colors"
      title="Send message"
    >
      <Send className="w-4 h-4" />
    </button>
  ) : (
    <button
      onClick={() => setShowConfirmModal(true)}
      className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-gray-300 hover:text-white text-sm font-medium transition-colors flex items-center gap-2"
    >
      <Send className="w-3.5 h-3.5" />
      Message
    </button>
  );

  return (
    <>
      {buttonContent}

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center modal-safe-overlay">
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 max-w-md w-full modal-safe-panel overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white">Send Message?</h3>
              <button
                onClick={() => setShowConfirmModal(false)}
                className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-gray-300 mb-6">
              Do you want to send a message to{' '}
              <span className="text-purple-400 font-semibold">{userAnonymousId}</span>?
            </p>

            <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4 mb-6">
              <p className="text-sm text-blue-300">
                <strong>Note:</strong> Since you met in a thread, they will need to approve your message request before it's delivered.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 py-3 border border-gray-700 hover:bg-gray-700 rounded-lg text-gray-300 font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                className="flex-1 py-3 bg-gradient-to-r from-purple-600 to-orange-500 hover:opacity-90 rounded-lg text-white font-semibold transition-opacity"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
