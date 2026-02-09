'use client'

import { useState } from 'react'
import { useContentReports } from '@/lib/admin'
import { updateReportStatus } from '@/lib/admin/admin-service'
import { AlertCircle, CheckCircle, XCircle, Eye } from 'lucide-react'

export default function ContentReportsTable() {
  const [statusFilter, setStatusFilter] = useState<string>('pending')
  const { reports, isLoading, refreshReports } = useContentReports({
    status: statusFilter,
    limit: 100,
  })

  const handleUpdateStatus = async (
    reportId: string,
    status: 'reviewing' | 'resolved' | 'dismissed',
    actionTaken?: string
  ) => {
    const { success } = await updateReportStatus(reportId, status, actionTaken)
    if (success) {
      refreshReports()
    }
  }

  const getStatusBadge = (status: string) => {
    const badges = {
      pending: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-400', icon: AlertCircle },
      reviewing: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400', icon: Eye },
      resolved: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400', icon: CheckCircle },
      dismissed: { bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-700 dark:text-gray-400', icon: XCircle },
    }

    const badge = badges[status as keyof typeof badges] || badges.pending
    const Icon = badge.icon

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold ${badge.bg} ${badge.text} rounded-full`}>
        <Icon className="w-3 h-3" />
        {status}
      </span>
    )
  }

  const getReasonBadge = (reason: string) => {
    const colors: Record<string, string> = {
      spam: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400',
      harassment: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
      hate_speech: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
      violence: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
      sexual_content: 'bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-400',
      misinformation: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400',
      copyright: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400',
      other: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-400',
    }

    return (
      <span className={`px-2 py-1 text-xs font-semibold ${colors[reason] || colors.other} rounded-full`}>
        {reason.replace('_', ' ')}
      </span>
    )
  }

  if (isLoading) {
    return <div className="p-8 text-center">Loading reports...</div>
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      {/* Header with Filters */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Content Reports</h2>
          <span className="px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-full text-sm font-semibold">
            {reports.filter(r => r.status === 'pending').length} Pending
          </span>
        </div>

        {/* Status Filter */}
        <div className="flex gap-2">
          {['pending', 'reviewing', 'resolved', 'dismissed'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-4 py-2 text-sm rounded-lg transition-colors ${
                statusFilter === status
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Reports Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                Content Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                Reason
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                Description
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                Reported
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {reports.map((report) => (
              <tr key={report.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="px-2 py-1 text-xs font-semibold bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full">
                    {report.contentType}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {getReasonBadge(report.reason)}
                </td>
                <td className="px-6 py-4 text-sm text-gray-900 dark:text-white max-w-xs truncate">
                  {report.description || 'No description provided'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {getStatusBadge(report.status)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                  {new Date(report.createdAt).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <div className="flex items-center gap-2">
                    {report.status === 'pending' && (
                      <>
                        <button
                          onClick={() => handleUpdateStatus(report.id, 'reviewing')}
                          className="px-3 py-1 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          Review
                        </button>
                        <button
                          onClick={() => handleUpdateStatus(report.id, 'dismissed', 'Not valid')}
                          className="px-3 py-1 bg-gray-600 text-white text-xs rounded-lg hover:bg-gray-700 transition-colors"
                        >
                          Dismiss
                        </button>
                      </>
                    )}
                    {report.status === 'reviewing' && (
                      <>
                        <button
                          onClick={() => handleUpdateStatus(report.id, 'resolved', 'Action taken')}
                          className="px-3 py-1 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700 transition-colors"
                        >
                          Resolve
                        </button>
                        <button
                          onClick={() => handleUpdateStatus(report.id, 'dismissed', 'No action needed')}
                          className="px-3 py-1 bg-gray-600 text-white text-xs rounded-lg hover:bg-gray-700 transition-colors"
                        >
                          Dismiss
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {reports.length === 0 && (
        <div className="p-8 text-center text-gray-500 dark:text-gray-400">
          No {statusFilter} reports
        </div>
      )}
    </div>
  )
}
