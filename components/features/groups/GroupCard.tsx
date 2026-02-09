'use client'

import { GroupData } from '@/lib/groups'
import { useRouter } from 'next/navigation'

interface GroupCardProps {
  group: GroupData
}

export default function GroupCard({ group }: GroupCardProps) {
  const router = useRouter()

  const getPrivacyIcon = () => {
    switch (group.privacy) {
      case 'public':
        return '🌍'
      case 'private':
        return '🔒'
      case 'invite_only':
        return '🎫'
      default:
        return '🌍'
    }
  }

  const getPrivacyLabel = () => {
    switch (group.privacy) {
      case 'public':
        return 'Public'
      case 'private':
        return 'Private'
      case 'invite_only':
        return 'Invite Only'
      default:
        return 'Public'
    }
  }

  const memberCountText = () => {
    const current = group.currentMembers || 0
    const max = group.maxMembers || 100
    return `${current} / ${max} members`
  }

  return (
    <div
      onClick={() => router.push(`/groups/${group.id}`)}
      className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-md hover:shadow-lg transition-shadow cursor-pointer border border-gray-200 dark:border-gray-700"
    >
      {/* Group Header */}
      <div className="flex items-start gap-3 mb-3">
        {/* Avatar */}
        <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-blue-500 rounded-lg flex items-center justify-center text-white text-2xl font-bold flex-shrink-0">
          {group.avatar ? (
            <img
              src={group.avatar}
              alt={group.name}
              className="w-full h-full object-cover rounded-lg"
            />
          ) : (
            group.name.charAt(0).toUpperCase()
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white truncate">
            {group.name}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
            {group.description || 'No description'}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 text-sm">
        {/* Privacy Badge */}
        <div className="flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded-full">
          <span>{getPrivacyIcon()}</span>
          <span className="text-gray-700 dark:text-gray-300">{getPrivacyLabel()}</span>
        </div>

        {/* Member Count */}
        <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
          </svg>
          <span className="text-xs">{memberCountText()}</span>
        </div>
      </div>
    </div>
  )
}
