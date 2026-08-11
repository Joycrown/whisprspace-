'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ShieldCheck, Eye, EyeOff, Copy, CheckCircle, Check,
  AlertCircle, Inbox, Share2, Lock, Loader2
} from 'lucide-react'
import * as rawAuth from '@/lib/core/supabase/raw-auth'

interface ClaimPageProps {
  params: Promise<{ token: string }>
}

type Stage = 'loading' | 'invalid' | 'form' | 'claiming' | 'success'

interface ValidateResult {
  valid: boolean
  handle: string
  userId: string
}

interface CompleteResult {
  success: boolean
  handle: string
  session: Record<string, unknown> | null
  messageCount: number
  inboxUrl: string
  inboxReadUrl: string
  fallbackToSignIn?: boolean
  email?: string | null
}

type EmailStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid'

export default function ClaimPage({ params }: ClaimPageProps) {
  const { token } = use(params)
  const router = useRouter()

  const [stage, setStage] = useState<Stage>('loading')
  const [validateResult, setValidateResult] = useState<ValidateResult | null>(null)
  const [completeResult, setCompleteResult] = useState<CompleteResult | null>(null)

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [email, setEmail] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [formError, setFormError] = useState('')
  const [copiedLink, setCopiedLink] = useState(false)
  const [emailStatus, setEmailStatus] = useState<EmailStatus>('idle')

  // Validate token on mount
  useEffect(() => {
    if (!token) { setStage('invalid'); return }

    fetch(`/api/claim/validate?token=${encodeURIComponent(token)}`)
      .then(r => r.json())
      .then(data => {
        if (data.valid) {
          setValidateResult(data)
          setStage('form')
        } else {
          setStage('invalid')
        }
      })
      .catch(() => setStage('invalid'))
  }, [token])

  useEffect(() => {
    const trimmed = email.trim()

    if (!trimmed) {
      setEmailStatus('idle')
      return
    }

    setEmailStatus('checking')
    let cancelled = false

    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/claim/check-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, email: trimmed }),
        })
        const data = await res.json()
        if (cancelled) return

        if (data.available) setEmailStatus('available')
        else if (data.reason === 'invalid') setEmailStatus('invalid')
        else setEmailStatus('taken')
      } catch {
        if (!cancelled) setEmailStatus('idle')
      }
    }, 500)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [email, token])

  const handleClaim = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')

    if (email.trim() && emailStatus === 'taken') {
      setFormError('That email is already in use. Try a different email, or leave it blank.')
      return
    }
    if (email.trim() && emailStatus === 'invalid') {
      setFormError('Please enter a valid email address.')
      return
    }

    if (password.length < 8) {
      setFormError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirmPassword) {
      setFormError('Passwords do not match.')
      return
    }

    setStage('claiming')

    const res = await fetch('/api/claim/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password, email: email.trim() || undefined }),
    })

    const data = await res.json()

    if (!res.ok || !data.success) {
      // Show the specific reason when the server provides one (e.g. email taken),
      // otherwise the generic message. `detail` carries the underlying auth error
      // for easier diagnosis.
      const message = data.detail ? `${data.error} (${data.detail})` : (data.error || 'Something went wrong. Please try again.')
      setFormError(message)
      setStage('form')
      return
    }

    // Inject the session so the user is logged in immediately.
    // If no email was provided we can't auto sign-in — the success screen
    // will show a nudge to sign in manually via /auth.
    if (data.session) {
      rawAuth.setSession(data.session)
    }

    setCompleteResult(data)
    setStage('success')
  }

  const handleShare = async () => {
    if (!completeResult) return
    const link = completeResult.inboxUrl
    const text = `Tell me what you actually think — anonymously. No name. No trace.\n${link}`
    if (navigator.share) {
      try { await navigator.share({ title: 'My WhisprSpace Inbox', text, url: link }) } catch { /* cancelled */ }
    } else {
      await navigator.clipboard.writeText(link)
    }
  }

  const copyLink = async () => {
    if (!completeResult) return
    await navigator.clipboard.writeText(completeResult.inboxUrl)
    setCopiedLink(true)
    setTimeout(() => setCopiedLink(false), 2500)
  }

  return (
    <div className="min-h-screen bg-[#0e0e0e] flex flex-col items-center justify-center px-4 py-12">

      {/* Brand mark */}
      <div className="mb-8 text-center">
        <p className="text-purple-400 text-sm font-semibold tracking-widest uppercase">WhisprSpace</p>
      </div>

      <AnimatePresence mode="wait">

        {/* ── Loading ── */}
        {stage === 'loading' && (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex flex-col items-center gap-4"
          >
            <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
            <p className="text-gray-500 text-sm">Checking your link…</p>
          </motion.div>
        )}

        {/* ── Claiming ── */}
        {stage === 'claiming' && (
          <motion.div
            key="claiming"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex flex-col items-center gap-4"
          >
            <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
            <p className="text-gray-400 text-sm">Setting up your inbox…</p>
          </motion.div>
        )}

        {/* ── Invalid / expired ── */}
        {stage === 'invalid' && (
          <motion.div
            key="invalid"
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-md text-center"
          >
            <div className="bg-[#161616] border border-gray-800 rounded-2xl p-10">
              <div className="w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-5">
                <AlertCircle className="w-6 h-6 text-red-400" />
              </div>
              <h1 className="text-xl font-semibold text-white mb-2">This link is no longer valid.</h1>
              <p className="text-gray-500 text-sm leading-relaxed">
                It may have already been used, or it expired. If you need a new one, ask the person who sent it.
              </p>
            </div>
          </motion.div>
        )}

        {/* ── Claim form ── */}
        {stage === 'form' && validateResult && (
          <motion.div
            key="form"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-md"
          >
            <div className="bg-[#161616] border border-gray-800 rounded-2xl overflow-hidden shadow-2xl">

              {/* Header */}
              <div className="px-8 pt-8 pb-6 border-b border-gray-800/60">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-full bg-purple-600/20 border border-purple-500/30 flex items-center justify-center">
                    <span className="text-lg font-bold text-purple-300">
                      {validateResult.handle.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Your inbox</p>
                    <p className="text-white font-semibold">@{validateResult.handle}</p>
                  </div>
                </div>
                <h1 className="text-2xl font-bold text-white">
                  This inbox is yours.
                </h1>
                <p className="text-gray-400 text-sm mt-1 leading-relaxed">
                  Set a password to claim it. People can already message you anonymously.
                </p>
              </div>

              {/* Form */}
              <form onSubmit={handleClaim} className="px-8 py-6 space-y-5">

                {/* Password */}
                <div className="space-y-1.5">
                  <label className="text-xs text-gray-400 font-medium uppercase tracking-wide">Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="At least 8 characters"
                      required
                      className="w-full bg-[#111] border border-gray-700 rounded-xl px-4 py-3 pr-11 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-purple-500 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Confirm password */}
                <div className="space-y-1.5">
                  <label className="text-xs text-gray-400 font-medium uppercase tracking-wide">Confirm password</label>
                  <div className="relative">
                    <input
                      type={showConfirm ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      placeholder="Same password again"
                      required
                      className="w-full bg-[#111] border border-gray-700 rounded-xl px-4 py-3 pr-11 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-purple-500 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                    >
                      {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Email — optional */}
                <div className="space-y-1.5">
                  <label className="text-xs text-gray-400 font-medium uppercase tracking-wide">
                    Email <span className="text-gray-600 normal-case font-normal">— for account recovery</span>
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className={`w-full bg-[#111] border rounded-xl px-4 py-3 pr-10 text-white text-sm placeholder-gray-600 focus:outline-none transition-colors ${
                        emailStatus === 'taken' || emailStatus === 'invalid'
                          ? 'border-red-500/60 focus:border-red-500'
                          : emailStatus === 'available'
                            ? 'border-green-500/60 focus:border-green-500'
                            : 'border-gray-700 focus:border-purple-500'
                      }`}
                    />
                    {emailStatus === 'checking' && (
                      <Loader2 className="w-4 h-4 text-gray-500 animate-spin absolute right-3 top-1/2 -translate-y-1/2" />
                    )}
                    {emailStatus === 'available' && (
                      <Check className="w-4 h-4 text-green-500 absolute right-3 top-1/2 -translate-y-1/2" />
                    )}
                    {(emailStatus === 'taken' || emailStatus === 'invalid') && (
                      <AlertCircle className="w-4 h-4 text-red-500 absolute right-3 top-1/2 -translate-y-1/2" />
                    )}
                  </div>
                  {emailStatus === 'taken' ? (
                    <p className="text-xs text-red-400 leading-relaxed">
                      That email is already in use. Try another, or leave it blank.
                    </p>
                  ) : emailStatus === 'invalid' ? (
                    <p className="text-xs text-red-400 leading-relaxed">
                      That doesn&apos;t look like a valid email address.
                    </p>
                  ) : (
                    <p className="text-xs text-gray-600 leading-relaxed">
                      If you lose access, we can&apos;t restore it without one.
                    </p>
                  )}
                </div>

                {/* Error */}
                {formError && (
                  <div className="flex items-start gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    {formError}
                  </div>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  disabled={
                    !password ||
                    !confirmPassword ||
                    emailStatus === 'checking' ||
                    emailStatus === 'taken' ||
                    emailStatus === 'invalid'
                  }
                  className="w-full py-3.5 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2"
                >
                  <Lock className="w-4 h-4" />
                  Claim this inbox
                </button>

                <div className="flex items-center gap-2 text-xs text-gray-600 justify-center pt-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-gray-600" />
                  Your identity stays private to everyone who messages you
                </div>
              </form>
            </div>
          </motion.div>
        )}

        {/* ── Success ── */}
        {stage === 'success' && completeResult && (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 22 }}
            className="w-full max-w-md"
          >
            <div className="bg-[#161616] border border-gray-800 rounded-2xl overflow-hidden shadow-2xl">

              {/* Top — confirmation */}
              <div className="px-8 pt-8 pb-6 text-center border-b border-gray-800/60">
                <div className="w-16 h-16 rounded-full bg-green-500/15 border border-green-500/25 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-7 h-7 text-green-400" />
                </div>
                <h1 className="text-2xl font-bold text-white mb-1">You&apos;re set.</h1>
                <p className="text-gray-400 text-sm leading-relaxed">
                  People can message you anonymously right now.
                </p>

                {completeResult.messageCount > 0 && (
                  <div className="mt-4 inline-flex items-center gap-2 bg-purple-600/15 border border-purple-500/25 rounded-full px-4 py-2">
                    <Inbox className="w-4 h-4 text-purple-400" />
                    <span className="text-purple-300 text-sm font-medium">
                      You already have {completeResult.messageCount} message{completeResult.messageCount === 1 ? '' : 's'} waiting
                    </span>
                  </div>
                )}
              </div>

              {/* Inbox link */}
              <div className="px-8 py-5 border-b border-gray-800/60">
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Your inbox link</p>
                <div className="flex items-center justify-between bg-[#111] border border-gray-700 rounded-xl px-4 py-3">
                  <span className="text-sm text-gray-300 font-mono truncate">
                    {completeResult.inboxUrl.replace('https://', '')}
                  </span>
                  <button
                    onClick={copyLink}
                    className="ml-3 flex-shrink-0 text-gray-500 hover:text-purple-400 transition-colors"
                  >
                    {copiedLink
                      ? <CheckCircle className="w-4 h-4 text-green-400" />
                      : <Copy className="w-4 h-4" />
                    }
                  </button>
                </div>
              </div>

              {/* Actions */}
              <div className="px-8 py-6 space-y-3">
                <button
                  onClick={handleShare}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-purple-600 to-purple-700 hover:opacity-90 text-white font-semibold text-sm transition-opacity flex items-center justify-center gap-2"
                >
                  <Share2 className="w-4 h-4" />
                  Share to WhatsApp Status
                </button>

                {completeResult.fallbackToSignIn ? (
                  <button
                    onClick={() => router.push(`/auth?view=login`)}
                    className="w-full py-3 rounded-xl bg-transparent border border-gray-700 hover:border-gray-600 text-gray-400 hover:text-white font-medium text-sm transition-colors flex items-center justify-center gap-2"
                  >
                    <Inbox className="w-4 h-4" />
                    Sign in to read messages
                  </button>
                ) : (
                  <button
                    onClick={() => router.push(completeResult.inboxReadUrl)}
                    className="w-full py-3 rounded-xl bg-transparent border border-gray-700 hover:border-gray-600 text-gray-400 hover:text-white font-medium text-sm transition-colors flex items-center justify-center gap-2"
                  >
                    <Inbox className="w-4 h-4" />
                    Open my inbox
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  )
}
