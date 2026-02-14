'use client'

import { useState } from 'react'
import { banUser } from '@/lib/admin/admin-service'

interface BanUserModalProps {
  userId: string
  userName: string
  onClose: () => void
  onSuccess?: () => void
}

export default function BanUserModal({
  userId,
  userName,
  onClose,
  onSuccess,
}: BanUserModalProps) {
  const [reason, setReason] = useState('')
  const [isPermanent, setIsPermanent] = useState(false)
  const [durationDays, setDurationDays] = useState(7)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleBan = async () => {
    if (!reason.trim()) {
      alert('Please provide a reason for the ban')
      return
    }

    setIsSubmitting(true)

    const { success, error } = await banUser(
      userId,
      reason,
      isPermanent,
      isPermanent ? undefined : durationDays
    )

    setIsSubmitting(false)

    if (success) {
      onSuccess?.()
      onClose()
    } else {
      alert(`Failed to ban user: ${error}`)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 modal-safe-overlay">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full modal-safe-panel overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Ban User
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Ban {userName} from the platform
          </p>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Reason */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Reason <span className="text-red-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 dark:bg-gray-700 dark:text-white"
              placeholder="Enter reason for ban..."
            />
          </div>

          {/* Ban Type */}
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isPermanent}
                onChange={(e) => setIsPermanent(e.target.checked)}
                className="w-4 h-4 text-red-600 rounded focus:ring-red-500"
              />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Permanent ban
              </span>
            </label>
          </div>

          {/* Duration (if not permanent) */}
          {!isPermanent && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Duration (days)
              </label>
              <input
                type="number"
                value={durationDays}
                onChange={(e) => setDurationDays(parseInt(e.target.value) || 7)}
                min="1"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 dark:bg-gray-700 dark:text-white"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                User will be unbanned automatically after {durationDays} days
              </p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleBan}
            disabled={isSubmitting}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            {isSubmitting ? 'Banning...' : 'Ban User'}
          </button>
        </div>
      </div>
    </div>
  )
}
