'use client'

import { useUserDetails } from '@/lib/admin'
import { useUserActivitySummary } from '@/lib/analytics/useAnalytics'
import { X, Activity, Clock, Shield, Calendar } from 'lucide-react'

interface UserDetailsModalProps {
  userId: string
  onClose: () => void
}

export default function UserDetailsModal({ userId, onClose }: UserDetailsModalProps) {
  const { user, isLoading: isUserLoading } = useUserDetails(userId)
  const { summary, isLoading: isSummaryLoading } = useUserActivitySummary(userId)

  const isLoading = isUserLoading || isSummaryLoading

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">User Details</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
            </div>
          ) : user ? (
            <div className="space-y-8">
              {/* Profile Header */}
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center text-white text-xl font-bold shadow-md flex-shrink-0">
                  {user.avatarUrl ? (
                    <img
                      src={user.avatarUrl}
                      alt={user.anonymousId}
                      className="w-full h-full object-cover rounded-full"
                    />
                  ) : (
                    user.anonymousId?.charAt(0).toUpperCase() || '?'
                  )}
                </div>
                <div className="min-w-0">
                  <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2 flex-wrap">
                    {user.anonymousId}
                    {user.isAdmin && (
                      <span className="px-2 py-0.5 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 text-xs rounded-full font-semibold flex items-center gap-1">
                        <Shield className="w-3 h-3" /> Admin
                      </span>
                    )}
                    {user.is_banned && (
                      <span className="px-2 py-0.5 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 text-xs rounded-full font-semibold">
                        Banned
                      </span>
                    )}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {user.email || 'No email provided'}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 break-all">
                    ID: {user.id}
                  </p>
                </div>
              </div>

              {/* Status Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
                  <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-1">
                    <Calendar className="w-4 h-4 text-blue-500" /> Joined
                  </div>
                  <div className="text-sm font-bold text-gray-900 dark:text-white mt-1">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
                  <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-1">
                    <Clock className="w-4 h-4 text-purple-500" /> Last Active
                  </div>
                  <div className="text-sm font-bold text-gray-900 dark:text-white mt-1">
                    {user.lastActiveAt ? new Date(user.lastActiveAt).toLocaleDateString() : 'Never'}
                  </div>
                </div>
              </div>

              {/* Activity Summary */}
              {summary && (
                <div>
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                    Activity Summary
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    <div className="p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm">
                      <div className="text-xs text-gray-500 dark:text-gray-400">Total Threads</div>
                      <div className="text-xl font-semibold text-gray-900 dark:text-white">{summary.totalThreads || 0}</div>
                    </div>
                    <div className="p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm">
                      <div className="text-xs text-gray-500 dark:text-gray-400">Total Messages</div>
                      <div className="text-xl font-semibold text-gray-900 dark:text-white">{summary.totalMessages || 0}</div>
                    </div>
                    <div className="p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm">
                      <div className="text-xs text-gray-500 dark:text-gray-400">Groups Joined</div>
                      <div className="text-xl font-semibold text-gray-900 dark:text-white">{summary.groupsJoined || 0}</div>
                    </div>
                    <div className="p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm">
                      <div className="text-xs text-gray-500 dark:text-gray-400">Likes Given</div>
                      <div className="text-xl font-semibold text-gray-900 dark:text-white">{summary.totalLikesGiven || 0}</div>
                    </div>
                    <div className="p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm">
                      <div className="text-xs text-gray-500 dark:text-gray-400">Likes Received</div>
                      <div className="text-xl font-semibold text-gray-900 dark:text-white">{summary.totalLikesReceived || 0}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              User details not found.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/80 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
