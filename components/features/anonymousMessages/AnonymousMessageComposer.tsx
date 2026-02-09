'use client'
import React, { useState } from 'react';
import { useAnonymousMessageStore } from '@/store/anonymousMessageStore';

interface AnonymousMessageComposerProps {
  recipientId: string;
  onMessageSent?: () => void;
}

const AnonymousMessageComposer: React.FC<AnonymousMessageComposerProps> = ({ recipientId, onMessageSent }) => {
  const [content, setContent] = useState('');
  const { sendAnonymousMessage, isLoading, error, clearError } = useAnonymousMessageStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    clearError();
    await sendAnonymousMessage(recipientId, content);
    if (!error) {
      setContent('');
      onMessageSent?.();
    }
  };

  return (
    <div className="bg-gray-800 p-4 rounded-lg shadow-md">
      <h3 className="text-xl font-semibold text-white mb-4">Send Anonymous Message</h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        <textarea
          className="w-full p-3 rounded-md bg-gray-700 border border-gray-600 text-white placeholder-gray-400 focus:ring-purple-500 focus:border-purple-500"
          rows={4}
          placeholder="Type your anonymous message here..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          disabled={isLoading}
        ></textarea>
        <button
          type="submit"
          className="w-full px-4 py-2 bg-purple-600 text-white font-semibold rounded-md hover:bg-purple-700 transition-colors disabled:opacity-50"
          disabled={isLoading || !content.trim()}
        >
          {isLoading ? 'Sending...' : 'Send Anonymously'}
        </button>
        {error && <p className="text-red-500 text-sm mt-2">Error: {error}</p>}
      </form>
    </div>
  );
};

export default AnonymousMessageComposer;
