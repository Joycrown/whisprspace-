'use client'

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useGroupStore } from '@/store/groupStore';
import { useUserStore } from '@/store/userStore';
import { useThreadStore } from '@/store/threadStore';
import { GroupMember } from '@/types';
import { Users, Lock, Eye, Flag, UserMinus, MessageCircle, Share2, Settings, ArrowLeft, X } from 'lucide-react';
import ReportModal from '@/components/ReportModal';
import GroupSettingsModal from '@/components/modals/GroupSettingsModal';
import { RemoveMemberModal, InviteCodeModal } from '@/components/modals/GroupModals';
import { ThreadList } from '@/components/features/threads/ThreadList';

const GroupDetailPage = () => {
  const params = useParams();
  const router = useRouter();
  const { currentGroup, fetchGroupById, isLoading, error, leaveGroup, deleteGroup, updateGroup, generateInviteCode } = useGroupStore();
  const { session } = useUserStore();
  const { threads, fetchGroupThreads, isLoading: isThreadsLoading, error: threadsError } = useThreadStore();
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showRemoveMemberModal, setShowRemoveMemberModal] = useState(false);
  const [selectedMemberToRemove, setSelectedMemberToRemove] = useState<GroupMember | null>(null);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);

  const groupId = useMemo(() => Array.isArray(params.groupId) ? params.groupId[0] : params.groupId, [params.groupId]);
  const currentUserId = useMemo(() => session.user?.id || 'anonymous', [session.user?.id]);

  useEffect(() => {
    if (groupId) {
      fetchGroupById(groupId);
    }
  }, [groupId, fetchGroupById]);

  useEffect(() => {
    if (groupId) {
      fetchGroupThreads(groupId);
    }
  }, [groupId, fetchGroupThreads]);

  const isMember = useMemo(() => {
    // For mock data, we'll assume current user is a member of groups 1 and 2
    return currentGroup?.members?.some(member => member.id === currentUserId);
  }, [currentGroup?.members, currentUserId]);

  const isCreator = useMemo(() => {
    return currentGroup?.createdBy === currentUserId;
  }, [currentGroup?.createdBy, currentUserId]);

  const handleLeaveGroup = async () => {
    if (currentGroup && confirm('Are you sure you want to leave this group?')) {
      const success = await leaveGroup(currentGroup.id);
      if (success) {
        router.push('/groups');
      }
    }
  };

  const handleDeleteGroup = async () => {
    if (currentGroup && confirm('Are you sure you want to delete this group? This action cannot be undone.')) {
      const success = await deleteGroup(currentGroup.id);
      if (success) {
        router.push('/groups');
      }
    }
  };

  const handleGenerateInviteCode = async () => {
    if (currentGroup) {
      const code = await generateInviteCode(currentGroup.id);
      if (code) {
        setGeneratedCode(code);
        setShowInviteModal(true);
      }
    }
  };

  const handleRemoveMemberClick = (member: GroupMember) => {
    setSelectedMemberToRemove(member);
    setShowRemoveMemberModal(true);
  };

  const handleRemoveMemberConfirm = async () => {
    if (currentGroup && selectedMemberToRemove) {
      // This is a placeholder for the actual store action

      // In a real scenario, you'd call an action like:
      // await removeGroupMember(currentGroup.id, selectedMemberToRemove.id);

      // Optimistically update UI
      updateGroup(currentGroup.id, {
        members: currentGroup.members.filter(m => m.id !== selectedMemberToRemove.id),
        currentMembers: currentGroup.currentMembers - 1,
      });
      setShowRemoveMemberModal(false);
      setSelectedMemberToRemove(null);
    }
  };

  const handleReportGroup = () => {
    setShowReportModal(true);
  };

  const handleReportSubmit = (reason: string, customReason?: string) => {

    // Send report to backend
    setShowReportModal(false);
  };

  if (isLoading) {
    return <div className="text-white p-4">Loading group details...</div>;
  }

  if (error) {
    return <div className="text-red-500 p-4">Error: {error}</div>;
  }

  if (!currentGroup) {
    return <div className="text-white p-4">Group not found.</div>;
  }

  const PrivacyIcon = currentGroup.privacy === 'public' ? Eye : Lock;
  const privacyText = currentGroup.privacy.replace('_', ' ').charAt(0).toUpperCase() + currentGroup.privacy.replace('_', ' ').slice(1);

  return (
    <div className="flex flex-col h-screen bg-[#121212]">
      <div className="flex items-center justify-between p-4 border-b border-gray-800">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-white"><ArrowLeft className="w-5 h-5" /></button>
        <h1 className="text-xl font-bold text-white">{currentGroup.name}</h1>
        <div className="flex items-center gap-4">
          {isCreator && (
            <button onClick={() => setShowSettingsModal(true)} className="text-gray-400 hover:text-white">
              <Settings className="w-5 h-5" />
            </button>
          )}
          <button onClick={handleReportGroup} className="text-gray-400 hover:text-red-500">
            <Flag className="w-5 h-5" />
          </button>
          {isMember && !isCreator && (
            <button onClick={handleLeaveGroup} className="text-red-400 hover:text-red-500">
              <UserMinus className="w-5 h-5" />
            </button>
          )}
          {isCreator && (
            <button onClick={handleDeleteGroup} className="text-red-400 hover:text-red-500">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide p-4">
        <div className="bg-[#1E1E1E] rounded-lg p-6 mb-6">
          <div className="flex items-center gap-4 mb-4">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center text-white text-3xl font-bold flex-shrink-0"
              style={{ backgroundColor: currentGroup.avatar }}
            >
              {currentGroup.name.charAt(0)}
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">{currentGroup.name}</h2>
              <p className="text-gray-400">Created by {currentGroup.createdBy}</p>
              <div className="flex items-center gap-2 text-gray-500 text-sm mt-1">
                <PrivacyIcon className="w-4 h-4" />
                <span>{privacyText} • {currentGroup.currentMembers}/{currentGroup.maxMembers} members</span>
              </div>
            </div>
          </div>
          <p className="text-gray-300 mb-4">{currentGroup.description}</p>

          {currentGroup.rules && (
            <div className="bg-gray-800 rounded-md p-3 text-sm text-gray-400 border border-gray-700">
              <h3 className="font-semibold text-white mb-2">Rules:</h3>
              <p>{currentGroup.rules}</p>
            </div>
          )}
        </div>

        {/* Group-specific thread feed */}
        <div className="bg-[#1E1E1E] rounded-lg p-6 mb-6">
          <h3 className="text-xl font-bold text-white mb-4">Group Discussions</h3>
          {isThreadsLoading ? (
            <div className="text-white">Loading group threads...</div>
          ) : threadsError ? (
            <div className="text-red-500">Error: {threadsError}</div>
          ) : threads.length > 0 ? (
            <div className="divide-y divide-gray-800">
              {threads.map(thread => (
                <ThreadList key={thread.id} thread={thread} />
              ))}
            </div>
          ) : (
            <p className="text-gray-400">No threads found for this group.</p>
          )}
        </div>

        {/* Member Management (Admin only) */}
        {isCreator && (
          <div className="bg-[#1E1E1E] rounded-lg p-6 mb-6">
            <h3 className="text-xl font-bold text-white mb-4">Member Management</h3>
            <div className="flex flex-col gap-3 mb-4">
              {currentGroup.members.map(member => (
                <div key={member.id} className="flex items-center justify-between p-3 bg-gray-800 rounded-md">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold"
                      style={{ backgroundColor: member.avatar }}
                    >
                      {member.name.charAt(0)}
                    </div>
                    <span className="text-white">{member.name}</span>
                    <span className="text-gray-500 text-xs">({member.role})</span>
                  </div>
                  {isCreator && member.id !== currentUserId && (
                    <button
                      onClick={() => handleRemoveMemberClick(member)}
                      className="text-red-400 hover:text-red-500 p-1 rounded-full hover:bg-gray-700 transition-colors"
                    >
                      <UserMinus className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={handleGenerateInviteCode}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
            >
              Generate Invite Code
            </button>
            <p className="text-gray-400 mt-4">Future: Direct invite functionality, change member roles.</p>
          </div>
        )}

        {/* Moderation Tools (Admin only) */}
        {isCreator && (
          <div className="bg-[#1E1E1E] rounded-lg p-6 mb-6">
            <h3 className="text-xl font-bold text-white mb-4">Moderation Tools</h3>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => { }} // Placeholder for future logic
                className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg transition-colors"
              >
                Review Reported Content
              </button>
              <button
                onClick={() => { }} // Placeholder for future logic
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
              >
                Mute/Ban Users
              </button>
            </div>
            <p className="text-gray-400 mt-4">Future: Detailed moderation interface.</p>
          </div>
        )}

        {/* Group Analytics Dashboard (Admin only) */}
        {isCreator && (
          <div className="bg-[#1E1E1E] rounded-lg p-6 mb-6">
            <h3 className="text-xl font-bold text-white mb-4">Group Analytics Dashboard</h3>
            <p className="text-gray-400">Future: Display group growth, activity, and engagement metrics here.</p>
          </div>
        )}

      </div>

      {/* Modals */}
      <ReportModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        onSubmit={handleReportSubmit}
      />

      {currentGroup && (
        <GroupSettingsModal
          isOpen={showSettingsModal}
          onClose={() => setShowSettingsModal(false)}
          group={currentGroup}
          onUpdate={updateGroup}
          isLoading={isLoading}
          error={error}
        />
      )}

      {currentGroup && generatedCode && (
        <InviteCodeModal
          isOpen={showInviteModal}
          onClose={() => setShowInviteModal(false)}
          inviteCode={generatedCode}
        />
      )}

      {selectedMemberToRemove && (
        <RemoveMemberModal
          isOpen={showRemoveMemberModal}
          onClose={() => setShowRemoveMemberModal(false)}
          memberName={selectedMemberToRemove.name}
          onRemove={handleRemoveMemberConfirm}
          isLoading={isLoading} // Use group store isLoading for modal
        />
      )}
    </div>
  );
};

export default GroupDetailPage;
