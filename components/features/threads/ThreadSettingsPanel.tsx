import React, { useState, Fragment, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X } from 'lucide-react';
import { FaGlobe, FaEnvelope, FaUserMinus, FaPlus, FaSearch, FaLock, FaUnlock, FaUsers } from 'react-icons/fa'; // Import FaLock, FaUnlock, FaUsers
import { Thread, ThreadPrivacy, Participant } from '@/types';

interface ThreadSettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  thread: Thread;
  onUpdatePrivacy?: (privacy: ThreadPrivacy, memberLimit?: number) => void;
  onRemoveParticipant?: (participantId: string) => void; // New prop for removing participants
  onInviteParticipant?: (threadId: string, participantId: string) => void; // New prop for inviting participants
  participants: Participant[]; // Pass participants for filter dropdown
  onSetMessageFilter?: (filter: { senderId?: string; keyword?: string }) => void; // New prop for setting message filter
  currentMessageFilter?: { senderId?: string; keyword?: string }; // New prop for current message filter state
  onLockThread?: (threadId: string, isLocked: boolean) => void; // New prop for locking/unlocking thread
  onViewReportedMessages?: (threadId: string) => void; // New prop for viewing reported messages
}

const ThreadSettingsPanel: React.FC<ThreadSettingsPanelProps> = ({
  isOpen,
  onClose,
  thread,
  onUpdatePrivacy,
  onRemoveParticipant,
  onInviteParticipant,
  participants,
  onSetMessageFilter,
  currentMessageFilter,
  onLockThread,
}) => {
  const [currentPrivacy, setCurrentPrivacy] = useState<ThreadPrivacy>(thread.privacy);
  const [currentMemberLimit, setCurrentMemberLimit] = useState<number | undefined>(
    thread.privacy === 'invite_only' ? (thread.memberLimit ?? 10) : thread.memberLimit
  );
  const [hasChanges, setHasChanges] = useState(false);
  const [newParticipantId, setNewParticipantId] = useState('');
  const [filterSenderId, setFilterSenderId] = useState<string>(currentMessageFilter?.senderId || '');
  const [filterKeyword, setFilterKeyword] = useState<string>(currentMessageFilter?.keyword || '');
  const [isThreadLocked, setIsThreadLocked] = useState(thread.isLocked || false); // State for thread lock status

  useEffect(() => {
    setCurrentPrivacy(thread.privacy);
    setCurrentMemberLimit(
      thread.privacy === 'invite_only' ? (thread.memberLimit ?? 10) : thread.memberLimit
    );
    setIsThreadLocked(thread.isLocked || false);
  }, [thread]);

  useEffect(() => {
    if (currentPrivacy === 'invite_only' && !isThreadLocked) {
      setIsThreadLocked(true);
    }
  }, [currentPrivacy, isThreadLocked]);

  useEffect(() => {
    if (currentPrivacy === 'invite_only' && !currentMemberLimit) {
      setCurrentMemberLimit(10);
    }
  }, [currentPrivacy, currentMemberLimit]);

  useEffect(() => {
    const changed = currentPrivacy !== thread.privacy ||
                    (currentPrivacy !== 'public' && currentMemberLimit !== thread.memberLimit) ||
                    isThreadLocked !== (thread.isLocked || false);
    setHasChanges(changed);
  }, [currentPrivacy, currentMemberLimit, thread.privacy, thread.memberLimit, isThreadLocked, thread.isLocked]);

  useEffect(() => {
    setFilterSenderId(currentMessageFilter?.senderId || '');
    setFilterKeyword(currentMessageFilter?.keyword || '');
  }, [currentMessageFilter]);

  const handleSave = () => {
    const nextLockState = currentPrivacy === 'invite_only' ? true : isThreadLocked;
    if (onUpdatePrivacy) {
      onUpdatePrivacy(currentPrivacy, currentPrivacy === 'public' ? undefined : currentMemberLimit);
    }
    if (onLockThread && nextLockState !== (thread.isLocked || false)) {
      onLockThread(thread.id, nextLockState);
    }
    onClose();
  };

  const handleCancel = () => {
    setCurrentPrivacy(thread.privacy);
    setCurrentMemberLimit(
      thread.privacy === 'invite_only' ? (thread.memberLimit ?? 10) : thread.memberLimit
    ); // Reset member limit on cancel
    setIsThreadLocked(thread.isLocked || false); // Reset lock state
    onClose();
  };

  const handleApplyMessageFilter = () => {
    if (onSetMessageFilter) {
      onSetMessageFilter({ senderId: filterSenderId, keyword: filterKeyword });
    }
  };

  const handleClearMessageFilter = () => {
    if (onSetMessageFilter) {
      onSetMessageFilter({});
    }
    setFilterSenderId('');
    setFilterKeyword('');
  };

  const handleClose = () => {
    onClose();
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-[80]" onClose={handleClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-hidden">
          <div className="absolute inset-0 overflow-hidden">
            <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10">
              <Transition.Child
                as={Fragment}
                enter="transform transition ease-in-out duration-500 sm:duration-700"
                enterFrom="translate-x-full"
                enterTo="translate-x-0"
                leave="transform transition ease-in-out duration-500 sm:duration-700"
                leaveFrom="translate-x-0"
                leaveTo="translate-x-full"
              >
                <Dialog.Panel className="pointer-events-auto w-screen max-w-md">
                  <div className="flex h-full flex-col overflow-y-auto bg-gray-900 shadow-xl">
                    <div className="bg-gray-800 px-4 py-6 sm:px-6">
                      <div className="flex items-start justify-between">
                        <Dialog.Title className="text-lg font-medium text-white">Thread Settings</Dialog.Title>
                        <div className="ml-3 flex h-7 items-center">
                          <button
                            type="button"
                            className="relative rounded-md bg-gray-800 text-gray-400 hover:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
                            onClick={handleCancel}
                          >
                            <span className="absolute -inset-2.5" />
                            <span className="sr-only">Close panel</span>
                            <X className="h-6 w-6" aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="relative flex-1 px-4 py-6 sm:px-6">
                      <div className="space-y-6">
                        {/* Privacy Settings */}
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Thread Privacy</label>
                          <div className="mt-1 space-y-2">
                            <label className="flex items-center p-3 rounded-md bg-gray-800 border border-gray-700 cursor-pointer hover:bg-gray-700">
                              <input
                                type="radio"
                                name="settings-privacy"
                                value="public"
                                checked={currentPrivacy === 'public'}
                                onChange={() => setCurrentPrivacy('public')}
                                className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-600"
                              />
                              <FaGlobe className="ml-3 text-gray-400" />
                              <span className="ml-2 text-white">Public</span>
                              <p className="ml-auto text-sm text-gray-400">Anyone can view and join</p>
                            </label>
                            <label className="flex items-center p-3 rounded-md bg-gray-800 border border-gray-700 cursor-pointer hover:bg-gray-700">
                              <input
                                type="radio"
                                name="settings-privacy"
                                value="invite_only"
                                checked={currentPrivacy === 'invite_only'}
                                onChange={() => setCurrentPrivacy('invite_only')}
                                className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-600"
                              />
                              <FaEnvelope className="ml-3 text-gray-400" />
                              <span className="ml-2 text-white">Invite Only</span>
                              <p className="ml-auto text-sm text-gray-400">Requires invitation to join</p>
                            </label>
                          </div>
                        </div>

                        {/* Member Limit for Invite-Only Threads */}
                        {currentPrivacy === 'invite_only' && (
                          <div>
                            <label htmlFor="settings-member-limit" className="block text-sm font-medium text-gray-300 mb-2">Member Limit</label>
                            <div className="relative mt-1 rounded-md shadow-sm">
                              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                <FaUsers className="h-5 w-5 text-gray-400" aria-hidden="true" />
                              </div>
                              <input
                                type="number"
                                id="settings-member-limit"
                                value={currentMemberLimit || ''}
                                onChange={(e) => setCurrentMemberLimit(parseInt(e.target.value) || undefined)}
                                min={1}
                                className="block w-full rounded-md border-0 bg-gray-800 py-1.5 pl-10 text-white ring-1 ring-inset ring-gray-700 placeholder:text-gray-500 focus:ring-2 focus:ring-inset focus:ring-purple-500 sm:text-sm sm:leading-6"
                                placeholder="e.g., 50"
                              />
                            </div>
                          </div>
                        )}

                        {/* Participants Management (visible only for invite-only threads) */}
                        {currentPrivacy === 'invite_only' && (
                          <div>
                            <h3 className="text-sm font-medium text-gray-300 mb-3">Participants ({thread.participants?.length || 0} / {currentMemberLimit || 'Unlimited'})</h3>
                            <div className="space-y-3">
                              {thread.participants?.map(participant => (
                                <div key={participant.id} className="flex items-center gap-3 bg-gray-800 p-3 rounded-md">
                                  <img
                                    src={participant.avatar || 'https://via.placeholder.com/150'}
                                    alt={participant.name || 'Anonymous'}
                                    className="w-8 h-8 rounded-full"
                                  />
                                  <span className="flex-1 text-white">{participant.name || 'Anonymous'}</span>
                                  {/* Only allow removing if not the creator and if onRemoveParticipant is provided */}
                                  {thread.createdBy?.id !== participant.id && onRemoveParticipant && (
                                    <button
                                      onClick={() => onRemoveParticipant(participant.id)}
                                      className="text-red-500 hover:text-red-400 p-1.5 rounded-full hover:bg-gray-700 transition-colors"
                                      title="Remove Participant"
                                    >
                                      <FaUserMinus className="w-4 h-4" />
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                            
                            {/* Invite Participant */}
                            {thread.participants && thread.participants.length < (currentMemberLimit || Infinity) && onInviteParticipant && (
                              <div className="mt-4 flex gap-2">
                                <input
                                  type="text"
                                  value={newParticipantId}
                                  onChange={(e) => setNewParticipantId(e.target.value)}
                                  placeholder="Enter username or anonymous ID..."
                                  className="flex-1 px-3 py-2 rounded-md bg-gray-800 border-gray-700 text-white shadow-sm focus:border-purple-500 focus:ring-purple-500 sm:text-sm"
                                />
                                <button
                                  onClick={() => {
                                    if (newParticipantId.trim()) {
                                      onInviteParticipant(thread.id, newParticipantId.trim());
                                      setNewParticipantId('');
                                    }
                                  }}
                                  disabled={!newParticipantId.trim()}
                                  className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors disabled:opacity-50"
                                >
                                  <FaPlus className="inline mr-2" /> Invite
                                </button>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Message Filtering (visible for all threads in settings panel) */}
                        <div>
                          <h3 className="text-sm font-medium text-gray-300 mb-3">Message Filters</h3>
                          <div className="space-y-3">
                            <div>
                              <label htmlFor="filter-sender" className="block text-xs font-medium text-gray-400 mb-1">Filter by Sender</label>
                              <select
                                id="filter-sender"
                                value={filterSenderId}
                                onChange={(e) => setFilterSenderId(e.target.value)}
                                className="block w-full rounded-md bg-gray-800 border-gray-700 text-white shadow-sm focus:border-purple-500 focus:ring-purple-500 sm:text-sm py-2 px-3"
                              >
                                <option value="">All Participants</option>
                                {participants.map((p, index) => (
                                  <option key={p.id} value={p.id}>Participant {index + 1}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label htmlFor="filter-keyword" className="block text-xs font-medium text-gray-400 mb-1">Keyword Search</label>
                              <div className="flex rounded-md shadow-sm">
                                <div className="relative flex-grow focus-within:z-10">
                                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                    <FaSearch className="h-5 w-5 text-gray-400" aria-hidden="true" />
                                  </div>
                                  <input
                                    type="text"
                                    name="filter-keyword"
                                    id="filter-keyword"
                                    className="block w-full rounded-md border-0 bg-gray-800 py-1.5 pl-10 text-white ring-1 ring-inset ring-gray-700 placeholder:text-gray-500 focus:ring-2 focus:ring-inset focus:ring-purple-500 sm:text-sm sm:leading-6"
                                    placeholder="Search messages..."
                                    value={filterKeyword}
                                    onChange={(e) => setFilterKeyword(e.target.value)}
                                  />
                                </div>
                              </div>
                            </div>
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={handleClearMessageFilter}
                                className="rounded-md bg-gray-700 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-gray-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-500"
                              >
                                Clear Filters
                              </button>
                              <button
                                type="button"
                                onClick={handleApplyMessageFilter}
                                className="ml-4 inline-flex justify-center rounded-md bg-purple-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-purple-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-500"
                              >
                                Apply Filters
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Moderation Tools (visible to creator only) */}
                        {thread.createdBy?.id === thread.author.id && (
                          <div>
                            <h3 className="text-sm font-medium text-gray-300 mb-3">Moderation Tools</h3>
                            <div className="space-y-3">
                              <label className={`flex items-center justify-between p-3 rounded-md bg-gray-800 border border-gray-700 hover:bg-gray-700 ${currentPrivacy === 'invite_only' ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}>
                                <div className="flex items-center gap-2">
                                  {isThreadLocked ? <FaLock className="text-red-400" /> : <FaUnlock className="text-green-400" />}
                                  <span className="text-white">Lock Thread</span>
                                </div>
                                <input
                                  type="checkbox"
                                  checked={isThreadLocked}
                                  onChange={() => {
                                    if (currentPrivacy !== 'invite_only') {
                                      setIsThreadLocked(!isThreadLocked);
                                    }
                                  }}
                                  disabled={currentPrivacy === 'invite_only'}
                                  className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-600 rounded"
                                />
                              </label>
                            </div>
                          </div>
                        )}

                      </div>
                    </div>
                    <div className="flex flex-shrink-0 justify-end px-4 py-4 sm:px-6 border-t border-gray-700">
                      <button
                        type="button"
                        className="rounded-md bg-gray-700 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-gray-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-500"
                        onClick={handleCancel}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="ml-4 inline-flex justify-center rounded-md bg-purple-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-purple-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-500 disabled:opacity-50"
                        onClick={handleSave}
                        disabled={!hasChanges}
                      >
                        Save Changes
                      </button>
                    </div>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

export default ThreadSettingsPanel;
