'use client'

import { GroupMember } from '@/lib/groups'
import { useState } from 'react'

interface GroupMembersListProps {
  members: GroupMember[]
  currentUserId?: string
  onRoleChange?: (userId: string, newRole: 'admin' | 'moderator' | 'member') => void
  onRemoveMember?: (userId: string) => void
  canManageMembers?: boolean
}

export default function GroupMembersList({
  members,
  currentUserId,
  onRoleChange,
  onRemoveMember,
  canManageMembers = false,
}: GroupMembersListProps) {
  const [expandedMember, setExpandedMember] = useState<string | null>(null)

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
      case 'moderator':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
      default:
        return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
    }
  }

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin':
        return '👑'
      case 'moderator':
        return '🛡️'
      default:
        return '👤'
    }
  }

  return (
    <div className="space-y-2">
      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3">
        Members ({members.length})
      </h3>

      {members.length === 0 ? (
        <p className="text-gray-500 dark:text-gray-400 text-center py-8">
          No members yet
        </p>
      ) : (
        <div className="space-y-2">
          {members.map((member) => (
            <div
              key={member.userId}
              className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700"
            >
              <div className="flex items-center justify-between">
                {/* Member Info */}
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {/* Avatar */}
                  <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0">
                    {member.user?.avatarUrl ? (
                      <img
                        src={member.user.avatarUrl}
                        alt={member.user.anonymousId}
                        className="w-full h-full object-cover rounded-full"
                      />
                    ) : (
                      member.user?.anonymousId?.charAt(0).toUpperCase() || '?'
                    )}
                  </div>

                  {/* Name & Role */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900 dark:text-white truncate">
                        {member.user?.anonymousId || 'Anonymous'}
                      </span>
                      {member.userId === currentUserId && (
                        <span className="text-xs text-purple-600 dark:text-purple-400">(You)</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${getRoleColor(member.role)}`}>
                        {getRoleIcon(member.role)} {member.role}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        Joined {new Date(member.joinedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions (for admins/mods) */}
                {canManageMembers && member.userId !== currentUserId && (
                  <button
                    onClick={() =>
                      setExpandedMember(expandedMember === member.userId ? null : member.userId)
                    }
                    className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
                      />
                    </svg>
                  </button>
                )}
              </div>

              {/* Expanded Actions */}
              {expandedMember === member.userId && canManageMembers && (
                <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 space-y-2">
                  {/* Change Role */}
                  <div className="flex gap-2">
                    {member.role !== 'admin' && (
                      <button
                        onClick={() => onRoleChange?.(member.userId, 'admin')}
                        className="flex-1 px-3 py-1.5 text-sm bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30"
                      >
                        👑 Make Admin
                      </button>
                    )}
                    {member.role !== 'moderator' && (
                      <button
                        onClick={() => onRoleChange?.(member.userId, 'moderator')}
                        className="flex-1 px-3 py-1.5 text-sm bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30"
                      >
                        🛡️ Make Mod
                      </button>
                    )}
                    {member.role !== 'member' && (
                      <button
                        onClick={() => onRoleChange?.(member.userId, 'member')}
                        className="flex-1 px-3 py-1.5 text-sm bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600"
                      >
                        👤 Make Member
                      </button>
                    )}
                  </div>

                  {/* Remove Member */}
                  <button
                    onClick={() => onRemoveMember?.(member.userId)}
                    className="w-full px-3 py-1.5 text-sm bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30"
                  >
                    ❌ Remove from Group
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
