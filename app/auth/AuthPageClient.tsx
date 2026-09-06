"use client";

import React, { useState, useEffect, useRef, useLayoutEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useUserStore } from '@/store/userStore';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Copy, CheckCircle, Eye, EyeOff, RefreshCw, Link2, ArrowLeft } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import AppLoadingState from '@/components/ui/AppLoadingState';
import { LEGAL_CONSENT_REQUIRED_ERROR, hasRequiredLegalConsent, recordLegalConsent } from '@/lib/legal/consent';
import {
  sanitizeEmailAddress,
  sanitizePasswordInput,
} from '@/lib/security/input-sanitization';
import { generatePseudonym } from '@/lib/utils/pseudonym-generator';
import { checkUsernameAvailability, updateUsername } from '@/lib/services/username-service';
import { validateUsername } from '@/lib/utils/username-validation';

// ─── Shared primitives ────────────────────────────────────────────────────────

const Spinner = () => (
  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
);

const inputCls =
  'w-full h-11 rounded-xl px-4 text-sm text-[#F2F2F6] placeholder-[#5C5C6E] ' +
  'bg-white/[0.03] border border-[#2A2A38] ' +
  'focus:outline-none focus:border-[#8B5CF6]/60 transition-colors';

const labelCls = 'block text-xs font-medium text-[#8F8FA3] uppercase tracking-wide mb-1.5';

const heroBtnCls =
  'w-full h-[50px] rounded-[11px] text-sm font-medium text-white ' +
  'bg-gradient-to-r from-[#8B5CF6] to-[#F97316] ' +
  'hover:opacity-90 active:scale-[0.97] transition-all flex items-center justify-center gap-2';

const secondaryBtnCls =
  'w-full h-[50px] rounded-[11px] text-sm font-medium text-[#F2F2F6] ' +
  'bg-white/[0.05] border border-[#2A2A38] ' +
  'hover:bg-white/[0.08] active:scale-[0.97] transition-all flex items-center justify-center gap-2';

const ghostBtnCls =
  'w-full text-sm text-[#8F8FA3] hover:text-[#F2F2F6] active:scale-[0.97] transition-all py-2';

const cardCls =
  'w-full max-w-md bg-[#12121A] rounded-2xl p-8 border border-[#23232E]';

// ─── Component ────────────────────────────────────────────────────────────────

