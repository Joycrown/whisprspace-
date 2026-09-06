'use client'

import { usePlatformStats, useDailyMetrics } from '@/lib/analytics'
import StatsCard from './StatsCard'
import { Users, MessageSquare, FileText, TrendingUp, Eye, Activity } from 'lucide-react'

export default function AnalyticsDashboard() {
  const { stats, isLoading: statsLoading } = usePlatformStats()
  const { metrics, isLoading: metricsLoading } = useDailyMetrics(30)

  if (statsLoading || metricsLoading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
          <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
      </div>
    )
  }

  // Calculate growth rates
  const today = metrics[0]
  const yesterday = metrics[1]
  const lastWeek = metrics[7]

  const calculateGrowth = (current?: number, previous?: number) => {
    if (!current || !previous || previous === 0) return null
    const growth = ((current - previous) / previous) * 100
    return {
      value: Math.abs(Math.round(growth)),
      isPositive: growth > 0,
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Analytics Dashboard
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Track platform performance and user engagement
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <StatsCard
          title="Total Users"
          value={stats?.totalUsers || 0}
          icon={<Users className="w-6 h-6" />}
          color="purple"
          change={calculateGrowth(today?.totalUsers, yesterday?.totalUsers) || undefined}
        />

        <StatsCard
          title="Active Today"
          value={stats?.activeToday || 0}
          icon={<Activity className="w-6 h-6" />}
          color="green"
          change={calculateGrowth(today?.activeUsers, yesterday?.activeUsers) || undefined}
        />

        <StatsCard
          title="Total Discussions"
          value={stats?.totalThreads || 0}
          icon={<FileText className="w-6 h-6" />}
          color="blue"
          change={calculateGrowth(today?.totalThreads, lastWeek?.totalThreads) || undefined}
        />

        <StatsCard
          title="Total Messages"
          value={stats?.totalMessages || 0}
          icon={<MessageSquare className="w-6 h-6" />}
          color="orange"
          change={calculateGrowth(today?.totalMessages, lastWeek?.totalMessages) || undefined}
        />

        <StatsCard
          title="Groups Created"
          value={stats?.totalGroups || 0}
          icon={<Users className="w-6 h-6" />}
          color="pink"
        />

        <StatsCard
          title="Page Views Today"
          value={stats?.totalPageViewsToday || 0}
          icon={<Eye className="w-6 h-6" />}
          color="red"
          change={calculateGrowth(today?.totalPageViews, yesterday?.totalPageViews) || undefined}
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User Growth Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            User Growth (30 Days)
          </h3>
          <div className="space-y-2">
            {metrics.slice(0, 7).map((metric) => (
              <div key={metric.metricDate} className="flex items-center gap-3">
                <span className="text-sm text-gray-600 dark:text-gray-400 w-14 flex-shrink-0">
                  {new Date(metric.metricDate).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
                {/* Bar track fills remaining width; bar clamps to 100% so it can
                    never overflow the card on mobile. */}
                <div className="flex-1 min-w-0 h-2 bg-gray-100 dark:bg-gray-700 rounded overflow-hidden">
                  <div
                    className="h-full bg-purple-600 rounded"
                    style={{ width: `${Math.min((metric.newUsers / 10) * 100, 100)}%` }}
                  />
                </div>
                <span className="text-sm font-medium text-gray-900 dark:text-white w-12 text-right flex-shrink-0">
                  +{metric.newUsers}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Engagement Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Daily Engagement
          </h3>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600 dark:text-gray-400">Discussions</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {today?.totalThreads || 0}
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full"
                  style={{ width: `${Math.min((today?.totalThreads || 0) / 5, 100)}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600 dark:text-gray-400">Messages</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {today?.totalMessages || 0}
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-orange-600 h-2 rounded-full"
                  style={{ width: `${Math.min((today?.totalMessages || 0) / 50, 100)}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600 dark:text-gray-400">Page Views</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {today?.totalPageViews || 0}
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-green-600 h-2 rounded-full"
                  style={{ width: `${Math.min((today?.totalPageViews || 0) / 100, 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Metrics Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Daily Metrics (Last 7 Days)
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  New Users
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Active
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Threads
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Messages
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Page Views
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {metrics.slice(0, 7).map((metric) => (
                <tr key={metric.metricDate}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {new Date(metric.metricDate).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {metric.newUsers}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {metric.activeUsers}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {metric.totalThreads}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {metric.totalMessages}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {metric.totalPageViews}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
