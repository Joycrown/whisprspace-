'use client'

/**
 * Creator Earnings Dashboard Component
 * Shows earnings, statistics, and transaction history
 */

import { useCreatorEarnings } from '@/lib/stripe/usePremiumThread'
import { useUserStore } from '@/store/userStore'

export function CreatorEarnings() {
  const { session } = useUserStore()
  const { earnings, summary, isLoading, refresh } = useCreatorEarnings(session.user?.id || null)

  if (!session.user) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">Please sign in to view earnings</p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total Earnings */}
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl p-6 border border-green-200 dark:border-green-800">
          <div className="text-sm text-green-600 dark:text-green-400 font-medium mb-2">
            Total Earnings (70%)
          </div>
          <div className="text-3xl font-bold text-green-700 dark:text-green-300">
            ${summary.netEarnings.toFixed(2)}
          </div>
          <div className="text-xs text-green-600/60 dark:text-green-400/60 mt-2">
            Before platform fee: ${summary.totalEarnings.toFixed(2)}
          </div>
        </div>

        {/* Pending */}
        <div className="bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20 rounded-xl p-6 border border-yellow-200 dark:border-yellow-800">
          <div className="text-sm text-yellow-600 dark:text-yellow-400 font-medium mb-2">
            Pending Payout
          </div>
          <div className="text-3xl font-bold text-yellow-700 dark:text-yellow-300">
            ${summary.pendingEarnings.toFixed(2)}
          </div>
          <div className="text-xs text-yellow-600/60 dark:text-yellow-400/60 mt-2">
            Will be paid out soon
          </div>
        </div>

        {/* Paid Out */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl p-6 border border-blue-200 dark:border-blue-800">
          <div className="text-sm text-blue-600 dark:text-blue-400 font-medium mb-2">
            Paid Out
          </div>
          <div className="text-3xl font-bold text-blue-700 dark:text-blue-300">
            ${summary.paidEarnings.toFixed(2)}
          </div>
          <div className="text-xs text-blue-600/60 dark:text-blue-400/60 mt-2">
            {summary.transactionCount} transactions
          </div>
        </div>
      </div>

      {/* Transaction History */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Transaction History</h3>
          <button
            onClick={refresh}
            className="text-sm text-purple-600 dark:text-purple-400 hover:underline"
          >
            Refresh
          </button>
        </div>

        {earnings.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <div className="text-4xl mb-4">💰</div>
            <p className="text-gray-500 mb-2">No earnings yet</p>
            <p className="text-sm text-gray-400">
              Create premium threads to start earning!
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {earnings.map((earning: any) => (
              <div
                key={earning.id}
                className="px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <div className="font-medium">Thread Sale</div>
                      <span
                        className={`text-xs px-2 py-1 rounded-full ${
                          earning.status === 'paid'
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                            : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                        }`}
                      >
                        {earning.status}
                      </span>
                    </div>
                    <div className="text-sm text-gray-500 mt-1">
                      {new Date(earning.created_at).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="font-semibold text-green-600 dark:text-green-400">
                      +${parseFloat(earning.net_amount).toFixed(2)}
                    </div>
                    <div className="text-xs text-gray-500">
                      (${parseFloat(earning.amount).toFixed(2)} - 30% fee)
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info Banner */}
      <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-xl p-6">
        <div className="flex gap-4">
          <div className="text-3xl">💡</div>
          <div>
            <h4 className="font-semibold text-purple-900 dark:text-purple-100 mb-2">
              Revenue Sharing
            </h4>
            <p className="text-sm text-purple-700 dark:text-purple-300">
              You earn <strong>70%</strong> of every premium thread sale. The platform takes a 30% fee to cover transaction costs and maintain the service.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
