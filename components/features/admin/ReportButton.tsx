'use client'

import { useState } from 'react'
import { Flag } from 'lucide-react'
import { ReportModal } from '@/components/moderation/ReportModal'

interface ReportButtonProps {
  contentType: 'thread' | 'message'
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

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className={`flex items-center gap-2 text-gray-500 hover:text-red-500 transition-colors ${
          compact ? 'text-sm' : ''
        }`}
        title="Report content"
      >
        <Flag className={compact ? 'w-4 h-4' : 'w-5 h-5'} />
        {!compact && <span>Report</span>}
      </button>

      {showModal && (
        <ReportModal
          contentType={contentType}
          contentId={contentId}
          reportedUserId={reportedUserId}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  )
}
