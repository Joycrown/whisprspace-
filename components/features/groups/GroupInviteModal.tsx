'use client'

import { useState, useEffect } from 'react'
import { useGroup } from '@/lib/groups'

interface GroupInviteModalProps {
  isOpen: boolean
  onClose: () => void
  groupId: string
}

export default function GroupInviteModal({ isOpen, onClose, groupId }: GroupInviteModalProps) {
  const { invites, loadInvites, createInvite, removeInvite } = useGroup(groupId)
  const [isGenerating, setIsGenerating] = useState(false)
  const [copiedCode, setCopiedCode] = useState<string | null>(null)

  const [inviteOptions, setInviteOptions] = useState({
    maxUses: 0, // 0 = unlimited
    expiresInDays: 7,
  })

  useEffect(() => {
    if (isOpen) {
      loadInvites()
    }
  }, [isOpen])

  const handleGenerate = async () => {
    setIsGenerating(true)

    const options = {
      maxUses: inviteOptions.maxUses || undefined,
      expiresInDays: inviteOptions.expiresInDays,
    }

    await createInvite(options)
    setIsGenerating(false)
  }

  const copyToClipboard = (code: string) => {
    navigator.clipboard.writeText(code)
    setCopiedCode(code)
    setTimeout(() => setCopiedCode(null), 2000)
  }

  const handleDelete = async (inviteId: string) => {
    if (confirm('Are you sure you want to delete this invite code?')) {
      await removeInvite(inviteId)
    }
  }

  const isExpired = (expiresAt?: string) => {
    if (!expiresAt) return false
    return new Date(expiresAt) < new Date()
  }

  const isMaxedOut = (currentUses: number, maxUses?: number) => {
    if (!maxUses) return false
    return currentUses >= maxUses
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Invite Codes</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Generate New Invite */}
          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
            <h3 className="font-bold text-gray-900 dark:text-white mb-3">Generate New Invite</h3>

            <div className="space-y-3">
              {/* Max Uses */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Max Uses (0 = unlimited)
                </label>
                <input
                  type="number"
                  min={0}
                  value={inviteOptions.maxUses}
                  onChange={(e) =>
                    setInviteOptions({ ...inviteOptions, maxUses: parseInt(e.target.value) || 0 })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
                />
              </div>

              {/* Expires In Days */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Expires in (days)
                </label>
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={inviteOptions.expiresInDays}
                  onChange={(e) =>
                    setInviteOptions({ ...inviteOptions, expiresInDays: parseInt(e.target.value) || 7 })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
                />
              </div>

              <button
                onClick={handleGenerate}
                disabled={isGenerating}
                className="w-full px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 text-white font-medium rounded-lg transition-colors"
              >
                {isGenerating ? 'Generating...' : '✨ Generate Invite Code'}
              </button>
            </div>
          </div>

          {/* Existing Invites */}
          <div>
            <h3 className="font-bold text-gray-900 dark:text-white mb-3">Active Invites</h3>

            {invites.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                No invite codes yet. Generate one above!
              </p>
            ) : (
              <div className="space-y-2">
                {invites.map((invite) => {
                  const expired = isExpired(invite.expiresAt)
                  const maxedOut = isMaxedOut(invite.currentUses, invite.maxUses || undefined)
                  const inactive = expired || maxedOut

                  return (
                    <div
                      key={invite.id}
                      className={`border ${
                        inactive
                          ? 'border-gray-200 dark:border-gray-700 opacity-50'
                          : 'border-purple-200 dark:border-purple-800'
                      } rounded-lg p-3`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        {/* Code */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <code className="text-lg font-mono font-bold text-purple-600 dark:text-purple-400">
                              {invite.code}
                            </code>
                            {inactive && (
                              <span className="text-xs px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-full">
                                {expired ? 'Expired' : 'Max Uses Reached'}
                              </span>
                            )}
                          </div>

                          <div className="flex gap-3 mt-1 text-xs text-gray-500 dark:text-gray-400">
                            <span>
                              Uses: {invite.currentUses} / {invite.maxUses || '∞'}
                            </span>
                            <span>
                              Expires: {invite.expiresAt ? new Date(invite.expiresAt).toLocaleDateString() : 'Never'}
                            </span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2">
                          <button
                            onClick={() => copyToClipboard(invite.code)}
                            className="p-2 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg"
                            title="Copy code"
                          >
                            {copiedCode === invite.code ? (
                              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            ) : (
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                            )}
                          </button>

                          <button
                            onClick={() => handleDelete(invite.id)}
                            className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                            title="Delete code"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
