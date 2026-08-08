'use client';

import React, { Fragment, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { useRouter } from 'next/navigation';
import { X, MessageSquare, Clock, Sparkles, Loader2 } from 'lucide-react';
import { DirectMessage, Conversation, fetchMessages } from '@/lib/messaging/messaging-service';
import { format } from 'date-fns';
import { useUserStore } from '@/store/userStore';

// localStorage key the create-thread page reads to prefill the form + link the
// conversation so its messages import after the thread is created.
export const INBOX_THREAD_DRAFT_KEY = 'inbox_thread_draft';

interface MessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  message?: DirectMessage;
  conversation?: Conversation;
}

const MessageModal: React.FC<MessageModalProps> = ({
  isOpen,
  onClose,
  message,
  conversation
}) => {
  const router = useRouter();
  const { session } = useUserStore();
  const isGuest = session.user?.isAnonymous ?? false;

  const [preparing, setPreparing] = useState(false);

  const alreadyConverted = Boolean(conversation?.convertedThreadId);
  const canTurnIntoThread = Boolean(
    session.isAuthenticated && !isGuest && conversation?.id && !alreadyConverted
  );

  if (!message) return null;

  const conversationId = conversation?.id;

  // Go straight to the thread form (/threads/create) with the data prefilled.
  // Content = first 3 messages; title stays empty for the user to write. The
  // conversationId is carried so the create page imports the messages on publish.
  const handleTurnIntoThread = async () => {
    if (!conversationId || preparing) return;
    setPreparing(true);
    try {
      const { data } = await fetchMessages(conversationId, { limit: 3 });
      const firstThree = (data && data.length > 0 ? data : [message])
        .map((m) => (m.content || '').trim())
        .filter(Boolean)
        .slice(0, 3);
      const content = firstThree.join('\n\n');

      const draft = {
        conversationId,
        form: {
          title: '',
          content,
          type: 'text',
          category: 'general',
          privacy: 'public',
        },
      };
      localStorage.setItem(INBOX_THREAD_DRAFT_KEY, JSON.stringify(draft));

      onClose();
      router.push('/threads/create?from=inbox');
    } finally {
      setPreparing(false);
    }
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/80" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto modal-safe-overlay">
          <div className="flex min-h-full items-center justify-center text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-md modal-safe-panel transform overflow-y-auto rounded-2xl bg-gray-900 border border-gray-800 p-6 text-left align-middle shadow-xl transition-all">
                <div className="flex justify-between items-start mb-4">
                  <Dialog.Title
                    as="h3"
                    className="text-lg font-medium leading-6 text-white flex items-center gap-2"
                  >
                    <MessageSquare className="w-5 h-5 text-purple-500" />
                    Anonymous Message
                  </Dialog.Title>
                  <button
                    type="button"
                    className="rounded-md bg-gray-800 p-1 text-gray-400 hover:text-white hover:bg-gray-700 focus:outline-none"
                    onClick={onClose}
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="mt-2">
                  <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50">
                    <p className="text-gray-200 whitespace-pre-wrap [overflow-wrap:anywhere] text-base leading-relaxed">
                      {message.content}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between text-xs text-gray-500">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {format(new Date(message.createdAt), 'MMM d, yyyy h:mm a')}
                  </div>
                  <span>One-time message</span>
                </div>

                <div className="mt-6 flex justify-end gap-3">
                  {canTurnIntoThread && (
                    <button
                      type="button"
                      onClick={handleTurnIntoThread}
                      disabled={preparing}
                      className="inline-flex items-center gap-2 justify-center rounded-md bg-gradient-to-r from-purple-600 to-orange-500 px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 focus:outline-none"
                    >
                      {preparing ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Sparkles className="w-4 h-4" />
                      )}
                      Turn into thread
                    </button>
                  )}
                  <button
                    type="button"
                    className="inline-flex justify-center rounded-md border border-gray-700 bg-gray-800 px-4 py-2 text-sm font-medium text-gray-300 hover:bg-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 focus-visible:ring-offset-2"
                    onClick={onClose}
                  >
                    Close
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

export default MessageModal;
