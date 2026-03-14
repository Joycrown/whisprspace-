'use client'

import { useState } from 'react'
import { usePayoutRequests } from '@/lib/admin/useAdmin'
import { resolvePayoutRequest } from '@/lib/admin/admin-service'
import { CheckCircle, XCircle, Clock, Banknote, User, AlertTriangle } from 'lucide-react'
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal'
import { useToastHelpers } from '@/components/ui/Toast'

export default function PayoutRequestsTable() {
  const { requests, isLoading, refreshRequests } = usePayoutRequests()
  const [resolvingId, setResolvingId] = useState<string | null>(null)
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [confirmAction, setConfirmAction] = useState<{ id: string, action: 'approve' | 'reject' } | null>(null)
  const toast = useToastHelpers()

  const handleResolveClick = (requestId: string, action: 'approve' | 'reject') => {
    setConfirmAction({ id: requestId, action })
  }

  const executeResolve = async () => {
    if (!confirmAction) return

    const { id: requestId, action } = confirmAction
    setResolvingId(requestId)
    setConfirmAction(null)

    try {
      const { success, error } = await resolvePayoutRequest(requestId, action, notes[requestId])

      if (success) {
        toast.success(`Payout request ${action}ed successfully`)
        refreshRequests()
      } else {
        toast.error(`Error processing payout: ${error}`)
      }
    } catch (e: any) {
      toast.error(e.message || 'An unexpected error occurred')
    } finally {
      setResolvingId(null)
    }
  }

  if (isLoading) {
    return <div className="p-8 text-center text-gray-500">Loading payout requests...</div>
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Withdrawal Queue</h2>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Creator</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Amount (USD)</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Destination</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {requests.map((request) => (
              <tr key={request.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-gray-400" />
                    <div>
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {request.user?.anonymous_id || 'Anonymous'}
                      </div>
                      <div className="text-xs text-gray-500">
                        {request.user?.email || 'No email provided'}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="font-semibold text-gray-900 dark:text-white">
                    ${Number(request.amount_usd).toFixed(2)}
                  </div>
                  {request.amount_local && request.currency !== 'USD' && (
                    <div className="text-xs text-green-600 dark:text-green-400 font-medium">
                      {request.currency} {Number(request.amount_local).toLocaleString()}
                    </div>
                  )}
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm text-gray-900 dark:text-white">
                    {request.bank_name}
                  </div>
                  <div className="text-xs text-gray-500">
                    Acc: {request.account_number}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    request.status === 'pending_admin' ? 'bg-yellow-100 text-yellow-800' :
                    request.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                    request.status === 'completed' ? 'bg-green-100 text-green-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {request.status.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-6 py-4">
                  {request.status === 'pending_admin' ? (
                    <div className="flex flex-col gap-3 min-w-[200px]">
                      <textarea
                        placeholder="Admin notes (optional)..."
                        className="text-sm px-3 py-2 border rounded-md bg-white text-gray-900 placeholder-gray-500 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-400 dark:border-gray-600 w-full resize-none focus:ring-2 focus:ring-purple-500 outline-none"
                        rows={2}
                        value={notes[request.id] || ''}
                        onChange={(e) => setNotes({ ...notes, [request.id]: e.target.value })}
                      />
                      <div className="flex gap-2">
                        <button
                          disabled={resolvingId === request.id}
                          onClick={() => handleResolveClick(request.id, 'approve')}
                          className="flex-1 flex items-center justify-center gap-1 text-xs px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 transition-colors"
                        >
                          <CheckCircle className="w-4 h-4" /> Approve
                        </button>
                        <button
                          disabled={resolvingId === request.id}
                          onClick={() => handleResolveClick(request.id, 'reject')}
                          className="flex-1 flex items-center justify-center gap-1 text-xs px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 transition-colors"
                        >
                          <XCircle className="w-4 h-4" /> Reject
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-gray-500 flex flex-col gap-1">
                      <span className="italic">Processed on {new Date(request.processed_at).toLocaleDateString()}</span>
                      {request.admin_notes && (
                        <span className="not-italic text-gray-700 dark:text-gray-300 border-l-2 border-purple-500 pl-2 py-0.5 max-w-[200px] whitespace-normal">
                          <span className="font-semibold block text-[10px] uppercase text-gray-400">Notes</span>
                          {request.admin_notes}
                        </span>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {requests.length === 0 && (
        <div className="p-12 text-center text-gray-500 bg-gray-50/50 dark:bg-gray-900/50 rounded-b-lg">
          <Banknote className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p>No withdrawal requests in the queue.</p>
        </div>
      )}

      {/* Confirmation Modal */}
      <Modal
        isOpen={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        title="Confirm Resolution"
        size="sm"
      >
        <ModalBody>
          <div className="flex flex-col items-center justify-center text-center space-y-4">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
              confirmAction?.action === 'approve' 
                ? 'bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-400' 
                : 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400'
            }`}>
              <AlertTriangle className="w-6 h-6" />
            </div>
            <p className="text-gray-600 dark:text-gray-300">
              Are you sure you want to <strong className={`font-semibold ${confirmAction?.action === 'approve' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{confirmAction?.action}</strong> this payout request?
              {confirmAction?.action === 'reject' && (
                <span className="block mt-2 text-sm opacity-80">
                  This will return the funds to the creator's usable balance.
                </span>
              )}
            </p>
          </div>
        </ModalBody>
        <ModalFooter className="flex w-full sm:flex-row flex-col-reverse sm:justify-end gap-2 mt-6">
          <button
            onClick={() => setConfirmAction(null)}
            className="px-4 py-2 bg-transparent border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors w-full sm:w-auto"
          >
            Cancel
          </button>
          <button
            onClick={executeResolve}
            className={`px-4 py-2 text-white rounded-lg transition-colors w-full sm:w-auto ${
              confirmAction?.action === 'approve'
                ? 'bg-green-600 hover:bg-green-700'
                : 'bg-red-600 hover:bg-red-700'
            }`}
          >
            Confirm {confirmAction?.action === 'approve' ? 'Approval' : 'Rejection'}
          </button>
        </ModalFooter>
      </Modal>
    </div>
  )
}
