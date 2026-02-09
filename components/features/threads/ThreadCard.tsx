// components/thread/ThreadCard.tsx
'use client'

import Link from 'next/link'
import { Crown } from 'lucide-react'
import { formatTimestamp } from '../utils/helpers/threadHelpers'

interface ThreadCardProps {
  id: string
  author: {
    name: string
    avatar: string
  }
  title: string
  latestMessage: string
  createdAt: Date
  participants: number
  messageCount: number
  timeRemaining: string
  isPremium?: boolean
  price?: number
}

export default function ThreadCard({
  id,
  author,
  title,
  latestMessage,
  createdAt,
  participants,
  messageCount,
  timeRemaining,
  isPremium = false,
  price
}: ThreadCardProps) {
  return (
    <Link href={`/threads/${id}`} className="block">
      <div className={`rounded-lg p-3 md:p-4 mb-3 md:mb-4 hover:bg-[#2A2A2A] transition-colors ${isPremium
          ? 'bg-gradient-to-br from-purple-900/30 to-orange-900/30 border border-purple-500/30'
          : 'bg-[#1E1E1E]'
        }`}>
        <div className="flex items-start gap-2 md:gap-3">
          {author.avatar?.startsWith('/avatars/') ? (
            <img
              src={author.avatar}
              alt={author.name}
              className="w-8 h-8 md:w-10 md:h-10 rounded-full object-cover flex-shrink-0"
            />
          ) : (
            <div
              className="w-8 h-8 md:w-10 md:h-10 rounded-full flex-shrink-0"
              style={{ backgroundColor: author.avatar }}
            />
          )}
          <div className="flex-1 min-w-0">
            {/* Header Section - Stacked on Mobile */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-1 md:gap-2 mb-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-white font-medium text-sm md:text-base truncate">{author.name}</span>
                {isPremium && (
                  <div className="flex items-center gap-1 px-1.5 py-0.5 bg-gradient-to-r from-purple-600 to-orange-500 rounded-full flex-shrink-0">
                    <Crown className="w-3 h-3 text-white" />
                    <span className="text-xs text-white font-semibold">Premium</span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <span className="text-orange-500 text-xs md:text-sm whitespace-nowrap">{timeRemaining}</span>
                <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-orange-500" />
              </div>
            </div>

            <span className="text-gray-500 text-xs md:text-sm block">
              {formatTimestamp(createdAt.toISOString())}
            </span>

            {/* Title and Message */}
            <h3 className="text-white font-semibold mt-2 text-sm md:text-base line-clamp-2">{title}</h3>
            <p className="text-gray-400 mt-1 text-xs md:text-sm line-clamp-2 break-words">
              <span className="text-gray-500">Latest:</span> {latestMessage}
            </p>

            {/* Footer Section - Better Mobile Layout */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-3 md:mt-4">
              <div className="flex items-center flex-wrap gap-2 md:gap-3 text-gray-400 text-xs md:text-sm">
                <span className="whitespace-nowrap">{participants} participants</span>
                <span className="hidden sm:inline">•</span>
                <span className="whitespace-nowrap">{messageCount} messages</span>
                {isPremium && price && (
                  <>
                    <span className="hidden sm:inline">•</span>
                    <span className="text-purple-400 font-semibold whitespace-nowrap">${price.toFixed(2)}</span>
                  </>
                )}
              </div>
              <div className={`px-4 md:px-6 py-1.5 rounded-full transition text-center text-sm flex-shrink-0 ${isPremium
                  ? 'bg-gradient-to-r from-purple-600 to-orange-500 text-white hover:opacity-90'
                  : 'bg-purple-600 text-white hover:bg-purple-700'
                }`}>
                {isPremium ? 'Unlock' : 'Join'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Link>
  )
}
