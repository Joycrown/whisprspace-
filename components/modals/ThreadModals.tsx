import React, { useCallback, useState } from 'react';
import { FaTimes } from 'react-icons/fa';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center modal-safe-overlay">
      <div className="fixed inset-0 bg-black bg-opacity-50" onClick={onClose} />
      <div className="relative bg-gray-800 rounded-lg p-6 max-w-md w-full modal-safe-panel overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white"
        >
          <FaTimes />
        </button>
        <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
        <p className="text-gray-300 mb-6">{description}</p>
        <div className="flex justify-end gap-3">
          {children}
        </div>
      </div>
    </div>
  );
};

interface MessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  participantName: string;
  onSendMessage: () => void;
}

export const MessageModal: React.FC<MessageModalProps> = ({
  isOpen,
  onClose,
  participantName,
  onSendMessage
}) => (
  <BaseModal
    isOpen={isOpen}
    onClose={onClose}
    title="Send Message"
    description={`Do you want to send a message to ${participantName}?`}
  >
    <button
      onClick={onClose}
      className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600 transition-colors"
    >
      Cancel
    </button>
    <button
      onClick={() => {
        onSendMessage();
        onClose();
      }}
      className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
    >
      Send Message
    </button>
  </BaseModal>
);

interface MessageOptionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  participantName: string;
  onSendOneOff: () => void;
  onStartConversation: () => void;
}

export const MessageOptionsModal: React.FC<MessageOptionsModalProps> = ({
  isOpen,
  onClose,
  participantName,
  onSendOneOff,
  onStartConversation
}) => (
  <BaseModal
    isOpen={isOpen}
    onClose={onClose}
    title="Send Message"
    description={`Choose how you want to message ${participantName}.`}
  >
    <button
      onClick={() => {
        onSendOneOff();
        onClose();
      }}
      className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
    >
      One-Off Message
    </button>
    <button
      onClick={() => {
        onStartConversation();
        onClose();
      }}
      className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 transition-colors"
    >
      Start Conversation
    </button>
  </BaseModal>
);

interface RemoveModalProps {
  isOpen: boolean;
  onClose: () => void;
  participantName: string;
  onRemove: () => void;
}

export const RemoveModal: React.FC<RemoveModalProps> = ({
  isOpen,
  onClose,
  participantName,
  onRemove
}) => (
  <BaseModal
    isOpen={isOpen}
    onClose={onClose}
    title="Remove Participant"
    description={`Are you sure you want to remove ${participantName} from this thread?`}
  >
    <button
      onClick={onClose}
      className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600 transition-colors"
    >
      Cancel
    </button>
    <button
      onClick={() => {
        onRemove();
        onClose();
      }}
      className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
    >
      Remove
    </button>
  </BaseModal>
);

interface ReportReason {
  id: string;
  label: string;
}

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onReport: (data: { reason: string; customReason?: string }) => void;
}

const REPORT_REASONS: ReportReason[] = [
  { id: 'inappropriate', label: 'Inappropriate content' },
  { id: 'harassment', label: 'Harassment or bullying' },
  { id: 'spam', label: 'Spam or misleading' },
  { id: 'hate', label: 'Hate speech' },
  { id: 'violence', label: 'Violence or threats' },
  { id: 'others', label: 'Others' }
];

