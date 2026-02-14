import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaTimes } from 'react-icons/fa';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { reason: string; customReason?: string }) => void;
}

const ReportModal: React.FC<ReportModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
}) => {
  const [reason, setReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [isCustomReason, setIsCustomReason] = useState(false);

  const handleReasonChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setReason(e.target.value);
    setIsCustomReason(e.target.value === 'other');
    if (e.target.value !== 'other') {
      setCustomReason('');
    }
  };

  const handleSubmit = () => {
    if (reason) {
      onSubmit({ reason, customReason: isCustomReason ? customReason : undefined });
      setReason('');
      setCustomReason('');
      setIsCustomReason(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 bg-gray-950 bg-opacity-75 z-50 flex justify-center items-center modal-safe-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="bg-[#1a1a1a] p-6 rounded-lg shadow-xl w-full max-w-sm border border-gray-800 modal-safe-panel overflow-y-auto"
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -50, opacity: 0 }}
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-white">Report Message</h2>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-white"
              >
                <FaTimes className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-4">
              <label htmlFor="reason" className="block text-sm font-medium text-gray-300 mb-2">Reason for reporting:</label>
              <select
                id="reason"
                value={reason}
                onChange={handleReasonChange}
                className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:ring-purple-500 focus:border-purple-500"
              >
                <option value="">Select a reason</option>
                <option value="spam">Spam</option>
                <option value="hate_speech">Hate Speech</option>
                <option value="harassment">Harassment</option>
                <option value="inappropriate_content">Inappropriate Content</option>
                <option value="other">Other</option>
              </select>
            </div>

            {isCustomReason && (
              <div className="mb-4">
                <label htmlFor="customReason" className="block text-sm font-medium text-gray-300 mb-2">Please specify:</label>
                <textarea
                  id="customReason"
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  rows={3}
                  className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:ring-purple-500 focus:border-purple-500"
                  placeholder="Enter custom reason..."
                />
              </div>
            )}

            <div className="flex justify-end">
              <button
                onClick={handleSubmit}
                disabled={!reason}
                className={`px-4 py-2 rounded-md font-medium transition-colors ${
                  reason
                    ? 'bg-purple-600 hover:bg-purple-700 text-white'
                    : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                }`}
              >
                Submit Report
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ReportModal;
