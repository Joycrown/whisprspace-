'use client'

import { ReactNode } from 'react'

interface StatsCardProps {
  title: string
  value: string | number
  icon: ReactNode
  change?: {
    value: number
    isPositive: boolean
  }
  color?: string
}

export default function StatsCard({
  title,
  value,
  icon,
  change,
  color = 'purple',
}: StatsCardProps) {
  const colorClasses = {
    purple: 'from-purple-500 to-purple-600',
    blue: 'from-blue-500 to-blue-600',
    green: 'from-green-500 to-green-600',
    orange: 'from-orange-500 to-orange-600',
    red: 'from-red-500 to-red-600',
    pink: 'from-pink-500 to-pink-600',
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</h3>
        <div
          className={`p-2 rounded-lg bg-gradient-to-br ${colorClasses[color as keyof typeof colorClasses] || colorClasses.purple}`}
        >
          <div className="text-white">{icon}</div>
        </div>
      </div>

      <div className="flex items-end justify-between">
        <p className="text-3xl font-bold text-gray-900 dark:text-white">
          {typeof value === 'number' ? value.toLocaleString() : value}
        </p>

        {change && (
          <span
            className={`text-sm font-medium ${
              change.isPositive ? 'text-green-600' : 'text-red-600'
            }`}
          >
            {change.isPositive ? '+' : ''}
            {change.value}%
          </span>
        )}
      </div>
    </div>
  )
}