export const ReportModal: React.FC<ReportModalProps> = ({
  isOpen,
  onClose,
  onReport
}) => {
  const [step, setStep] = useState<'confirm' | 'reason'>('confirm');
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [customReason, setCustomReason] = useState<string>('');

  const resetState = useCallback(() => {
    setStep('confirm');
    setSelectedReason('');
    setCustomReason('');
  }, []);

  const handleClose = useCallback(() => {
    onClose();
    resetState();
  }, [onClose, resetState]);

  const handleSubmit = useCallback(() => {
    if (!selectedReason) return;

    onReport({
      reason: selectedReason,
      ...(selectedReason === 'others' && { customReason })
    });

    handleClose();
  }, [selectedReason, customReason, onReport, handleClose]);

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={handleClose}
      title="Report Thread"
      description={
        step === 'confirm'
          ? "Are you sure you want to report this thread?"
          : "Please select a reason for reporting"
      }
    >
      <div className="space-y-4">
        {step === 'confirm' ? (
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => setStep('reason')}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
            >
              Yes, Report
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="reportReason" className="text-sm text-gray-300">
                Select a reason
              </label>
              <select
                id="reportReason"
                value={selectedReason}
                onChange={(e) => setSelectedReason(e.target.value)}
                className="w-full p-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
              >
                <option value="">Choose a reason</option>
                {REPORT_REASONS.map((reason) => (
                  <option key={reason.id} value={reason.id}>
                    {reason.label}
                  </option>
                ))}
              </select>
            </div>

            {selectedReason === 'others' && (
              <div className="space-y-2">
                <label htmlFor="customReason" className="text-sm text-gray-300">
                  Please specify your reason
                </label>
                <textarea
                  id="customReason"
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  placeholder="Describe why you're reporting this thread..."
                  className="w-full p-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 min-h-[80px]"
                  rows={3}
                />
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!selectedReason || (selectedReason === 'others' && !customReason)}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors 
                  disabled:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Submit Report
              </button>
            </div>
          </div>
        )}
      </div>
    </BaseModal>
  );
};

interface VisibilityModalProps {
  isOpen: boolean;
  onClose: () => void;
  isPublic: boolean;
  onToggleVisibility: () => void;
}

export const VisibilityModal: React.FC<VisibilityModalProps> = ({
  isOpen,
  onClose,
  isPublic,
  onToggleVisibility
}) => (
  <BaseModal
    isOpen={isOpen}
    onClose={onClose}
    title="Change Thread Visibility"
    description={isPublic
      ? "Making the thread private will restrict access to invited participants only."
      : "Making the thread public will allow anyone with the link to join."
    }
  >
    <button
      onClick={onClose}
      className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600 transition-colors"
    >
      Cancel
    </button>
    <button
      onClick={() => {
        onToggleVisibility();
        onClose();
      }}
      className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
    >
      Confirm
    </button>
  </BaseModal>
);

interface LinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShowLink: () => void;
}

export const LinkModal: React.FC<LinkModalProps> = ({
  isOpen,
  onClose,
  onShowLink
}) => (
  <BaseModal
    isOpen={isOpen}
    onClose={onClose}
    title="Show Thread Link"
    description="Are you sure you want to make the thread link visible? This action cannot be reversed."
  >
    <button
      onClick={onClose}
      className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600 transition-colors"
    >
      Cancel
    </button>
    <button
      onClick={() => {
        onShowLink();
        onClose();
      }}
      className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
    >
      Show Link
    </button>
  </BaseModal>
);

interface DeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDelete: () => void;
  isLoading?: boolean;
}

export const DeleteModal: React.FC<DeleteModalProps> = ({
  isOpen,
  onClose,
  onDelete,
  isLoading = false,
}) => (
  <BaseModal
    isOpen={isOpen}
    onClose={onClose}
    title="Delete Thread"
    description="Are you sure you want to delete this thread? This action is permanent and will remove all messages and attachments. This cannot be undone."
  >
    <button
      onClick={onClose}
      disabled={isLoading}
      className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600 transition-colors disabled:opacity-50"
    >
      Cancel
    </button>
    <button
      onClick={() => {
        onDelete();
      }}
      disabled={isLoading}
      className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors flex items-center gap-2 disabled:bg-red-800 disabled:cursor-not-allowed"
    >
      {isLoading ? (
        <>
          <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
          Deleting...
        </>
      ) : (
        'Delete Thread'
      )}
    </button>
  </BaseModal>
);

interface LeaveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isLoading?: boolean;
}

export const LeaveModal: React.FC<LeaveModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  isLoading = false,
}) => (
  <BaseModal
    isOpen={isOpen}
    onClose={onClose}
    title="Leave Thread"
    description="Are you sure you want to leave this thread? You will no longer receive notifications from this thread."
  >
    <button
      onClick={onClose}
      disabled={isLoading}
      className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600 transition-colors disabled:opacity-50"
    >
      Cancel
    </button>
    <button
      onClick={() => {
        onConfirm();
      }}
      disabled={isLoading}
      className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors flex items-center gap-2 disabled:bg-red-800 disabled:cursor-not-allowed"
    >
      {isLoading ? (
        <>
          <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
          Leaving...
        </>
      ) : (
        'Leave Thread'
      )}
    </button>
  </BaseModal>
);
