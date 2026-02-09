'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, Send, Check, Flag, UserX, Search, MessageCircleOff } from 'lucide-react';
import { AnonymousMessage } from '@/types';
import { useUserStore } from '@/store/userStore';
import ReportModal from '@/components/ReportModal';

const AnonymousMessageThreadPage = () => {
  const router = useRouter();
  const params = useParams();
  const { session } = useUserStore();
  const [messages, setMessages] = useState<AnonymousMessage[]>([]);
  const [replyContent, setReplyContent] = useState('');
  const [showReportModal, setShowReportModal] = useState(false);
  const [selectedMessageToReport, setSelectedMessageToReport] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const inboxId = useMemo(() => Array.isArray(params.inboxId) ? params.inboxId[0] : params.inboxId, [params.inboxId]);
  const currentUserId = useMemo(() => session.user?.id || 'anonymous', [session.user?.id]);

  // Mock data for a specific inboxId
  useEffect(() => {
    if (inboxId) {
      // Simulate fetching messages for this inboxId
      const mockThreadMessages: AnonymousMessage[] = [
        {
          id: 'msg_thread_1_1',
          sender: 'anonymous',
          recipientId: inboxId as string,
          content: 'Hey, I wanted to reach out anonymously. Hope you are doing well!',
          timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
          read: true,
        },
        {
          id: 'msg_thread_1_2',
          sender: inboxId as string,
          recipientId: 'anonymous',
          content: 'Thanks for the message! I am doing okay. Who is this, by the way?',
          timestamp: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
          read: true,
        },
        {
          id: 'msg_thread_1_3',
          sender: 'anonymous',
          recipientId: inboxId as string,
          content: 'Cannot reveal my identity, but I am a friend. Just wanted to check in.',
          timestamp: new Date(Date.now() - 1 * 60 * 1000).toISOString(),
          read: false,
        },
      ];
      setMessages(mockThreadMessages);
    }
  }, [inboxId]);

  const handleSendMessage = useCallback(() => {
    if (replyContent.trim() && inboxId) {
      const newMessage: AnonymousMessage = {
        id: `msg_reply_${Date.now()}`,
        sender: currentUserId,
        recipientId: inboxId as string,
        content: replyContent.trim(),
        timestamp: new Date().toISOString(),
        read: false, // New messages are unread by recipient
      };
      setMessages(prev => [...prev, newMessage]);
      setReplyContent('');
      // In a real app, this would send the message to the backend.
      alert('Reply sent!');
    }
  }, [replyContent, inboxId, currentUserId]);

  const handleMarkAsRead = useCallback((messageId: string) => {
    setMessages(prev =>
      prev.map(msg => (msg.id === messageId ? { ...msg, read: true } : msg))
    );
    // In a real app, this would update the message status in the backend.
  }, []);

  const handleReportMessage = useCallback((messageId: string) => {
    setSelectedMessageToReport(messageId);
    setShowReportModal(true);
  }, []);

  const handleReportSubmit = useCallback((reason: string, customReason?: string) => {
    if (selectedMessageToReport) {

      // In a real app, send report to backend
      setShowReportModal(false);
      setSelectedMessageToReport(null);
    }
  }, [selectedMessageToReport]);

  const handleBlockSender = useCallback(() => {
    if (confirm('Are you sure you want to block this anonymous sender? You will no longer receive messages from them.')) {

      // In a real app, send block request to backend
      router.push('/anonymous-messages'); // Redirect to main anonymous messages page
    }
  }, [inboxId, router]);

  const filteredMessages = useMemo(() => {
    if (!searchQuery) return messages;
    return messages.filter(message =>
      message.content.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [messages, searchQuery]);

  return (
    <div className="flex flex-col h-screen bg-[#121212]">
      <div className="flex items-center justify-between p-4 border-b border-gray-800">
        <button onClick={() => router.push('/anonymous-messages')} className="text-gray-400 hover:text-white"><ArrowLeft className="w-5 h-5" /></button>
        <h1 className="text-xl font-bold text-white">Anonymous Chat with {inboxId === currentUserId ? 'You' : 'Anonymous User'}</h1>
        <div className="w-5 h-5"></div> {/* Placeholder for alignment */}
      </div>

      <div className="p-4 border-b border-gray-800">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search messages..."
            className="w-full p-2 pl-10 bg-gray-800 text-white rounded-lg border border-gray-700 focus:outline-none focus:ring-purple-500 focus:border-purple-500"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide p-4 space-y-4">
        {filteredMessages.length > 0 ? (
          filteredMessages.map(message => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className={`p-4 rounded-lg ${message.sender === currentUserId ? 'bg-purple-900 ml-auto' : 'bg-gray-800 mr-auto'
                } max-w-[80%] ${(message.sender === currentUserId) ? 'text-right' : 'text-left'}`}
            >
              <p className="text-sm text-gray-400 mb-1">{message.sender === currentUserId ? 'You' : 'Anonymous'}</p>
              <p className="text-white text-base">{message.content}</p>
              <div className="flex justify-end items-center gap-2 mt-1">
                {!message.read && message.sender === currentUserId && (
                  <button
                    onClick={() => handleMarkAsRead(message.id)}
                    className="text-green-400 hover:text-green-300 text-xs flex items-center gap-1"
                  >
                    <Check className="w-3 h-3" /> Mark as Read
                  </button>
                )}
                {message.sender === 'anonymous' && ( // Only allow reporting/blocking for anonymous senders
                  <>
                    <button
                      onClick={() => handleReportMessage(message.id)}
                      className="text-yellow-400 hover:text-yellow-300 text-xs"
                    >
                      Report
                    </button>
                    <button
                      onClick={handleBlockSender}
                      className="text-red-400 hover:text-red-300 text-xs"
                    >
                      Block Sender
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          ))
        ) : (
          <p className="text-gray-400 text-center mt-8">No messages in this thread yet.</p>
        )}
      </div>

      {/* Report Modal */}
      <ReportModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        onSubmit={handleReportSubmit}
      />

      <div className="p-4 border-t border-gray-800 flex items-center gap-3">
        <textarea
          className="flex-1 p-3 bg-gray-800 text-white rounded-lg border border-gray-700 focus:outline-none focus:ring-purple-500 focus:border-purple-500 resize-none"
          rows={1}
          placeholder="Reply anonymously..."
          value={replyContent}
          onChange={(e) => setReplyContent(e.target.value)}
          onKeyPress={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSendMessage();
            }
          }}
        ></textarea>
        <button
          onClick={handleSendMessage}
          className="p-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={!replyContent.trim()}
        >
          <Send className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

export default AnonymousMessageThreadPage;
