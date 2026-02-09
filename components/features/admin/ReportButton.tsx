'use client'

import { useState } from 'react'
import { createContentReport } from '@/lib/admin/admin-service'
import { Flag } from 'lucide-react'

interface ReportButtonProps {
  contentType: 'thread' | 'message' | 'user' | 'group'
  contentId: string
  reportedUserId: string
  compact?: boolean
}

export default function ReportButton({
  contentType,
  contentId,
  reportedUserId,
  compact = false,
}: ReportButtonProps) {
  const [showModal, setShowModal] = useState(false)
  const [reason, setReason] = useState<string>('spam')
  const [description, setDescription] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const reasons = [
    { value: 'spam', label: 'Spam' },
    { value: 'harassment', label: 'Harassment' },
    { value: 'hate_speech', label: 'Hate Speech' },
    { value: 'violence', label: 'Violence' },
    { value: 'sexual_content', label: 'Sexual Content' },
    { value: 'misinformation', label: 'Misinformation' },
    { value: 'copyright', label: 'Copyright Violation' },
    { value: 'other', label: 'Other' },
  ]

  const handleReport = async () => {
    setIsSubmitting(true)

    const { success, error } = await createContentReport(
      contentType,
      contentId,
      reportedUserId,
      reason,
      description
    )

    setIsSubmitting(false)

    if (success) {
      alert('Report submitted successfully')
      setShowModal(false)
      setDescription('')
    } else {
      alert(`Failed to submit report: ${error}`)
    }
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className={`flex items-center gap-2 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 transition-colors ${
          compact ? 'text-sm' : ''
        }`}
        title="Report content"
      >
        <Flag className={compact ? 'w-4 h-4' : 'w-5 h-5'} />
        {!compact && <span>Report</span>}
      </button>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full">
            {/* Header */}
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Report Content
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Help us keep the community safe
              </p>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              {/* Reason */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Reason <span className="text-red-500">*</span>
                </label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 dark:bg-gray-700 dark:text-white"
                >
                  {reasons.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Additional Details
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 dark:bg-gray-700 dark:text-white"
                  placeholder="Provide more context (optional)..."
                />
              </div>
            </div>

            {/* Actions */}
            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                disabled={isSubmitting}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleReport}
                disabled={isSubmitting}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {isSubmitting ? 'Submitting...' : 'Submit Report'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
