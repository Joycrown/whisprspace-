'use client'

import React, { useCallback, useState } from 'react';
import { X, AlertCircle, Check } from 'lucide-react';
import { GroupMember } from '@/types';

interface BaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description: string;
  children: React.ReactNode;
}

export const BaseModal: React.FC<BaseModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center modal-safe-overlay"
         onClick={onClose}>
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md mx-auto p-6 modal-safe-panel overflow-y-auto"
           onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
        >
          <X className="w-6 h-6" />
        </button>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">{title}</h3>
        <p className="text-gray-600 mb-6">{description}</p>
        <div className="flex flex-wrap justify-end gap-3">
          {children}
        </div>
      </div>
    </div>
  );
};

interface RemoveMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  memberName: string;
  onRemove: () => void;
  isLoading: boolean;
}

export const RemoveMemberModal: React.FC<RemoveMemberModalProps> = ({
  isOpen,
  onClose,
  memberName,
  onRemove,
  isLoading,
}) => (
  <BaseModal
    isOpen={isOpen}
    onClose={onClose}
    title="Remove Member"
    description={`Are you sure you want to remove ${memberName} from this group? This action cannot be undone.`}
  >
    <button
      onClick={onClose}
      className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
      disabled={isLoading}
    >
      Cancel
    </button>
    <button
      onClick={() => {
        onRemove();
      }}
      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      disabled={isLoading}
    >
      {isLoading ? 'Removing...' : 'Remove'}
    </button>
  </BaseModal>
);

interface InviteCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  inviteCode: string | null;
}

export const InviteCodeModal: React.FC<InviteCodeModalProps> = ({
  isOpen,
  onClose,
  inviteCode,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (inviteCode) {
      navigator.clipboard.writeText(inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Group Invite Code"
      description="Share this code to invite new members to your group."
    >
      <div className="flex flex-col gap-4 w-full">
        {inviteCode ? (
          <div className="relative">
            <input
              type="text"
              readOnly
              value={inviteCode}
              className="w-full p-3 pr-12 bg-gray-100 border border-gray-300 rounded-lg text-gray-800 font-mono text-sm"
            />
            <button
              onClick={handleCopy}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors"
            >
              {copied ? <Check className="w-4 h-4" /> : 'Copy'}
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-gray-600">
            <AlertCircle className="w-5 h-5" />
            <span>No invite code generated.</span>
          </div>
        )}
        <button
          onClick={onClose}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
        >
          Done
        </button>
      </div>
    </BaseModal>
  );
};

