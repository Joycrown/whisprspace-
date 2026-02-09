'use client'

import { useModerationActions } from '@/lib/admin'
import { Shield, Ban, Trash2, AlertTriangle } from 'lucide-react'

interface ModerationActionsTableProps {
  targetUserId?: string
  limit?: number
}

export default function ModerationActionsTable({
  targetUserId,
  limit = 50,
}: ModerationActionsTableProps) {
  const { actions, isLoading } = useModerationActions(targetUserId)

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-yellow-600" />
      case 'content_delete':
        return <Trash2 className="w-4 h-4 text-red-600" />
      case 'user_suspend':
        return <Shield className="w-4 h-4 text-orange-600" />
      case 'user_ban':
        return <Ban className="w-4 h-4 text-red-600" />
      default:
        return <Shield className="w-4 h-4 text-gray-600" />
    }
  }

  const getActionBadge = (action: string) => {
    const colors: Record<string, string> = {
      warning: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400',
      content_delete: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
      user_suspend: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400',
      user_ban: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
      content_restore: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
    }

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold ${colors[action] || colors.warning} rounded-full`}>
        {getActionIcon(action)}
        {action.replace('_', ' ')}
      </span>
    )
  }

  if (isLoading) {
    return <div className="p-8 text-center">Loading moderation actions...</div>
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
          Moderation Actions
        </h2>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                Action
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                Target User
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                Reason
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                Duration
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                Date
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {actions.slice(0, limit).map((action) => (
              <tr key={action.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td className="px-6 py-4 whitespace-nowrap">
                  {getActionBadge(action.action)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                  {action.targetUserId?.substring(0, 8)}...
                </td>
                <td className="px-6 py-4 text-sm text-gray-900 dark:text-white max-w-xs truncate">
                  {action.reason}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                  {action.durationDays ? `${action.durationDays} days` : 'Permanent'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                  {new Date(action.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {actions.length === 0 && (
        <div className="p-8 text-center text-gray-500 dark:text-gray-400">
          No moderation actions
        </div>
      )}
    </div>
  )
}
