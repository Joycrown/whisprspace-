'use client'

import { useState } from 'react';
import { Clock, Check, X, MessageCircle } from 'lucide-react';
import { useMessageStore, MessageRequest } from '@/store/messageStore';

export default function MessageRequests() {
  const { messageRequests, approveMessageRequest, rejectMessageRequest } = useMessageStore();
  const [processingId, setProcessingId] = useState<string | null>(null);

  const pendingRequests = messageRequests.filter(req => req.status === 'pending');

  const handleApprove = async (messageId: string) => {
    setProcessingId(messageId);
    await approveMessageRequest(messageId);
    setProcessingId(null);
  };

  const handleReject = async (messageId: string) => {
    setProcessingId(messageId);
    await rejectMessageRequest(messageId);
    setProcessingId(null);
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  if (pendingRequests.length === 0) {
    return (
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-8 md:p-12 text-center">
        <MessageCircle className="w-12 h-12 md:w-16 md:h-16 text-gray-600 mx-auto mb-3 md:mb-4" />
        <h3 className="text-lg md:text-xl font-semibold text-white mb-2">No Pending Requests</h3>
        <p className="text-sm md:text-base text-gray-400">
          Message requests from thread participants will appear here
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 md:space-y-4">
      <div className="flex items-center gap-2 mb-3 md:mb-4">
        <Clock className="w-4 h-4 md:w-5 md:h-5 text-orange-400" />
        <h3 className="text-base md:text-lg font-semibold text-white">
          Pending Requests ({pendingRequests.length})
        </h3>
      </div>

      {pendingRequests.map((request) => (
        <div
          key={request.id}
          className="bg-gray-800 border border-orange-500/30 rounded-xl p-4 md:p-6 hover:border-orange-500/50 transition-colors"
        >
          {/* Header */}
          <div className="flex items-start justify-between mb-3 md:mb-4 gap-2">
            <div className="flex items-center gap-2 md:gap-3 min-w-0">
              <div className="w-10 h-10 md:w-12 md:h-12 bg-purple-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-sm md:text-base font-semibold text-purple-400">
                  {request.senderAnonymousId.charAt(0)}
                </span>
              </div>
              <div className="min-w-0">
                <p className="text-sm md:text-base font-semibold text-white truncate">{request.senderAnonymousId}</p>
                <p className="text-[10px] md:text-xs text-gray-500">
                  From thread • {formatTimestamp(request.timestamp)}
                </p>
              </div>
            </div>
            <span className="text-[10px] md:text-xs bg-orange-500/20 text-orange-400 px-2 py-1 rounded-full whitespace-nowrap flex-shrink-0">
              Pending
            </span>
          </div>

          {/* Message Preview */}
          <div className="mb-3 md:mb-4 p-3 md:p-4 bg-gray-900 rounded-lg">
            <p className="text-gray-300 text-xs md:text-sm line-clamp-3">"{request.messagePreview}"</p>
          </div>

          {/* Info */}
          <div className="mb-3 md:mb-4 p-2.5 md:p-3 bg-blue-900/20 border border-blue-500/30 rounded-lg">
            <p className="text-[10px] md:text-xs text-blue-300">
              This user wants to message you from a thread you both participated in. Approve to read the full message and start a conversation.
            </p>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-2 md:gap-3">
            <button
              onClick={() => handleReject(request.messageId)}
              disabled={processingId === request.messageId}
              className="flex-1 py-2.5 md:py-3 border border-gray-700 hover:bg-red-500/10 hover:border-red-500/50 active:bg-red-500/20 rounded-lg text-gray-300 hover:text-red-400 text-sm md:text-base font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-50 min-h-[44px]"
            >
              {processingId === request.messageId ? (
                <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <X className="w-4 h-4" />
                  Reject
                </>
              )}
            </button>
            <button
              onClick={() => handleApprove(request.messageId)}
              disabled={processingId === request.messageId}
              className="flex-1 py-2.5 md:py-3 bg-gradient-to-r from-purple-600 to-orange-500 hover:opacity-90 active:scale-[0.98] rounded-lg text-white text-sm md:text-base font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-50 min-h-[44px]"
            >
              {processingId === request.messageId ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Allow Message
                </>
              )}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
