'use client'

import { useState, useEffect } from 'react'
import { Play, Pause, Trash2, CheckCircle, Clock, RefreshCw, AlertTriangle, FastForward, Mail } from 'lucide-react'
import { getAccessToken } from '@/lib/utils/auth-token-cache'
import * as rawAuth from '@/lib/core/supabase/raw-auth'
import SeedDailyViewModal from './SeedDailyViewModal'
import { Modal, ModalBody, ModalFooter } from '@/components/ui/Modal'
import { useToastHelpers } from '@/components/ui/Toast'

export default function SeedDashboard() {
  const [status, setStatus] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isActionLoading, setIsActionLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [viewDate, setViewDate] = useState<string | null>(null)
  const [confirmAction, setConfirmAction] = useState<{ action: string, data?: any } | null>(null)
  const [configEdits, setConfigEdits] = useState<Record<string, number>>({})
  const [isSavingConfig, setIsSavingConfig] = useState(false)
  const [isBackfillLoading, setIsBackfillLoading] = useState(false)
  const [backfillResult, setBackfillResult] = useState<{ total: number; messaged: number; emailed: number; skipped: number; errors?: string[] } | null>(null)
  const toast = useToastHelpers()

  const fetchStatus = async () => {
    try {
      setIsLoading(true)
      const token = getAccessToken() || rawAuth.getSession()?.access_token
      
      const res = await fetch('/api/admin/seed', {
        headers: {
          'Authorization': `Bearer ${token || ''}`
        }
      })
      const data = await res.json()
      if (data.success) {
        setStatus(data.data)
        setError(null)
      } else {
        setError(data.error || 'Failed to fetch status')
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchStatus()
  }, [])

  const runAction = async (action: string, extraData: any = {}) => {
    try {
      setIsActionLoading(true)
      const token = getAccessToken() || rawAuth.getSession()?.access_token

      const res = await fetch('/api/admin/seed', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token || ''}`
        },
        body: JSON.stringify({ action, ...extraData })
      })
      const data = await res.json()
      if (!data.success) {
        throw new Error(data.error || 'Action failed')
      }
      toast.success('Action successful', `Completed: ${action}`)
      await fetchStatus()
    } catch (err: any) {
      toast.error('Action failed', err.message)
    } finally {
      setIsActionLoading(false)
      setConfirmAction(null)
    }
  }

  const handleActionClick = (action: string, extraData: any = {}) => {
    setConfirmAction({ action, data: extraData })
  }

  const runBackfillWelcome = async () => {
    try {
      setIsBackfillLoading(true)
      setBackfillResult(null)
      const token = getAccessToken() || rawAuth.getSession()?.access_token
      const res = await fetch('/api/admin/backfill-welcome', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token || ''}` },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Backfill failed')
      setBackfillResult(data)
      toast.success('Backfill complete', `${data.messaged} messaged, ${data.emailed} emailed, ${data.skipped} skipped`)
    } catch (err: any) {
      toast.error('Backfill failed', err.message)
    } finally {
      setIsBackfillLoading(false)
    }
  }

  const saveConfig = async () => {
    if (Object.keys(configEdits).length === 0) return
    try {
      setIsSavingConfig(true)
      const token = getAccessToken() || rawAuth.getSession()?.access_token
      const res = await fetch('/api/admin/seed', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token || ''}` },
        body: JSON.stringify({ config: configEdits })
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || 'Failed to save config')
      toast.success('Config saved', 'Seed configuration updated.')
      setConfigEdits({})
      await fetchStatus()
    } catch (err: any) {
      toast.error('Save failed', err.message)
    } finally {
      setIsSavingConfig(false)
    }
  }

  if (isLoading && !status) {
    return (
      <div className="flex justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 bg-red-100 text-red-700 rounded-xl">
        <h3 className="font-bold">Error loading seeding status</h3>
        <p>{error}</p>
      </div>
    )
  }

  if (!status) return null

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-gray-500 dark:text-gray-400 font-medium">System Status</h3>
            <div className={`px-3 py-1 rounded-full text-sm font-semibold flex items-center gap-1 ${status.config?.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              <div className={`w-2 h-2 rounded-full ${status.config?.is_active ? 'bg-green-500' : 'bg-red-500'}`}></div>
              {status.config?.is_active ? 'Active' : 'Paused'}
            </div>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Cron limit: 1 run per day on Vercel Hobby plan.
          </p>
          <div className="flex gap-2">
            {status.config?.is_active ? (
              <button 
                onClick={() => runAction('pause')}
                className="flex items-center gap-2 bg-yellow-100 hover:bg-yellow-200 text-yellow-800 px-4 py-2 rounded-lg font-medium text-sm transition"
              >
                <Pause className="w-4 h-4" /> Pause System
              </button>
            ) : (
              <button 
                onClick={() => runAction('resume')}
                className="flex items-center gap-2 bg-green-100 hover:bg-green-200 text-green-800 px-4 py-2 rounded-lg font-medium text-sm transition"
              >
                <Play className="w-4 h-4" /> Start System
              </button>
            )}
            <button 
              onClick={fetchStatus}
              className="p-2 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              title="Refresh Stats"
            >
              <RefreshCw className="w-4 h-4 text-gray-600 dark:text-gray-300" />
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <h3 className="text-gray-500 dark:text-gray-400 font-medium mb-4">Content Metrics</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{status.stats?.seedUsers}</p>
              <p className="text-sm text-gray-500">Seed Users</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{status.playbook?.availableThreads}</p>
              <p className="text-sm text-gray-500">Playbook Items</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{status.stats?.seedThreads}</p>
              <p className="text-sm text-gray-500">Live Discussions</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{status.stats?.seedMessages}</p>
              <p className="text-sm text-gray-500">Live Replies</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <h3 className="text-gray-500 dark:text-gray-400 font-medium mb-4">Quick Actions</h3>
          <div className="flex flex-col gap-2">
            <button 
              onClick={() => handleActionClick('initialize')}
              disabled={isActionLoading || status.stats?.seedUsers > 0}
              className="flex items-center justify-between bg-blue-50 hover:bg-blue-100 text-blue-700 px-4 py-2 rounded-lg font-medium text-sm transition disabled:opacity-50"
            >
              <span>1. Initialize Database</span>
              <CheckCircle className="w-4 h-4" />
            </button>
            <button 
              onClick={() => handleActionClick('prepare-daily')}
              disabled={isActionLoading || status.stats?.seedUsers === 0}
              className="flex items-center justify-between border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-white px-4 py-2 rounded-lg font-medium text-sm transition disabled:opacity-50"
            >
              <span>2. Generate Schedule</span>
              <span className="text-xs bg-gray-200 dark:bg-gray-600 px-2 py-0.5 rounded">Manual</span>
            </button>
            <button 
              onClick={() => handleActionClick('cleanup')}
              disabled={isActionLoading}
              className="flex items-center justify-between border border-red-200 hover:bg-red-50 text-red-600 px-4 py-2 rounded-lg font-medium text-sm transition"
            >
              <span>Reset & Cleanup</span>
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Welcome Messages Backfill */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
              <Mail className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">Welcome Messages</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                Send the welcome inbox message (and email where available) to all existing users who haven&apos;t received one yet. Safe to re-run — already-messaged users are skipped automatically.
              </p>
              {backfillResult && (
                <div className="mt-3 flex flex-wrap gap-3 text-sm">
                  <span className="px-2.5 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full">
                    {backfillResult.total} total users
                  </span>
                  <span className="px-2.5 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded-full">
                    {backfillResult.messaged} messaged
                  </span>
                  <span className="px-2.5 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full">
                    {backfillResult.emailed} emailed
                  </span>
                  <span className="px-2.5 py-1 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-full">
                    {backfillResult.skipped} skipped
                  </span>
                  {backfillResult.errors?.length ? (
                    <span className="px-2.5 py-1 bg-red-100 text-red-700 rounded-full">
                      {backfillResult.errors.length} errors
                    </span>
                  ) : null}
                </div>
              )}
            </div>
          </div>
          <button
            onClick={runBackfillWelcome}
            disabled={isBackfillLoading}
            className="flex-shrink-0 flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-medium text-sm transition w-full sm:w-auto"
          >
            {isBackfillLoading
              ? <><RefreshCw className="w-4 h-4 animate-spin" /> Running...</>
              : <><Mail className="w-4 h-4" /> Send to All</>
            }
          </button>
        </div>
      </div>

      {/* Schedule Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex flex-wrap justify-between items-center gap-2 bg-gray-50 dark:bg-gray-800/50">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-gray-500" />
            <h3 className="font-semibold text-gray-900 dark:text-white">Schedule Overview</h3>
          </div>
          <button 
              onClick={() => handleActionClick('process-queue')}
              disabled={isActionLoading}
              title="Force trigger page-load processor"
              className="flex items-center gap-2 bg-purple-100 hover:bg-purple-200 text-purple-700 px-3 py-1.5 rounded-lg text-sm font-medium transition"
            >
              <FastForward className="w-4 h-4" /> Process Queue
          </button>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
              <tr>
                <th className="px-6 py-3">Day</th>
                <th className="px-6 py-3 text-center">Total</th>
                <th className="px-6 py-3 text-center">Pending</th>
                <th className="px-6 py-3 text-center">Approved</th>
                <th className="px-6 py-3 text-center">Executed</th>
                <th className="px-6 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700 text-sm">
              {[
                { label: 'Today', data: status.schedule?.today },
                { label: 'Tomorrow', data: status.schedule?.tomorrow }
              ].map((row, idx) => (
                <tr key={idx} className="bg-white dark:bg-gray-800">
                  <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                    {row.label}
                    <span className="block text-xs text-gray-500 font-normal">{row.data?.date}</span>
                  </td>
                  <td className="px-6 py-4 text-center font-bold">{row.data?.total || 0}</td>
                  <td className="px-6 py-4 text-center">
                    <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-medium">
                      {row.data?.pending || 0}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                      {row.data?.approved || 0}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                      {row.data?.executed || 0}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right space-x-3">
                    {row.data?.total > 0 && row.data?.pending > 0 && (
                      <button
                        onClick={() => setViewDate(row.data?.date)}
                        className="text-blue-600 hover:text-blue-800 font-medium text-sm"
                      >
                        Review
                      </button>
                    )}
                    {(row.data?.pending > 0 || row.data?.total === 0) && (
                      <button
                        onClick={() => row.data?.total === 0
                          ? handleActionClick('prepare-daily', { date: row.data?.date })
                          : handleActionClick('approve-day', { date: row.data?.date })
                        }
                        disabled={isActionLoading}
                        className="text-purple-600 hover:text-purple-800 font-medium text-sm"
                      >
                        {row.data?.total === 0 ? 'Generate' : 'Approve'}
                      </button>
                    )}
                    {row.data?.approved > 0 && (
                      <button
                        onClick={() => handleActionClick('reschedule-now', { date: row.data?.date })}
                        disabled={isActionLoading}
                        className="text-green-600 hover:text-green-800 font-medium text-sm"
                      >
                        Push Now
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Config Settings */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex flex-wrap justify-between items-center gap-2">
          <h3 className="font-semibold text-gray-900 dark:text-white">Seed Config</h3>
          {Object.keys(configEdits).length > 0 && (
            <button
              onClick={saveConfig}
              disabled={isSavingConfig}
              className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition disabled:opacity-50"
            >
              {isSavingConfig && <RefreshCw className="w-3 h-3 animate-spin" />}
              Save Changes
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-px bg-gray-200 dark:bg-gray-700">
          {[
            { key: 'threads_per_day', label: 'Discussions / Day' },
            { key: 'thread_spacing_minutes', label: 'Discussion Spacing (min)' },
            { key: 'first_thread_hour', label: 'First Discussion Hour (24h)' },
            { key: 'max_participants_per_thread', label: 'Max Participants' },
            { key: 'messages_per_user', label: 'Messages / User' },
            { key: 'reply_interval_minutes', label: 'Reply Interval (min)' },
          ].map(({ key, label }) => {
            const current = status.config?.[key] ?? ''
            const edited = configEdits[key]
            const value = edited !== undefined ? edited : current
            const isDirty = edited !== undefined && edited !== current
            return (
              <div key={key} className="bg-white dark:bg-gray-800 px-5 py-4">
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</label>
                <input
                  type="number"
                  value={value}
                  onChange={e => setConfigEdits(prev => ({ ...prev, [key]: Number(e.target.value) }))}
                  className={`w-full text-lg font-semibold bg-transparent border-b-2 outline-none pb-0.5 transition-colors dark:text-white ${
                    isDirty
                      ? 'border-purple-500 text-purple-700 dark:text-purple-400'
                      : 'border-transparent text-gray-900'
                  } focus:border-purple-400`}
                />
              </div>
            )
          })}
        </div>
      </div>

      {/* Playbook Status */}
      {status.playbook?.availableThreads <= 5 && (
        <div className="flex items-center gap-3 p-4 bg-orange-50 border border-orange-200 rounded-xl text-orange-800">
          <AlertTriangle className="w-6 h-6 shrink-0" />
          <div>
            <h4 className="font-semibold">Low Playbook Content</h4>
            <p className="text-sm opacity-90">Only {status.playbook?.availableThreads} unused threads remaining. The orchestrator will recycle used threads when empty. Add more content via DB.</p>
          </div>
        </div>
      )}

      {/* Review Modal */}
      {viewDate && (
        <SeedDailyViewModal 
          date={viewDate}
          onClose={() => setViewDate(null)}
          onApproved={fetchStatus}
        />
      )}

      {/* Confirmation Modal */}
      <Modal
        isOpen={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        title="Confirm Seeding Action"
        size="sm"
      >
        <ModalBody>
          <div className="flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <p className="text-gray-900 dark:text-white font-medium">Are you sure?</p>
              <p className="text-gray-500 text-sm mt-1">
                You are about to run: <strong className="text-purple-600">{confirmAction?.action.replace(/-/g, ' ')}</strong>
              </p>
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <button
            onClick={() => setConfirmAction(null)}
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => runAction(confirmAction!.action, confirmAction!.data)}
            disabled={isActionLoading}
            className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {isActionLoading && <RefreshCw className="w-4 h-4 animate-spin" />}
            Confirm
          </button>
        </ModalFooter>
      </Modal>
    </div>
  )
}
