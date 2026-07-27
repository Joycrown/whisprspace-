'use client'

import { useState } from 'react'
import { useIsAdmin } from '@/lib/admin'
import AnalyticsDashboard from '../analytics/AnalyticsDashboard'
import UsersTable from './UsersTable'
import ContentReportsTable from './ContentReportsTable'
import { AdminReportQueue } from '@/components/moderation/AdminReportQueue'
import ModerationActionsTable from './ModerationActionsTable'
import BanUserModal from './BanUserModal'
import UserDetailsModal from './UserDetailsModal'
import PayoutRequestsTable from './PayoutRequestsTable'
import SeedDashboard from './SeedDashboard'
import SeedAccountsDashboard from './SeedAccountsDashboard'
import { BarChart3, Users, Flag, Shield, Lock, Banknote, DatabaseZap, UserCheck } from 'lucide-react'

type TabType = 'analytics' | 'users' | 'reports' | 'moderation' | 'payouts' | 'seeding' | 'seed-accounts'

export default function AdminDashboard() {
  const { isAdmin, role, isLoading } = useIsAdmin()
  const [activeTab, setActiveTab] = useState<TabType>('analytics')
  const [banModalData, setBanModalData] = useState<{ userId: string; userName: string } | null>(null)
  const [viewUserId, setViewUserId] = useState<string | null>(null)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-8">
        <div className="text-center">
          <Lock className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Access Denied
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            You don&apos;t have permission to access the admin panel
          </p>
        </div>
      </div>
    )
  }

  const tabs = [
    { id: 'analytics' as TabType, label: 'Analytics', icon: BarChart3 },
    { id: 'users' as TabType, label: 'Users', icon: Users },
    { id: 'reports' as TabType, label: 'Reports', icon: Flag },
    { id: 'payouts' as TabType, label: 'Payouts', icon: Banknote },
    { id: 'moderation' as TabType, label: 'Moderation', icon: Shield },
    { id: 'seeding' as TabType, label: 'Seeding', icon: DatabaseZap },
    { id: 'seed-accounts' as TabType, label: 'Seed Accounts', icon: UserCheck },
  ]

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
          <div className="flex items-start sm:items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                Admin Dashboard
              </h1>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
                Role: <span className="font-semibold capitalize">{role}</span>
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="px-2.5 sm:px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded-full text-xs sm:text-sm font-semibold whitespace-nowrap">
                Admin Access
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs — horizontally scrollable on mobile so all tabs stay reachable */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-4 sm:gap-8 overflow-x-auto scrollbar-hide -mb-px">
            {tabs.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 py-3 sm:py-4 border-b-2 transition-colors whitespace-nowrap flex-shrink-0 ${
                    activeTab === tab.id
                      ? 'border-purple-600 text-purple-600 dark:text-purple-400'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  <span className="font-medium text-sm sm:text-base">{tab.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        {activeTab === 'analytics' && <AnalyticsDashboard />}
        
        {activeTab === 'users' && (
          <UsersTable
            onBanUser={(userId) => {
              setBanModalData({ userId, userName: 'User' })
            }}
            onViewUser={(userId) => {
              setViewUserId(userId)
            }}
          />
        )}
        
        {activeTab === 'reports' && (
          <div className="space-y-10">
            <AdminReportQueue />
            <div>
              <h2 className="text-lg font-semibold text-white mb-4">All Reports History</h2>
              <ContentReportsTable />
            </div>
          </div>
        )}

        {activeTab === 'payouts' && <PayoutRequestsTable />}
        
        {activeTab === 'moderation' && <ModerationActionsTable limit={100} />}

        {activeTab === 'seeding' && <SeedDashboard />}

        {activeTab === 'seed-accounts' && <SeedAccountsDashboard />}
      </div>

      {/* User Details Modal */}
      {viewUserId && (
        <UserDetailsModal
          userId={viewUserId}
          onClose={() => setViewUserId(null)}
        />
      )}

      {/* Ban User Modal */}
      {banModalData && (
        <BanUserModal
          userId={banModalData.userId}
          userName={banModalData.userName}
          onClose={() => setBanModalData(null)}
          onSuccess={() => {
            console.log('User banned successfully')
            // Refresh logic usually requires lifting state or exposing ref,
            // for now let's just use window.location.reload() for simplicity or leave it as it will update on next fetch.
            window.location.reload()
          }}
        />
      )}
    </div>
  )
}