const AuthPage = () => {
  const [view, setView] = useState<'main' | 'anonymous' | 'login' | 'signup' | 'forgot' | 'welcome' | 'handle-picker' | 'inbox-welcome'>('main');
  const [copiedId, setCopiedId] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [legalConsentChecked, setLegalConsentChecked] = useState(false);

  const [handleValue, setHandleValue] = useState('');
  const [handleAvailability, setHandleAvailability] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');
  const [handleSaving, setHandleSaving] = useState(false);
  const [claimedHandle, setClaimedHandle] = useState('');
  const [copiedInboxLink, setCopiedInboxLink] = useState(false);
  const handleCheckTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [signupForm, setSignupForm] = useState({ email: '', password: '' });
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);

  const {
    loginAnonymously,
    login,
    signup,
    session,
    sessionInfo,
    isLoading,
    error,
    clearError,
    sessionValidated,
    rememberMe,
    setRememberMe,
  } = useUserStore();

  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useToast();

  const redirectTo = (() => {
    const raw = searchParams?.get('redirect');
    if (!raw || !raw.startsWith('/')) return '/threads';
    return raw;
  })();
  const forceAuth = searchParams?.get('force') === '1';
  const viewParam = searchParams?.get('view');
  const reasonParam = searchParams?.get('reason');

  useEffect(() => {
    if (!viewParam) return;
    if (viewParam === 'login' || viewParam === 'signup' || viewParam === 'anonymous' || viewParam === 'main') {
      setView(viewParam as typeof view);
    }
  }, [viewParam]);

  useEffect(() => {
    setLegalConsentChecked(hasRequiredLegalConsent());
  }, []);

  useLayoutEffect(() => {
    if (forceAuth) return;
    const currentState = useUserStore.getState();
    if (currentState.sessionValidated && (currentState.session.isAuthenticated || currentState.sessionInfo)) {
      window.location.replace(redirectTo);
    }
  }, [redirectTo, forceAuth]);

  useEffect(() => {
    if (forceAuth) return;
    if ((session.isAuthenticated || sessionInfo) && view === 'welcome') {
      const timer = setTimeout(() => { router.push(redirectTo); }, 5000);
      return () => clearTimeout(timer);
    }
  }, [session.isAuthenticated, sessionInfo?.anonymousId, view, router, redirectTo, forceAuth]);

  const handleAnonymousJoin = async () => {
    clearError();
    if (!legalConsentChecked) {
      showToast({ type: 'error', title: 'Consent required', message: LEGAL_CONSENT_REQUIRED_ERROR, duration: 5000 });
      return;
    }
    recordLegalConsent();
    await loginAnonymously();
  };

  useEffect(() => {
    if (!isLoading && (sessionInfo || session.user)) {
      if (view === 'anonymous' || view === 'main') {
        setView('welcome');
        const isAnonymous = sessionInfo !== null;
        showToast({
          type: 'success',
          title: isAnonymous ? 'Anonymous session created' : 'Welcome back',
          message: isAnonymous
            ? 'You can browse, like, and comment. Sign up to create discussions.'
            : 'You have full access to all features.',
          duration: 4000,
        });
      } else if (view === 'signup') {
        if (reasonParam === 'inbox') {
          // Prefill the picker with the user's EXISTING handle (upgraded guests
          // already have one — it's the link they shared and that received
          // messages). Only fall back to a generated pseudonym for brand-new
          // accounts with no handle yet. This keeps their shared link intact by
          // default while still letting them customize.
          const existingHandle = session.user?.username || session.user?.anonymousId;
          const initialHandle = existingHandle || generatePseudonym();
          setHandleValue(initialHandle);
          setHandleAvailability('checking');
          setView('handle-picker');
          checkUsernameAvailability(initialHandle, session.user?.id).then(available => {
            setHandleAvailability(available ? 'available' : 'taken');
          });
        } else {
          setView('welcome');
          showToast({ type: 'success', title: 'Account ready', message: 'You now have full access.', duration: 4000 });
        }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionInfo?.anonymousId, session.user?.id, isLoading]);

  const hasRedirected = useRef(false);
  useEffect(() => {
    if (forceAuth) return;
    if (!sessionValidated) return;
    if (hasRedirected.current) return;
    if (sessionInfo !== null || session.isAuthenticated) {
      hasRedirected.current = true;
      window.location.replace(redirectTo);
    }
  }, [sessionValidated, sessionInfo?.anonymousId, session.isAuthenticated, redirectTo, forceAuth]);

  useEffect(() => {
    if (error) {
      showToast({ type: 'error', title: 'Authentication error', message: error, duration: 5000 });
      setTimeout(() => clearError(), 100);
    }
  }, [error, showToast, clearError]);

  useEffect(() => { clearError(); }, [view, clearError]);

  const checkHandle = useCallback((value: string) => {
    if (handleCheckTimer.current) clearTimeout(handleCheckTimer.current);
    const trimmed = value.trim();
    if (!trimmed) { setHandleAvailability('idle'); return; }
    const validation = validateUsername(trimmed);
    if (!validation.isValid) { setHandleAvailability('invalid'); return; }
    setHandleAvailability('checking');
    handleCheckTimer.current = setTimeout(async () => {
      const userId = session.user?.id;
      const available = await checkUsernameAvailability(trimmed, userId);
      setHandleAvailability(available ? 'available' : 'taken');
    }, 400);
  }, [session.user?.id]);

  const onHandleChange = (value: string) => {
    const cleaned = value.toLowerCase().replace(/[^a-z0-9-]/g, '');
    setHandleValue(cleaned);
    checkHandle(cleaned);
  };

  const regenerateHandle = () => {
    const next = generatePseudonym();
    setHandleValue(next);
    checkHandle(next);
  };

  const claimHandle = async () => {
    const userId = session.user?.id;
    if (!userId) return;
    setHandleSaving(true);
    const result = await updateUsername(userId, handleValue.trim());
    setHandleSaving(false);
    if (result.success) {
      setClaimedHandle(result.username || handleValue.trim());
      setView('inbox-welcome');
    } else {
      showToast({ type: 'error', title: 'Could not claim handle', message: result.error || 'Try a different one.', duration: 4000 });
    }
  };

  const copyInboxLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/message/${claimedHandle}`);
    setCopiedInboxLink(true);
    setTimeout(() => setCopiedInboxLink(false), 2500);
  };

  const shareInbox = async () => {
    const link = `${window.location.origin}/message/${claimedHandle}`;
    const text = `Tell me what you actually think — anonymously. No name. No trace.\n${link}`;
    if (navigator.share) {
      try { await navigator.share({ title: 'My WhisprSpace inbox', text, url: link }); } catch { /* cancelled */ }
    } else {
      await navigator.clipboard.writeText(link);
      showToast({ type: 'success', title: 'Link copied', message: 'Share it wherever you like.', duration: 3000 });
    }
  };

  const copyAnonymousId = () => {
    const id = session.user?.anonymousId || sessionInfo?.anonymousId;
    if (id) {
      navigator.clipboard.writeText(id);
      setCopiedId(true);
      showToast({ type: 'success', title: 'Copied', message: 'Anonymous ID copied to clipboard', duration: 2000 });
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    const email = sanitizeEmailAddress(loginForm.email);
    const password = sanitizePasswordInput(loginForm.password);
    if (!email || !password.trim()) {
      showToast({ type: 'error', title: 'Invalid credentials', message: 'Please provide a valid email and password.', duration: 3000 });
      return;
    }
    await login(email, password, rememberMe);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    const email = sanitizeEmailAddress(signupForm.email);
    const password = sanitizePasswordInput(signupForm.password);
    if (!email || !password.trim()) {
      showToast({ type: 'error', title: 'Invalid input', message: 'Please provide a valid email and password.', duration: 3000 });
      return;
    }
    if (!legalConsentChecked) {
      showToast({ type: 'error', title: 'Consent required', message: LEGAL_CONSENT_REQUIRED_ERROR, duration: 5000 });
      return;
    }
    recordLegalConsent();
    await signup(email, password);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = sanitizeEmailAddress(forgotEmail);
    if (!email) {
      showToast({ type: 'error', title: 'Invalid email', message: 'Please enter a valid email address', duration: 3000 });
      return;
    }
    setForgotLoading(true);
    try {
      const { requestPasswordReset } = await import('@/lib/auth/auth-service');
      const result = await requestPasswordReset(email);
      if (result.success) {
        showToast({ type: 'success', title: 'Reset link sent', message: result.message, duration: 8000 });
        setForgotEmail('');
        setTimeout(() => { setView('login'); }, 3000);
      } else {
        showToast({ type: 'error', title: 'Reset failed', message: result.message, duration: 8000 });
      }
    } catch {
      showToast({ type: 'error', title: 'Error', message: 'An unexpected error occurred. Please try again.', duration: 4000 });
    } finally {
      setForgotLoading(false);
    }
  };

  if (!forceAuth && sessionValidated && (sessionInfo || session.isAuthenticated)) {
    return <AppLoadingState title="Opening your space..." />;
  }

  const enter = { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.22 } };

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-[#0A0A10] px-4 py-8">

      {/* Wordmark */}
      <div className="mb-8 text-center">
        <h1
          className="text-3xl font-medium tracking-[-0.3px]"
          style={{
            background: 'linear-gradient(100deg, #8B5CF6 0%, #F97316 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          WhisprSpace
        </h1>
        <p className="text-[#5C5C6E] text-sm mt-1">Speak freely, stay anonymous.</p>
      </div>

      <div className={cardCls}>
        <AnimatePresence mode="wait">

          {/* ── Main ── */}
          {view === 'main' && (
            <motion.div key="main" {...enter} className="space-y-5">
              <div className="text-center space-y-1">
                <h2 className="text-xl font-medium text-[#F2F2F6] tracking-[-0.3px]">Get started</h2>
                <p className="text-[#5C5C6E] text-sm">No name. No trace.</p>
              </div>

              <div className="space-y-3 pt-1">
                <button onClick={() => setView('anonymous')} className={heroBtnCls}>
                  <Shield className="w-4 h-4" />
                  Continue anonymously
                </button>
                <button onClick={() => setView('signup')} className={secondaryBtnCls}>
                  Create account
                </button>
                <button onClick={() => setView('login')} className={ghostBtnCls}>
                  Sign in
                </button>
              </div>
            </motion.div>
          )}

          {/* ── Anonymous ── */}
          {view === 'anonymous' && (
            <motion.div key="anonymous" {...enter} className="space-y-5">
              <button onClick={() => setView('main')} className="flex items-center gap-1.5 text-[#5C5C6E] hover:text-[#8F8FA3] text-sm transition-colors mb-2">
                <ArrowLeft className="w-3.5 h-3.5" /> Back
              </button>

              <div className="text-center space-y-1">
                <div className="w-12 h-12 mx-auto mb-3 rounded-[16px] flex items-center justify-center"
                  style={{ background: 'linear-gradient(100deg, #231D3D, #3D3555)' }}>
                  <Shield className="w-5 h-5 text-[#A78BFA]" />
                </div>
                <h2 className="text-xl font-medium text-[#F2F2F6] tracking-[-0.3px]">Join anonymously</h2>
                <p className="text-[#8F8FA3] text-sm leading-relaxed">No email. No personal data. Your identity stays yours.</p>
              </div>

              <div className="rounded-xl border border-[#2A2A38] bg-white/[0.02] px-4 py-3 text-xs text-[#8F8FA3] leading-relaxed">
                Guest sessions are temporary. Sign up later to keep your contributions.
              </div>

              <button
                onClick={handleAnonymousJoin}
                disabled={isLoading}
                className={heroBtnCls}
              >
                {isLoading ? <Spinner /> : <><Shield className="w-4 h-4" /> Join anonymously</>}
              </button>

              <label className="flex items-start gap-2 text-xs text-[#5C5C6E] cursor-pointer">
                <input
                  type="checkbox"
                  checked={legalConsentChecked}
                  onChange={(e) => setLegalConsentChecked(e.target.checked)}
                  className="mt-0.5 rounded border-[#2A2A38] bg-transparent text-[#8B5CF6] focus:ring-[#8B5CF6]/30"
                />
                <span>
                  I agree to the{' '}
                  <Link href="/privacy-policy" target="_blank" className="text-[#C4B5FD] hover:text-[#F2F2F6] transition-colors">Privacy Policy</Link>
                  {' '}and{' '}
                  <Link href="/community-guidelines" target="_blank" className="text-[#C4B5FD] hover:text-[#F2F2F6] transition-colors">Community Guidelines</Link>.
                </span>
              </label>
            </motion.div>
          )}

          {/* ── Login ── */}
          {view === 'login' && (
            <motion.div key="login" {...enter} className="space-y-5">
              <button onClick={() => setView('main')} className="flex items-center gap-1.5 text-[#5C5C6E] hover:text-[#8F8FA3] text-sm transition-colors mb-2">
                <ArrowLeft className="w-3.5 h-3.5" /> Back
              </button>
              <h2 className="text-xl font-medium text-[#F2F2F6] tracking-[-0.3px]">Sign in</h2>

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className={labelCls}>Email</label>
                  <input
                    type="email"
                    value={loginForm.email}
                    onChange={(e) => setLoginForm(prev => ({ ...prev, email: e.target.value }))}
                    className={inputCls}
                    placeholder="you@example.com"
                    required
                  />
                </div>

                <div>
                  <label className={labelCls}>Password</label>
                  <div className="relative">
                    <input
                      type={showLoginPassword ? 'text' : 'password'}
                      value={loginForm.password}
                      onChange={(e) => setLoginForm(prev => ({ ...prev, password: e.target.value }))}
                      className={`${inputCls} pr-11`}
                      placeholder="••••••••"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowLoginPassword(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5C5C6E] hover:text-[#8F8FA3] transition-colors"
                    >
                      {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-xs text-[#8F8FA3] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="rounded border-[#2A2A38] bg-transparent text-[#8B5CF6] focus:ring-[#8B5CF6]/30"
                    />
                    Remember me
                  </label>
                  <button
                    type="button"
                    onClick={() => setView('forgot')}
                    className="text-xs text-[#C4B5FD] hover:text-[#F2F2F6] transition-colors"
                  >
                    Forgot password?
                  </button>
                </div>

                <button type="submit" disabled={isLoading} className={heroBtnCls}>
                  {isLoading ? <><Spinner /> Signing in…</> : 'Sign in'}
                </button>
              </form>

              <button onClick={() => setView('signup')} className={ghostBtnCls}>
                No account? Create one
              </button>
            </motion.div>
          )}

          {/* ── Signup ── */}
          {view === 'signup' && (
            <motion.div key="signup" {...enter} className="space-y-5">
              <button onClick={() => setView('main')} className="flex items-center gap-1.5 text-[#5C5C6E] hover:text-[#8F8FA3] text-sm transition-colors mb-2">
                <ArrowLeft className="w-3.5 h-3.5" /> Back
              </button>
              <h2 className="text-xl font-medium text-[#F2F2F6] tracking-[-0.3px]">Create account</h2>

              <form onSubmit={handleSignup} className="space-y-4">
                <div>
                  <label className={labelCls}>Email</label>
                  <input
                    type="email"
                    value={signupForm.email}
                    onChange={(e) => setSignupForm(prev => ({ ...prev, email: e.target.value }))}
                    className={inputCls}
                    placeholder="you@example.com"
                    required
                  />
                </div>

                <div>
                  <label className={labelCls}>Password</label>
                  <div className="relative">
                    <input
                      type={showSignupPassword ? 'text' : 'password'}
                      value={signupForm.password}
                      onChange={(e) => setSignupForm(prev => ({ ...prev, password: e.target.value }))}
                      className={`${inputCls} pr-11`}
                      placeholder="••••••••"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowSignupPassword(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5C5C6E] hover:text-[#8F8FA3] transition-colors"
                    >
                      {showSignupPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <label className="flex items-start gap-2 text-xs text-[#5C5C6E] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={legalConsentChecked}
                    onChange={(e) => setLegalConsentChecked(e.target.checked)}
                    className="mt-0.5 rounded border-[#2A2A38] bg-transparent text-[#8B5CF6] focus:ring-[#8B5CF6]/30"
                    required
                  />
                  <span>
                    I agree to the{' '}
                    <Link href="/privacy-policy" target="_blank" className="text-[#C4B5FD] hover:text-[#F2F2F6] transition-colors">Privacy Policy</Link>
                    {' '}and{' '}
                    <Link href="/community-guidelines" target="_blank" className="text-[#C4B5FD] hover:text-[#F2F2F6] transition-colors">Community Guidelines</Link>.
                  </span>
                </label>

                <button
                  type="submit"
                  disabled={isLoading || !signupForm.email.trim() || !signupForm.password.trim() || !legalConsentChecked}
                  className={heroBtnCls}
                >
                  {isLoading ? <><Spinner /> Creating account…</> : 'Create account'}
                </button>
              </form>

              <button onClick={() => setView('login')} className={ghostBtnCls}>
                Already have an account? Sign in
              </button>
            </motion.div>
          )}

          {/* ── Forgot ── */}
          {view === 'forgot' && (
            <motion.div key="forgot" {...enter} className="space-y-5">
              <button onClick={() => setView('login')} className="flex items-center gap-1.5 text-[#5C5C6E] hover:text-[#8F8FA3] text-sm transition-colors mb-2">
                <ArrowLeft className="w-3.5 h-3.5" /> Back to sign in
              </button>
              <div className="space-y-1">
                <h2 className="text-xl font-medium text-[#F2F2F6] tracking-[-0.3px]">Reset password</h2>
                <p className="text-[#8F8FA3] text-sm">Enter your email and we&apos;ll send a reset link.</p>
              </div>

              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div>
                  <label className={labelCls}>Email</label>
                  <input
                    type="email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    className={inputCls}
                    placeholder="you@example.com"
                    required
                    disabled={forgotLoading}
                  />
                </div>
                <p className="text-xs text-[#5C5C6E]">
                  Only registered accounts can reset passwords. Guest accounts cannot.
                </p>
                <button type="submit" disabled={forgotLoading} className={heroBtnCls}>
                  {forgotLoading ? <><Spinner /> Sending…</> : 'Send reset link'}
                </button>
              </form>
            </motion.div>
          )}

          {/* ── Welcome ── */}
          {view === 'welcome' && (session.user || sessionInfo) && (
            <motion.div
              key="welcome"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              className="space-y-6 text-center"
            >
              {/* Check ring entrance */}
              <div className="flex justify-center">
                <div className="w-14 h-14 rounded-full flex items-center justify-center border border-[#5DCAA5]/30 bg-[#5DCAA5]/10">
                  <CheckCircle className="w-7 h-7 text-[#5DCAA5]" />
                </div>
              </div>

              <div className="space-y-1">
                <h2 className="text-xl font-medium text-[#F2F2F6] tracking-[-0.3px]">
                  {sessionInfo ? 'You\'re in.' : 'Welcome.'}
                </h2>
                <p className="text-[#8F8FA3] text-sm leading-relaxed">
                  {sessionInfo
                    ? 'Browse, like, comment — anonymously. Sign up to create discussions.'
                    : 'Your account is ready. Full access unlocked.'}
                </p>
              </div>

              {(session.user?.anonymousId || sessionInfo?.anonymousId) && (
                <div className="rounded-xl border border-[#23232E] bg-white/[0.02] p-4 space-y-2 text-left">
                  <p className="text-[11px] text-[#5C5C6E] uppercase tracking-wide">Your anonymous ID</p>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[#8F8FA3] font-mono text-xs truncate">
                      {session.user?.anonymousId || sessionInfo?.anonymousId}
                    </span>
                    <button onClick={copyAnonymousId} className="flex-shrink-0 text-[#5C5C6E] hover:text-[#C4B5FD] transition-colors">
                      {copiedId ? <CheckCircle className="w-4 h-4 text-[#5DCAA5]" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-[11px] text-[#5C5C6E]">Save this. It identifies your posts.</p>
                </div>
              )}

              <button onClick={() => router.push(redirectTo)} className={heroBtnCls}>
                Go to feed
              </button>
              <p className="text-[11px] text-[#5C5C6E]">Redirecting in 5 seconds…</p>
            </motion.div>
          )}

          {/* ── Handle picker ── */}
          {view === 'handle-picker' && (
            <motion.div key="handle-picker" {...enter} className="space-y-5">
              <div className="text-center space-y-1">
                <div className="w-12 h-12 mx-auto mb-3 rounded-[16px] flex items-center justify-center"
                  style={{ background: 'linear-gradient(100deg, #231D3D, #3D3555)' }}>
                  <Link2 className="w-5 h-5 text-[#A78BFA]" />
                </div>
                <h2 className="text-xl font-medium text-[#F2F2F6] tracking-[-0.3px]">Claim your handle</h2>
                <p className="text-[#8F8FA3] text-sm">This becomes your inbox link. People send you anonymous messages here.</p>
              </div>

              <div className="space-y-1.5">
                <p className="text-[11px] text-[#5C5C6E]">whisprspace.com/message/</p>
                <div className="relative">
                  <input
                    type="text"
                    value={handleValue}
                    onChange={(e) => onHandleChange(e.target.value)}
                    className={`${inputCls} pr-11`}
                    placeholder="your-handle"
                    maxLength={30}
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={regenerateHandle}
                    title="Generate another"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5C5C6E] hover:text-[#C4B5FD] transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>

                <div className="h-5 flex items-center">
                  {handleAvailability === 'checking' && (
                    <span className="text-xs text-[#5C5C6E] flex items-center gap-1.5">
                      <div className="w-3 h-3 border border-[#5C5C6E] border-t-transparent rounded-full animate-spin" />
                      Checking…
                    </span>
                  )}
                  {handleAvailability === 'available' && (
                    <span className="text-xs text-[#5DCAA5] flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" /> {handleValue} is available
                    </span>
                  )}
                  {handleAvailability === 'taken' && (
                    <span className="text-xs text-[#E24B4A]">That handle is taken. Try another.</span>
                  )}
                  {handleAvailability === 'invalid' && (
                    <span className="text-xs text-[#EF9F27]">Letters, numbers, and hyphens only (3–30 chars)</span>
                  )}
                </div>
              </div>

              <button
                onClick={claimHandle}
                disabled={handleSaving || handleAvailability !== 'available'}
                className={heroBtnCls}
              >
                {handleSaving ? <><Spinner /> Claiming…</> : 'Claim this handle'}
              </button>

              <button onClick={() => setView('welcome')} className={ghostBtnCls}>
                Skip — I&apos;ll set it later
              </button>
            </motion.div>
          )}

          {/* ── Inbox welcome ── */}
          {view === 'inbox-welcome' && (
            <motion.div
              key="inbox-welcome"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              className="space-y-6 text-center"
            >
              <div className="flex justify-center">
                <div className="w-14 h-14 rounded-full flex items-center justify-center border border-[#5DCAA5]/30 bg-[#5DCAA5]/10">
                  <CheckCircle className="w-7 h-7 text-[#5DCAA5]" />
                </div>
              </div>

              <div className="space-y-1">
                <h2 className="text-xl font-medium text-[#F2F2F6] tracking-[-0.3px]">Your inbox is live.</h2>
                <p className="text-[#8F8FA3] text-sm">Share this link and let people tell you the truth — anonymously.</p>
              </div>

              <div className="rounded-xl border border-[#23232E] bg-white/[0.02] p-4 space-y-2 text-left">
                <p className="text-[11px] text-[#5C5C6E] uppercase tracking-wide">Your inbox link</p>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[#8F8FA3] font-mono text-xs truncate">
                    whisprspace.com/message/{claimedHandle}
                  </span>
                  <button onClick={copyInboxLink} className="flex-shrink-0 text-[#5C5C6E] hover:text-[#C4B5FD] transition-colors">
                    {copiedInboxLink ? <CheckCircle className="w-4 h-4 text-[#5DCAA5]" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button onClick={shareInbox} className={heroBtnCls}>
                Share to WhatsApp Status
              </button>

              <button onClick={() => router.push(redirectTo)} className={ghostBtnCls}>
                Go to my feed
              </button>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
};

export default AuthPage;
