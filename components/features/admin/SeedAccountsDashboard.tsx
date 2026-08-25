'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, Copy, CheckCircle, RefreshCw, Trash2, Inbox,
  ExternalLink, Clock, MessageSquare, AlertCircle,
  ChevronDown, ChevronUp, Loader2, UserCheck, X, Link2
} from 'lucide-react'
import * as rawAuth from '@/lib/core/supabase/raw-auth'
import { toPng } from 'html-to-image'
import SeedCardA from '@/components/features/seed/SeedCardA'

// ─── Types ────────────────────────────────────────────────────────────────────

interface SeedAccount {
  id: string
  handle: string
  seededAt: string
  expiresAt: string | null
  claimedAt: string | null
  messageCount: number
  inboxUrl: string
}

interface CreateResult {
  id: string
  handle: string
  claimUrl: string
  inboxUrl: string
  expiresAt: string
  whatsappText: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getAuthHeaders(): HeadersInit {
  const token = rawAuth.getSession()?.access_token
  return token ? { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } : { 'Content-Type': 'application/json' }
}

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null
  const ms = new Date(dateStr).getTime() - Date.now()
  return Math.ceil(ms / 86400000)
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ─── Copy button (small reusable) ────────────────────────────────────────────

function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button
      onClick={copy}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-400 hover:text-white hover:bg-gray-700 transition-all"
    >
      {copied
        ? <><CheckCircle className="w-3.5 h-3.5 text-green-400" /> Copied</>
        : <><Copy className="w-3.5 h-3.5" /> {label}</>
      }
    </button>
  )
}

// ─── Create panel ─────────────────────────────────────────────────────────────

