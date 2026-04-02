'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/core/supabase/client'
import { AlertTriangle, CheckCircle, Trash2, RefreshCw, Eye } from 'lucide-react'

interface Report {
  id: string
  content_type: 'thread' | 'message'
  content_id: string
  reason: string
  additional_context: string | null
  created_at: string
  status: string
}

interface ContentItem {
  id: string
  content: string
  title?: string
  moderation_status: string
  report_count: number
}

interface QueueItem {
  report: Report
  content: ContentItem | null
}

const REASON_LABELS: Record<string, string> = {
  harassment:      'Harassment',
  hate_speech:     'Hate speech',
  self_harm:       'Self-harm',
  sexual_content:  'Explicit content',
  violence:        'Violence / threats',
  spam:            'Spam',
  misinformation:  'Misinformation',
  other:           'Other',
}

export function AdminReportQueue() {
  const [items, setItems]         = useState<QueueItem[]>([])
  const [loading, setLoading]     = useState(true)
  const [processing, setProcessing] = useState<string | null>(null)
  const [error, setError]         = useState<string | null>(null)

  const loadQueue = useCallback(async () => {
    setLoading(true)
    setError(null)

    // Fetch all pending reports
    const { data: reports, error: rErr } = await supabase
      .from('content_reports')
      .select('id, content_type, content_id, reason, additional_context, created_at, status')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(100)

    if (rErr) {
      setError('Failed to load reports.')
      setLoading(false)
      return
    }

    if (!reports || reports.length === 0) {
      setItems([])
      setLoading(false)
      return
    }

    // Fetch content previews — threads and messages separately
    const threadIds  = reports.filter(r => r.content_type === 'thread').map(r => r.content_id)
    const messageIds = reports.filter(r => r.content_type === 'message').map(r => r.content_id)

    const [threadResult, messageResult] = await Promise.all([
      threadIds.length
        ? supabase
            .from('threads')
            .select('id, title, content, moderation_status, report_count')
            .in('id', threadIds)
        : Promise.resolve({ data: [] as any[], error: null }),
      messageIds.length
        ? supabase
            .from('messages')
            .select('id, content, moderation_status, report_count')
            .in('id', messageIds)
        : Promise.resolve({ data: [] as any[], error: null }),
    ])

    const contentMap = new Map<string, ContentItem>()
    for (const t of threadResult.data ?? []) {
      contentMap.set(t.id, {
        id: t.id,
        content: t.content,
        title: t.title,
        moderation_status: t.moderation_status,
        report_count: t.report_count,
      })
    }
    for (const m of messageResult.data ?? []) {
      contentMap.set(m.id, {
        id: m.id,
        content: m.content,
        moderation_status: m.moderation_status,
        report_count: m.report_count,
      })
    }

    // Deduplicate — one queue entry per unique content_id (show highest-priority report)
    const seen = new Set<string>()
    const queue: QueueItem[] = []
    for (const report of reports) {
      if (seen.has(report.content_id)) continue
      seen.add(report.content_id)
      queue.push({
        report,
        content: contentMap.get(report.content_id) ?? null,
      })
    }

    setItems(queue)
    setLoading(false)
  }, [])

  useEffect(() => { loadQueue() }, [loadQueue])

  const handleAction = async (
    reportId: string,
    contentType: string,
    contentId: string,
    action: 'approve' | 'remove'
  ) => {
    setProcessing(reportId)

    const res = await fetch('/api/admin/moderate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reportId, contentType, contentId, action }),
    })

    setProcessing(null)

    if (!res.ok) {
      setError('Action failed. Please try again.')
      return
    }

    // Remove from local queue immediately
    setItems(prev => prev.filter(item => item.report.id !== reportId))
  }

  // ── Loading ──────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-6 h-6 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-white">Moderation Queue</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {items.length === 0 ? 'Queue is clear.' : `${items.length} item${items.length !== 1 ? 's' : ''} pending review`}
          </p>
        </div>
        <button
          onClick={loadQueue}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-white transition-colors px-3 py-1.5 border border-gray-800 rounded-lg"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-400 text-sm bg-red-900/20 border border-red-900/40 rounded-lg px-4 py-3 mb-4">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Empty state */}
      {items.length === 0 && !error && (
        <div className="text-center py-16 border border-dashed border-gray-800 rounded-xl">
          <CheckCircle className="w-10 h-10 text-green-700 mx-auto mb-3" />
          <p className="text-gray-400 font-medium">Queue is clear.</p>
          <p className="text-gray-600 text-sm mt-1">No reported content pending review.</p>
        </div>
      )}

      {/* Queue items */}
      <div className="flex flex-col gap-4">
        {items.map(({ report, content }) => {
          const isProcessing = processing === report.id
          const statusColor =
            content?.moderation_status === 'hidden'
              ? 'text-yellow-500 bg-yellow-500/10'
              : content?.moderation_status === 'removed'
                ? 'text-red-500 bg-red-500/10'
                : 'text-green-500 bg-green-500/10'

          return (
            <div
              key={report.id}
              className="border border-gray-800 rounded-xl p-5 bg-gray-900/30"
            >
              {/* Meta row */}
              <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] text-gray-600 uppercase tracking-wider">
                    {report.content_type}
                  </span>
                  <span className="text-gray-700">·</span>
                  <span className="text-[11px] text-red-400/80 uppercase tracking-wider">
                    {REASON_LABELS[report.reason] ?? report.reason}
                  </span>
                  <span className="text-gray-700">·</span>
                  <span className="text-[11px] text-gray-600">
                    {content?.report_count ?? 1} report{(content?.report_count ?? 1) !== 1 ? 's' : ''}
                  </span>
                </div>
                {content?.moderation_status && (
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${statusColor}`}>
                    {content.moderation_status}
                  </span>
                )}
              </div>

              {/* Content preview */}
              <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-3 mb-3">
                {content ? (
                  <>
                    {content.title && (
                      <p className="text-xs text-gray-500 mb-1 font-medium">{content.title}</p>
                    )}
                    <p className="text-sm text-gray-400 leading-relaxed line-clamp-4">
                      {content.content || '(no content)'}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-gray-600 italic">Content not found (may have been deleted)</p>
                )}
              </div>

              {/* Reporter note */}
              {report.additional_context && (
                <p className="text-xs text-gray-600 italic mb-3">
                  Reporter note: &quot;{report.additional_context}&quot;
                </p>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => handleAction(report.id, report.content_type, report.content_id, 'approve')}
                  disabled={isProcessing}
                  className="flex items-center gap-1.5 px-4 py-2 border border-gray-800 text-gray-500 text-sm rounded-lg hover:border-green-800 hover:text-green-500 transition-colors disabled:opacity-40"
                >
                  <Eye className="w-3.5 h-3.5" />
                  Approve — Restore
                </button>
                <button
                  onClick={() => handleAction(report.id, report.content_type, report.content_id, 'remove')}
                  disabled={isProcessing}
                  className="flex items-center gap-1.5 px-4 py-2 border border-gray-800 text-gray-500 text-sm rounded-lg hover:border-red-800 hover:text-red-500 transition-colors disabled:opacity-40"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Remove — Permanently
                </button>
                {isProcessing && (
                  <div className="flex items-center pl-2">
                    <div className="w-4 h-4 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
