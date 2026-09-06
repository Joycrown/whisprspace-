import { useState, useEffect } from 'react'
import { X, Save, Clock, MessageSquare, AlertCircle, RefreshCw, Trash2 } from 'lucide-react'
import { getAccessToken } from '@/lib/utils/auth-token-cache'
import * as rawAuth from '@/lib/core/supabase/raw-auth'
import { useToastHelpers } from '@/components/ui/Toast'

interface SeedDailyViewModalProps {
  date: string
  onClose: () => void
  onApproved: () => void
}

export default function SeedDailyViewModal({ date, onClose, onApproved }: SeedDailyViewModalProps) {
  const [items, setItems] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Editor state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [isSavingItem, setIsSavingItem] = useState(false)
  const [isApprovingAll, setIsApprovingAll] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [confirmRemoveItem, setConfirmRemoveItem] = useState<any | null>(null)
  const toast = useToastHelpers()

  const fetchItems = async () => {
    try {
      setIsLoading(true)
      const token = getAccessToken() || rawAuth.getSession()?.access_token
      
      const res = await fetch(`/api/admin/seed?date=${date}`, {
        headers: { 'Authorization': `Bearer ${token || ''}` }
      })
      const data = await res.json()
      if (data.success) {
        setItems(data.data)
      } else {
        setError(data.error)
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchItems()
  }, [date])

  const handleEdit = (item: any) => {
    setEditingId(item.id)
    if (item.action === 'create_thread') {
      setEditContent(item.thread?.content || '')
    } else {
      setEditContent(item.reply?.content || '')
    }
  }

  const handleSaveEdit = async (item: any) => {
    try {
      setIsSavingItem(true)
      const token = getAccessToken() || rawAuth.getSession()?.access_token
      const playbookId = item.action === 'create_thread' ? item.playbook_thread_id : item.playbook_reply_id
      const type = item.action === 'create_thread' ? 'text' : 'reply'

      const res = await fetch('/api/admin/seed/playbook', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token || ''}`
        },
        body: JSON.stringify({ id: playbookId, type, content: editContent })
      })

      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      
      toast.success('Content updated', 'Playbook text has been modified.')
      setEditingId(null)
      await fetchItems() // Reload text
    } catch (err: any) {
      toast.error('Update failed', err.message)
    } finally {
      setIsSavingItem(false)
    }
  }

  const handleApproveAll = async () => {
    try {
      setIsApprovingAll(true)
      const token = getAccessToken() || rawAuth.getSession()?.access_token
      const res = await fetch('/api/admin/seed', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token || ''}`
        },
        body: JSON.stringify({ action: 'approve-day', date })
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      toast.success('Approved', `Content scheduled for ${date} is now active.`)
      onApproved()
      onClose()
    } catch (err: any) {
      toast.error('Approval failed', err.message)
    } finally {
      setIsApprovingAll(false)
    }
  }

  const handleRemoveAndReplace = async (item: any) => {
    try {
      setRemovingId(item.id)
      const token = getAccessToken() || rawAuth.getSession()?.access_token
      const res = await fetch('/api/admin/seed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token || ''}` },
        body: JSON.stringify({
          action: 'remove-and-replace',
          playbookThreadId: item.playbook_thread_id,
          batchDate: item.batch_date,
        }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      const { replaced } = data.data
      toast.success(
        'Content removed',
        replaced ? 'Replaced with a new discussion from the playbook.' : 'Removed. No replacement available — playbook may be exhausted.'
      )
      setConfirmRemoveItem(null)
      await fetchItems()
    } catch (err: any) {
      toast.error('Remove failed', err.message)
    } finally {
      setRemovingId(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col flex-shrink-0 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between gap-2 px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="min-w-0">
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white truncate">Review Schedule: {date}</h2>
            <p className="text-sm text-gray-500">Review and edit the discussions and replies before approving.</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-gray-50 dark:bg-gray-900">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <RefreshCw className="w-8 h-8 text-purple-500 animate-spin mb-4" />
              <p className="text-gray-500">Loading schedule...</p>
            </div>
          ) : error ? (
            <div className="bg-red-50 text-red-600 p-4 rounded-lg flex items-center gap-3">
              <AlertCircle className="w-5 h-5" />
              <p>{error}</p>
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              No items scheduled for this day yet.
            </div>
          ) : (
            <div className="space-y-4 relative">
              {items.map((item, idx) => (
                <div
                  key={item.id}
                  className={`bg-white dark:bg-gray-800 border ${item.action === 'create_thread' ? 'border-purple-200 dark:border-purple-800 shadow-md' : 'border-gray-200 dark:border-gray-700 opacity-90 ml-4 sm:ml-8'} rounded-lg p-4 sm:p-5`}
                >
                  <div className="flex flex-wrap justify-between items-start gap-2 mb-3">
                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                       {item.action === 'create_thread' ? (
                         <div className="bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 px-2 py-1 rounded text-xs font-bold uppercase tracking-wide">
                            Thread
                         </div>
                       ) : (
                         <div className="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-1 rounded text-xs font-bold uppercase tracking-wide flex items-center gap-1">
                            <MessageSquare className="w-3 h-3" /> Reply
                         </div>
                       )}
                       <span className="font-semibold text-gray-900 dark:text-white">
                         @{item.user?.username || 'Unknown'}
                       </span>
                       <span className="text-xs text-gray-500">
                         Persona: {item.action === 'create_thread' ? item.thread?.creator_persona : item.reply?.persona_tag}
                       </span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-full">
                      <Clock className="w-3 h-3" />
                      {new Date(item.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>

                  {/* Editor or Viewer */}
                  {editingId === item.id ? (
                    <div className="mt-2 space-y-3">
                      <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="w-full h-32 p-3 text-sm bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 font-sans"
                      />
                      <div className="flex gap-2 justify-end">
                        <button 
                          onClick={() => setEditingId(null)}
                          className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
                        >
                          Cancel
                        </button>
                        <button 
                          onClick={() => handleSaveEdit(item)}
                          disabled={isSavingItem}
                          className="px-3 py-1.5 text-sm bg-purple-600 hover:bg-purple-700 text-white rounded-lg flex items-center gap-2 disabled:opacity-50"
                        >
                          {isSavingItem && <RefreshCw className="w-3 h-3 animate-spin"/>}
                          Save Content
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      {item.action === 'create_thread' && item.thread?.title && (
                        <h4 className="font-bold text-gray-800 dark:text-gray-200 mb-2">{item.thread.title}</h4>
                      )}
                      <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                        {item.action === 'create_thread' ? item.thread?.content : item.reply?.content}
                      </p>
                      
                      {item.status === 'pending' && (
                        <div className="mt-4 flex justify-end gap-4">
                          <button
                            onClick={() => setConfirmRemoveItem(item)}
                            disabled={removingId === item.id}
                            className="flex items-center gap-1.5 text-sm font-medium text-red-500 hover:text-red-700 disabled:opacity-40"
                          >
                            {removingId === item.id
                              ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              : <Trash2 className="w-3.5 h-3.5" />
                            }
                            Remove & Replace
                          </button>
                          <button
                            onClick={() => handleEdit(item)}
                            className="text-sm font-medium text-blue-600 hover:text-blue-800"
                          >
                            Edit
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3 bg-white dark:bg-gray-800">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium transition-colors"
          >
            Close
          </button>
          <button
            onClick={handleApproveAll}
            disabled={isApprovingAll || isSavingItem || items.length === 0 || !items.some(i => i.status === 'pending')}
            className="bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white px-6 py-2 rounded-lg text-sm font-medium flex items-center gap-2 shadow-sm transition-colors"
          >
            {isApprovingAll ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Approve All
          </button>
        </div>
      </div>

      {/* Remove & Replace confirmation */}
      {confirmRemoveItem && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">Remove this content?</p>
                <p className="text-sm text-gray-500 mt-0.5">
                  This will remove the thread and all its replies from the schedule. The content will be <span className="font-medium text-red-500">permanently blacklisted</span> and never scheduled again. A replacement will be pulled from the playbook.
                </p>
              </div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 text-sm text-gray-700 dark:text-gray-300 line-clamp-3">
              {confirmRemoveItem.action === 'create_thread'
                ? confirmRemoveItem.thread?.title || confirmRemoveItem.thread?.content
                : confirmRemoveItem.reply?.content}
            </div>
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setConfirmRemoveItem(null)}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleRemoveAndReplace(confirmRemoveItem)}
                disabled={!!removingId}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
              >
                {removingId ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Remove & Replace
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
