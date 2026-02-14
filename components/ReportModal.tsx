'use client';

import React, { useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';

type ReportReason = 'spam' | 'harassment' | 'hate_speech' | 'misinformation' | 'other';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (reason: ReportReason, details?: string) => void;
  title?: string;
  description?: string;
}

const ReportModal: React.FC<ReportModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  title = 'Report Content',
  description = 'Please select a reason for reporting this content',
}) => {
  const [selectedReason, setSelectedReason] = useState<ReportReason>('spam');
  const [details, setDetails] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await onSubmit(selectedReason, details.trim() || undefined);
      onClose();
    } finally {
      setIsSubmitting(false);
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
          <div className="fixed inset-0 bg-black bg-opacity-50" />
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
              <Dialog.Panel className="w-full max-w-md modal-safe-panel transform overflow-y-auto rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                <Dialog.Title
                  as="h3"
                  className="text-lg font-medium leading-6 text-gray-900"
                >
                  {title}
                </Dialog.Title>
                <div className="mt-2">
                  <p className="text-sm text-gray-500">
                    {description}
                  </p>
                  
                  <div className="mt-4 space-y-2">
                    {[
                      { value: 'spam', label: 'Spam' },
                      { value: 'harassment', label: 'Harassment or Bullying' },
                      { value: 'hate_speech', label: 'Hate Speech' },
                      { value: 'misinformation', label: 'Misinformation' },
                      { value: 'other', label: 'Other' },
                    ].map((option) => (
                      <div key={option.value} className="flex items-center">
                        <input
                          id={`reason-${option.value}`}
                          name="report-reason"
                          type="radio"
                          checked={selectedReason === option.value}
                          onChange={() => setSelectedReason(option.value as ReportReason)}
                          className="h-4 w-4 text-indigo-600 focus:ring-indigo-500"
                        />
                        <label htmlFor={`reason-${option.value}`} className="ml-3 block text-sm font-medium text-gray-700">
                          {option.label}
                        </label>
                      </div>
                    ))}
                  </div>

                  {selectedReason === 'other' && (
                    <div className="mt-4">
                      <label htmlFor="details" className="block text-sm font-medium text-gray-700">
                        Please provide details
                      </label>
                      <div className="mt-1">
                        <textarea
                          rows={3}
                          name="details"
                          id="details"
                          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                          value={details}
                          onChange={(e) => setDetails(e.target.value)}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-6 flex justify-end space-x-3">
                  <button
                    type="button"
                    className="inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                    onClick={onClose}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="inline-flex justify-center rounded-md border border-transparent bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50"
                    onClick={handleSubmit}
                    disabled={isSubmitting || (selectedReason === 'other' && !details.trim())}
                  >
                    {isSubmitting ? 'Submitting...' : 'Submit Report'}
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

export default ReportModal;