function CreatePanel({ onCreated }: { onCreated: (result: CreateResult) => void }) {
  const [handle, setHandle] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    const res = await fetch('/api/admin/seed-accounts', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ handle: handle.trim() || undefined }),
    })
    const data = await res.json()
    setIsLoading(false)

    if (!res.ok) {
      setError(data.error || 'Failed to create account')
      return
    }

    setHandle('')
    onCreated(data)
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
      <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">Create seed account</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
        Leave handle blank to auto-generate a readable pseudonym.
      </p>

      <form onSubmit={handleCreate} className="flex gap-3">
        <div className="flex-1 relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm select-none">@</span>
          <input
            type="text"
            value={handle}
            onChange={e => setHandle(e.target.value.replace(/[\s/\\?#&%:@<>"{}|^`[\]]/g, ''))}
            placeholder="auto-generate"
            maxLength={30}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className="w-full h-10 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg pl-7 pr-4 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-purple-500 transition-colors"
          />
        </div>
        <button
          type="submit"
          disabled={isLoading}
          className="flex items-center gap-2 px-4 h-10 rounded-lg bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm font-medium transition-colors"
        >
          {isLoading
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <Plus className="w-4 h-4" />
          }
          Create
        </button>
      </form>

      {error && (
        <p className="mt-3 text-sm text-red-500 flex items-center gap-1.5">
          <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
        </p>
      )}
    </div>
  )
}

// ─── Result card (shown immediately after create / regenerate) ────────────────

function ResultCard({ result, onClose }: { result: CreateResult; onClose: () => void }) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [cardBlob, setCardBlob] = useState<string | null>(null)

  const generateCard = useCallback(async () => {
    if (!cardRef.current) return
    setIsGenerating(true)
    try {
      const dataUrl = await toPng(cardRef.current, { pixelRatio: 1, cacheBust: true })
      setCardBlob(dataUrl)
    } catch (err) {
      console.error('Card generation failed', err)
    } finally {
      setIsGenerating(false)
    }
  }, [])

  useEffect(() => { generateCard() }, [generateCard])

  const downloadCard = () => {
    if (!cardBlob) return
    const a = document.createElement('a')
    a.href = cardBlob
    a.download = `whisprspace-${result.handle}.png`
    a.click()
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="relative bg-gradient-to-br from-purple-950/40 to-gray-900 border border-purple-500/25 rounded-xl overflow-hidden"
    >
      {/* Close */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-1.5 rounded-full text-gray-500 hover:text-white hover:bg-gray-700 transition-colors z-10"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-5 pr-8">
          <div className="w-8 h-8 rounded-full bg-green-500/15 border border-green-500/25 flex items-center justify-center">
            <CheckCircle className="w-4 h-4 text-green-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">@{result.handle} is ready</p>
            <p className="text-xs text-gray-500">Expires {formatDate(result.expiresAt)}</p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          {/* Left — links */}
          <div className="space-y-3">
            {/* Claim URL */}
            <div className="bg-gray-900/60 rounded-lg border border-gray-700/50 p-3">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Claim link (private)</p>
                <CopyButton text={result.claimUrl} label="Copy link" />
              </div>
              <p className="text-xs text-gray-300 font-mono break-all leading-relaxed">{result.claimUrl}</p>
            </div>

            {/* Inbox URL */}
            <div className="bg-gray-900/60 rounded-lg border border-gray-700/50 p-3">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Inbox link (public)</p>
                <CopyButton text={result.inboxUrl} label="Copy link" />
              </div>
              <p className="text-xs text-gray-300 font-mono break-all leading-relaxed">{result.inboxUrl}</p>
            </div>

            {/* WhatsApp text */}
            <div className="bg-gray-900/60 rounded-lg border border-gray-700/50 p-3">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs text-gray-500 uppercase tracking-wide">WhatsApp message</p>
                <CopyButton text={result.whatsappText} label="Copy text" />
              </div>
              <p className="text-xs text-gray-400 whitespace-pre-wrap break-words leading-relaxed">{result.whatsappText}</p>
            </div>
          </div>

          {/* Right — card preview */}
          <div className="flex flex-col items-center gap-3">
            {isGenerating ? (
              <div className="flex-1 flex items-center justify-center bg-gray-900/40 rounded-lg border border-gray-700/50 w-full min-h-[200px]">
                <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
              </div>
            ) : cardBlob ? (
              <>
                <img
                  src={cardBlob}
                  alt="Card A preview"
                  className="w-auto max-w-full max-h-[45vh] md:max-h-none md:w-full rounded-lg border border-gray-700 shadow-lg"
                  style={{ aspectRatio: '1080/1920', objectFit: 'cover' }}
                />
                <button
                  onClick={downloadCard}
                  className="w-full py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium transition-colors"
                >
                  Download card
                </button>
              </>
            ) : (
              <button
                onClick={generateCard}
                className="w-full py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium transition-colors"
              >
                Generate card
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Hidden card for html-to-image — rendered off-screen */}
      <div style={{ position: 'absolute', top: -9999, left: -9999, pointerEvents: 'none' }}>
        <SeedCardA ref={cardRef} handle={result.handle} inboxUrl={result.inboxUrl} />
      </div>
    </motion.div>
  )
}

// ─── Account row ──────────────────────────────────────────────────────────────

function AccountRow({
  account,
  onRegenerate,
  onRevoke,
}: {
  account: SeedAccount
  onRegenerate: (id: string) => Promise<CreateResult | null>
  onRevoke: (id: string, handle: string) => Promise<void>
}) {
  const [expanded, setExpanded] = useState(false)
  const [regenResult, setRegenResult] = useState<CreateResult | null>(null)
  const [isRegenerating, setIsRegenerating] = useState(false)
  const [isRevoking, setIsRevoking] = useState(false)
  const [confirmRevoke, setConfirmRevoke] = useState(false)

  const daysLeft = daysUntil(account.expiresAt)
  const isClaimed = !!account.claimedAt
  const isExpired = !isClaimed && daysLeft !== null && daysLeft <= 0

  const statusBadge = isClaimed
    ? <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-500/15 text-green-400 border border-green-500/25">Claimed</span>
    : isExpired
    ? <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-500/15 text-red-400 border border-red-500/25">Expired</span>
    : <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/25">Pending</span>

  const handleRegen = async () => {
    setIsRegenerating(true)
    const result = await onRegenerate(account.id)
    setIsRegenerating(false)
    if (result) { setRegenResult(result); setExpanded(true) }
  }

  const handleRevoke = async () => {
    if (!confirmRevoke) { setConfirmRevoke(true); return }
    setIsRevoking(true)
    await onRevoke(account.id, account.handle)
    setIsRevoking(false)
    setConfirmRevoke(false)
  }

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
      {/* Row header */}
      <div
        className="flex items-center gap-3 px-4 py-3.5 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750 cursor-pointer transition-colors"
        onClick={() => setExpanded(v => !v)}
      >
        {/* Avatar */}
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
          {account.handle.charAt(0).toUpperCase()}
        </div>

        {/* Handle + status */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-gray-900 dark:text-white">@{account.handle}</span>
            {statusBadge}
          </div>
          <div className="flex items-center gap-x-3 gap-y-1 flex-wrap mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            {!isClaimed && daysLeft !== null && daysLeft > 0 && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" /> {daysLeft}d left
              </span>
            )}
            {account.messageCount > 0 && (
              <span className="flex items-center gap-1">
                <MessageSquare className="w-3 h-3" /> {account.messageCount} message{account.messageCount !== 1 ? 's' : ''}
              </span>
            )}
            <span>Created {formatDate(account.seededAt)}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
          <a
            href={account.inboxUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
            title="View inbox"
          >
            <ExternalLink className="w-4 h-4" />
          </a>

          {!isClaimed && (
            <>
              <button
                onClick={handleRegen}
                disabled={isRegenerating}
                className="p-1.5 rounded-lg text-gray-400 hover:text-amber-400 hover:bg-amber-500/10 transition-colors"
                title="Regenerate claim link"
              >
                {isRegenerating
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <RefreshCw className="w-4 h-4" />
                }
              </button>

              <button
                onClick={handleRevoke}
                disabled={isRevoking}
                className={`p-1.5 rounded-lg transition-colors ${
                  confirmRevoke
                    ? 'text-white bg-red-600 hover:bg-red-700'
                    : 'text-gray-400 hover:text-red-400 hover:bg-red-500/10'
                }`}
                title={confirmRevoke ? 'Click again to confirm revoke' : 'Revoke account'}
                onBlur={() => setConfirmRevoke(false)}
              >
                {isRevoking
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Trash2 className="w-4 h-4" />
                }
              </button>
            </>
          )}

          <button className="p-1.5 rounded-lg text-gray-400 transition-colors" onClick={e => { e.stopPropagation(); setExpanded(v => !v) }}>
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Expanded panel */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="p-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700 space-y-3">
              {regenResult ? (
                <ResultCard result={regenResult} onClose={() => { setRegenResult(null); setExpanded(false) }} />
              ) : (
                <>
                  {/* Inbox link — always available */}
                  <div className="bg-gray-900/60 rounded-lg border border-gray-700/50 p-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-xs text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
                        <Inbox className="w-3.5 h-3.5" /> Inbox link (public)
                      </p>
                      <CopyButton text={account.inboxUrl} label="Copy" />
                    </div>
                    <p className="text-xs text-gray-300 font-mono break-all leading-relaxed">{account.inboxUrl}</p>
                  </div>

                  {/* Claimed — show claim date */}
                  {isClaimed && (
                    <div className="flex items-center gap-2 text-xs text-green-400 bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2">
                      <UserCheck className="w-3.5 h-3.5 flex-shrink-0" />
                      Account claimed on {formatDate(account.claimedAt)}
                    </div>
                  )}

                  {/* Not claimed — show regen prompt */}
                  {!isClaimed && (
                    <div className="flex items-center gap-2 text-xs text-gray-400 bg-gray-800/60 border border-gray-700/50 rounded-lg px-3 py-2">
                      <Link2 className="w-3.5 h-3.5 flex-shrink-0 text-amber-400" />
                      {isExpired
                        ? 'Claim link has expired — regenerate to issue a new one.'
                        : 'Claim link was issued at account creation. Regenerate to get a fresh copy.'}
                    </div>
                  )}
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Main dashboard ───────────────────────────────────────────────────────────

export default function SeedAccountsDashboard() {
  const [accounts, setAccounts] = useState<SeedAccount[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [latestResult, setLatestResult] = useState<CreateResult | null>(null)
  const [filter, setFilter] = useState<'all' | 'pending' | 'claimed' | 'expired'>('all')

  const fetchAccounts = useCallback(async () => {
    const res = await fetch('/api/admin/seed-accounts', { headers: getAuthHeaders() })
    if (res.ok) {
      const data = await res.json()
      setAccounts(data.accounts ?? [])
    }
    setIsLoading(false)
  }, [])

  useEffect(() => { fetchAccounts() }, [fetchAccounts])

  const handleCreated = (result: CreateResult) => {
    setLatestResult(result)
    fetchAccounts()
  }

  const handleRegenerate = async (id: string): Promise<CreateResult | null> => {
    const res = await fetch(`/api/admin/seed-accounts/${id}/regenerate`, {
      method: 'POST',
      headers: getAuthHeaders(),
    })
    if (!res.ok) return null
    const data = await res.json()
    return { id, handle: accounts.find(a => a.id === id)?.handle ?? '', ...data }
  }

  const handleRevoke = async (id: string, handle: string) => {
    const res = await fetch(`/api/admin/seed-accounts/${id}/revoke`, {
      method: 'POST',
      headers: getAuthHeaders(),
    })
    if (res.ok) {
      setAccounts(prev => prev.filter(a => a.id !== id))
      if (latestResult?.id === id) setLatestResult(null)
    }
  }

  const filtered = accounts.filter(a => {
    const isExpiredAccount = !a.claimedAt && a.expiresAt !== null && new Date(a.expiresAt).getTime() <= Date.now()
    if (filter === 'pending') return !a.claimedAt && !isExpiredAccount
    if (filter === 'claimed') return !!a.claimedAt
    if (filter === 'expired') return isExpiredAccount
    return true
  })

  const claimedCount = accounts.filter(a => !!a.claimedAt).length
  const expiredCount = accounts.filter(a => !a.claimedAt && a.expiresAt !== null && new Date(a.expiresAt).getTime() <= Date.now()).length
  const pendingCount = accounts.filter(a => !a.claimedAt && (a.expiresAt === null || new Date(a.expiresAt).getTime() > Date.now())).length

  return (
    <div className="space-y-6">

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total seeds', value: accounts.length, icon: UserCheck, color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-900/20' },
          { label: 'Pending claim', value: pendingCount, icon: Clock, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20' },
          { label: 'Claimed', value: claimedCount, icon: CheckCircle, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/20' },
          { label: 'Expired', value: expiredCount, icon: AlertCircle, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 sm:p-5 flex sm:block items-center gap-3">
            <div className={`w-10 h-10 rounded-lg ${bg} flex items-center justify-center sm:mb-3 flex-shrink-0`}>
              <Icon className={`w-5 h-5 ${color}`} />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Create panel */}
      <CreatePanel onCreated={handleCreated} />

      {/* Latest result */}
      <AnimatePresence>
        {latestResult && (
          <ResultCard result={latestResult} onClose={() => setLatestResult(null)} />
        )}
      </AnimatePresence>

      {/* Account list */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* List header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">Seed accounts</h3>
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-900 rounded-lg p-1 self-start sm:self-auto">
            {(['all', 'pending', 'claimed', 'expired'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors capitalize ${
                  filter === f
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <div className="p-4 space-y-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-3">
                <Inbox className="w-5 h-5 text-gray-400" />
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {filter === 'all' ? 'No seed accounts yet. Create one above.' : `No ${filter} accounts.`}
              </p>
            </div>
          ) : (
            filtered.map(account => (
              <AccountRow
                key={account.id}
                account={account}
                onRegenerate={handleRegenerate}
                onRevoke={handleRevoke}
              />
            ))
          )}
        </div>
      </div>
    </div>
  )
}
