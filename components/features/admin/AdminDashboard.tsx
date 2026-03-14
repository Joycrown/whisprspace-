'use client'

import { useState } from 'react'
import { useIsAdmin } from '@/lib/admin'
import AnalyticsDashboard from '../analytics/AnalyticsDashboard'
import UsersTable from './UsersTable'
import ContentReportsTable from './ContentReportsTable'
import ModerationActionsTable from './ModerationActionsTable'
import BanUserModal from './BanUserModal'
import UserDetailsModal from './UserDetailsModal'
import PayoutRequestsTable from './PayoutRequestsTable'
import { BarChart3, Users, Flag, Shield, Lock, Banknote } from 'lucide-react'

type TabType = 'analytics' | 'users' | 'reports' | 'moderation' | 'payouts'

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
            You don't have permission to access the admin panel
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
  ]

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Admin Dashboard
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Role: <span className="font-semibold capitalize">{role}</span>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded-full text-sm font-semibold">
                Admin Access
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            {tabs.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 py-4 border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-purple-600 text-purple-600 dark:text-purple-400'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{tab.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
        
        {activeTab === 'reports' && <ContentReportsTable />}

        {activeTab === 'payouts' && <PayoutRequestsTable />}
        
        {activeTab === 'moderation' && <ModerationActionsTable limit={100} />}
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
