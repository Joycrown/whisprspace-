"use client";

import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUserStore } from '@/store/userStore';
import { motion } from 'framer-motion';
import { UserCheck, Shield, Zap, Copy, CheckCircle, Eye, EyeOff } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';

const AuthPage = () => {
  const [view, setView] = useState<'main' | 'anonymous' | 'login' | 'signup' | 'forgot' | 'welcome'>('main');
  const [copiedId, setCopiedId] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Form states
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [signupForm, setSignupForm] = useState({ email: '', password: '' });
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);

  const { loginAnonymously, login, signup, session, sessionInfo, isLoading, error, clearError, sessionValidated } = useUserStore();
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

  useEffect(() => {
    if (!viewParam) return;
    if (viewParam === 'login' || viewParam === 'signup' || viewParam === 'anonymous' || viewParam === 'main') {
      setView(viewParam as typeof view);
    }
  }, [viewParam]);

  // CRITICAL: Immediate redirect check using useLayoutEffect (runs synchronously before paint)
  // This executes before any other effects and before the component fully renders
  useLayoutEffect(() => {
    if (forceAuth) return;
    // Only redirect if session is already validated and exists
    const currentState = useUserStore.getState();
    if (currentState.sessionValidated && (currentState.session.isAuthenticated || currentState.sessionInfo)) {
      window.location.replace(redirectTo);
      return;
    }
  }, [redirectTo, forceAuth]);

  useEffect(() => {
    if (forceAuth) return;
    if ((session.isAuthenticated || sessionInfo) && view === 'welcome') {
      const timer = setTimeout(() => {
        router.push(redirectTo);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [session.isAuthenticated, sessionInfo?.anonymousId, view, router, redirectTo, forceAuth]);

  const handleAnonymousJoin = async () => {
    clearError(); // Clear previous errors
    await loginAnonymously();
  };

  // Auto-switch to welcome view when login succeeds
  useEffect(() => {
    if ((sessionInfo || session.user) && (view === 'anonymous' || view === 'main') && !isLoading) {
      setView('welcome');
      // Show success toast
      const isAnonymous = sessionInfo !== null;
      showToast({
        type: 'success',
        title: isAnonymous ? 'Anonymous Session Created!' : 'Welcome Back!',
        message: isAnonymous
          ? 'You can now browse, like, and comment. Sign up to create threads!'
          : 'You now have full access to all features.',
        duration: 4000,
      });
    }
  }, [sessionInfo?.anonymousId, session.user?.id, view, isLoading, showToast]);

  // Auto-redirect if already authenticated (only after AuthProvider validates)
  const hasRedirected = useRef(false);

  useEffect(() => {
    if (forceAuth) return;
    if (!sessionValidated) {
      // Still waiting for validation
      return
    }

    // Prevent multiple redirects
    if (hasRedirected.current) {
      return
    }

    // Session has been validated
    const hasSession = sessionInfo !== null || session.isAuthenticated

    if (hasSession) {
      // Valid session found - redirect to threads with hard navigation
      hasRedirected.current = true  // Mark as redirected
      // Use replace instead of href - more forceful, replaces history entry, cannot be interrupted  
      window.location.replace(redirectTo)
      // Return immediately to stop any further code execution
      return
    } else {
      // No valid session - make sure localStorage is cleared

    }
  }, [sessionValidated, sessionInfo?.anonymousId, session.isAuthenticated, redirectTo, forceAuth])

  // Display error as toast
  useEffect(() => {
    if (error) {
      showToast({
        type: 'error',
        title: 'Authentication Error',
        message: error,
        duration: 5000,
      });
      // Clear error after showing toast
      setTimeout(() => clearError(), 100);
    }
  }, [error, showToast, clearError]);

  // Clear error when view changes
  useEffect(() => {
    clearError();
  }, [view, clearError]);

  const copyAnonymousId = () => {
    const id = session.user?.anonymousId || sessionInfo?.anonymousId;
    if (id) {
      navigator.clipboard.writeText(id);
      setCopiedId(true);
      showToast({
        type: 'success',
        title: 'Copied!',
        message: 'Anonymous ID copied to clipboard',
        duration: 2000,
      });
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError(); // Clear previous errors
    await login(loginForm.email, loginForm.password);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError(); // Clear previous errors
    await signup(signupForm.email, signupForm.password);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!forgotEmail.trim()) {
      showToast({
        type: 'error',
        title: 'Email Required',
        message: 'Please enter your email address',
        duration: 3000,
      });
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(forgotEmail)) {
      showToast({
        type: 'error',
        title: 'Invalid Email',
        message: 'Please enter a valid email address',
        duration: 3000,
      });
      return;
    }

    setForgotLoading(true);

    try {

      const { requestPasswordReset } = await import('@/lib/auth/auth-service');
      const result = await requestPasswordReset(forgotEmail);

      if (result.success) {
        showToast({
          type: 'success',
          title: 'Reset Link Sent',
          message: result.message,
          duration: 8000,
        });



        // Clear form and go back to login after success
        setForgotEmail('');
        setTimeout(() => {
          setView('login');
        }, 3000);
      } else {
        // Show detailed error with SMTP setup instructions
        showToast({
          type: 'error',
          title: 'Reset Failed',
          message: result.message,
          duration: 8000,
        });


      }
    } catch (error) {
      console.error('Forgot password error:', error);
      showToast({
        type: 'error',
        title: 'Error',
        message: 'An unexpected error occurred. Please try again.',
        duration: 4000,
      });
    } finally {
      setForgotLoading(false);
    }
  };

  const skipToApp = () => {
    router.push(redirectTo);
  };

  // Render blocking redirect if session is valid
  // This prevents the auth form from rendering and potentially causing state issues or race conditions
  if (!forceAuth && sessionValidated && (sessionInfo || session.isAuthenticated)) {
    return (
      <div className="min-h-screen bg-[#121212] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-400">Redirecting to WhisprSpace...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-[100dvh] flex flex-col items-center justify-center bg-white px-4 py-6 sm:py-10"
    >
      {/* Logo and Tagline */}
      <div className="mb-6 sm:mb-8 text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-1">WhisprSpace</h1>
        <p className="text-gray-600 text-md">Speak freely, stay hidden</p>
      </div>

      {/* Auth Card */}
      <div className="w-full max-w-md bg-white rounded-lg p-8 border border-gray-200 shadow-xl">
        {view === 'main' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center space-y-6"
          >
            <div className="space-y-2">
              <h2 className="text-3xl font-bold text-gray-900">Get Started</h2>
              <p className="text-gray-600 text-sm">
                Join WhisprSpace and express yourself freely
              </p>
            </div>

            {/* Primary CTAs - Login & Signup */}
            <div className="space-y-3">
              <button
                onClick={() => setView('signup')}
                className="w-full h-14 rounded-lg bg-gradient-to-r from-purple-500 to-orange-500 text-white text-base font-semibold hover:opacity-90 transition-opacity shadow-lg"
              >
                Create Account
              </button>

              <button
                onClick={() => setView('login')}
                className="w-full h-14 rounded-lg bg-gray-900 text-white text-base font-semibold hover:bg-gray-800 transition-colors"
              >
                Log In
              </button>
            </div>

            {/* Benefits */}
            <div className="pt-2 space-y-3">
              <div className="flex items-center gap-3 text-sm text-gray-700">
                <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <Zap className="w-4 h-4 text-purple-600" />
                </div>
                <span className="text-left">Create threads and start discussions</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-gray-700">
                <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <UserCheck className="w-4 h-4 text-orange-600" />
                </div>
                <span className="text-left">Join supportive, honest conversations</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-gray-700">
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <Shield className="w-4 h-4 text-green-600" />
                </div>
                <span className="text-left">Full access to all features</span>
              </div>
            </div>

            {/* Secondary Option - Anonymous */}
            <div className="pt-4 border-t border-gray-200">
              <p className="text-sm text-gray-500 mb-2">Just want to explore?</p>
              <button
                onClick={() => setView('anonymous')}
                className="text-sm text-gray-600 hover:text-purple-600 transition-colors font-medium"
              >
                Continue as a Guest →
              </button>
            </div>
          </motion.div>
        )}

        {view === 'anonymous' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center space-y-6"
          >
            <div className="space-y-4">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-orange-500 rounded-full flex items-center justify-center mx-auto">
                <Shield className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Join as a Guest</h2>
              <p className="text-gray-600 text-sm leading-relaxed">
                Start expressing yourself freely without revealing your identity. No email, no personal data required.
              </p>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-3 text-sm text-gray-600">
                <UserCheck className="w-5 h-5 text-green-600" />
                <span>Instant guest identity</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-gray-600">
                <Shield className="w-5 h-5 text-purple-600" />
                <span>Complete privacy protection</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-gray-600">
                <Zap className="w-5 h-5 text-orange-600" />
                <span>Join conversations instantly</span>
              </div>
            </div>

            <button
              onClick={handleAnonymousJoin}
              disabled={isLoading}
              className="w-full h-12 rounded-md bg-gradient-to-r from-purple-500 to-orange-500 text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Shield className="w-4 h-4" />
                  Join as a Guest
                </>
              )}
            </button>

            <div className="pt-4 border-t border-gray-200">
              <button
                onClick={() => setView('main')}
                className="text-sm text-gray-600 hover:text-purple-600 transition-colors font-medium"
              >
                ← Back to Sign In Options
              </button>
            </div>
          </motion.div>
        )}

        {view === 'welcome' && (session.user || sessionInfo) && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center space-y-6"
          >
            <div className="space-y-4">
              <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-blue-500 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Welcome to WhisprSpace!</h2>
              <p className="text-gray-600 text-sm">
                {sessionInfo
                  ? "Your anonymous session has been created. You can browse, like, and comment. Sign up to create threads!"
                  : "Your account has been created. You now have full access to create and manage threads!"}
              </p>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Your Anonymous ID</p>
              <div className="flex items-center justify-between bg-white rounded-md p-3 border border-gray-200">
                <span className="text-gray-900 font-mono text-sm">
                  {session.user?.anonymousId || sessionInfo?.anonymousId}
                </span>
                <button
                  onClick={copyAnonymousId}
                  className="p-1 hover:bg-white/10 rounded transition-colors"
                >
                  {copiedId ? (
                    <CheckCircle className="w-4 h-4 text-green-400" />
                  ) : (
                    <Copy className="w-4 h-4 text-gray-500" />
                  )}
                </button>
              </div>
              <p className="text-xs text-gray-500">
                {sessionInfo
                  ? "Save this ID. Sign up to keep your contributions and unlock thread creation!"
                  : "Save this ID to identify your posts. You have full access to all features!"}
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-gray-900">
                {sessionInfo ? "What You Can Do" : "Quick Tour"}
              </h3>
              <div className="text-left space-y-2 text-sm text-gray-600">
                {sessionInfo ? (
                  <>
                    <div className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 bg-green-500 rounded-full mt-2 flex-shrink-0" />
                      <span>✅ Browse and discover threads</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 bg-green-500 rounded-full mt-2 flex-shrink-0" />
                      <span>✅ Like and react to posts</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 bg-green-500 rounded-full mt-2 flex-shrink-0" />
                      <span>✅ Comment on discussions</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 bg-orange-400 rounded-full mt-2 flex-shrink-0" />
                      <span>🔒 Create threads (sign up required)</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 bg-purple-400 rounded-full mt-2 flex-shrink-0" />
                      <span>Create threads to share thoughts and start discussions</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 bg-purple-400 rounded-full mt-2 flex-shrink-0" />
                      <span>Vote on polls and participate in community decisions</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 bg-purple-400 rounded-full mt-2 flex-shrink-0" />
                      <span>Join group spaces for focused conversations</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 bg-purple-400 rounded-full mt-2 flex-shrink-0" />
                      <span>Build trust through thoughtful participation</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            <button
              onClick={skipToApp}
              className="w-full h-12 rounded-md bg-gradient-to-r from-purple-500 to-orange-500 text-white text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Start Exploring
            </button>

            <p className="text-xs text-gray-500">
              Redirecting automatically in 5 seconds...
            </p>
          </motion.div>
        )}

        {view !== 'forgot' && view !== 'anonymous' && view !== 'welcome' && view !== 'main' && (
          <div className="grid grid-cols-3 gap-2 mb-6 w-full sm:flex sm:justify-center sm:gap-4">
            <button
              className={`w-full sm:w-auto px-2 sm:px-4 py-2 text-xs sm:text-sm rounded-md transition-colors whitespace-nowrap ${view === 'login' ? 'text-white bg-purple-600' : 'text-gray-600 hover:text-gray-900'}`}
              onClick={() => setView('login')}
            >
              Log In
            </button>
            <button
              className={`w-full sm:w-auto px-2 sm:px-4 py-2 text-xs sm:text-sm rounded-md transition-colors whitespace-nowrap ${view === 'signup' ? 'text-white bg-purple-600' : 'text-gray-600 hover:text-gray-900'}`}
              onClick={() => setView('signup')}
            >
              Sign Up
            </button>
            <button
              className="w-full sm:w-auto px-2 sm:px-4 py-2 text-xs sm:text-sm rounded-md transition-colors text-gray-600 hover:text-gray-900 whitespace-nowrap"
              onClick={() => setView('main')}
            >
              ← Back
            </button>
          </div>
        )}

        {view === 'login' && (
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-gray-700 mb-2 text-sm">Email address</label>
              <input
                type="email"
                value={loginForm.email}
                onChange={(e) => setLoginForm(prev => ({ ...prev, email: e.target.value }))}
                className="w-full h-11 bg-white border border-gray-300 rounded-md px-4 py-2 text-gray-900 text-sm focus:outline-none focus:border-purple-500"
                placeholder="Enter your email"
                required
              />
            </div>

            <div>
              <label className="block text-gray-700 mb-2 text-sm">Password</label>
              <div className="relative">
                <input
                  type={showLoginPassword ? 'text' : 'password'}
                  value={loginForm.password}
                  onChange={(e) => setLoginForm(prev => ({ ...prev, password: e.target.value }))}
                  className="w-full h-11 bg-white border border-gray-300 rounded-md px-4 py-2 pr-11 text-gray-900 text-sm focus:outline-none focus:border-purple-500"
                  placeholder="Enter your password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowLoginPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-colors"
                  aria-label={showLoginPassword ? 'Hide password' : 'Show password'}
                >
                  {showLoginPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="remember"
                  className="rounded bg-white border-gray-300 text-purple-600 focus:ring-purple-600"
                />
                <label htmlFor="remember" className="ml-2 text-sm text-gray-700">
                  Remember me
                </label>
              </div>
              <button
                type="button"
                onClick={() => setView('forgot')}
                className="text-sm text-purple-600 hover:text-orange-500 transition-colors"
              >
                Forgot password?
              </button>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-11 rounded-md bg-gradient-to-r from-purple-500 to-orange-500 text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>
        )}

        {view === 'signup' && (
          <form onSubmit={handleSignup} className="space-y-6">
            <div>
              <label className="block text-gray-700 mb-2 text-sm">Email address</label>
              <input
                type="email"
                value={signupForm.email}
                onChange={(e) => setSignupForm(prev => ({ ...prev, email: e.target.value }))}
                className="w-full h-11 bg-white border border-gray-300 rounded-md px-4 py-2 text-gray-900 text-sm focus:outline-none focus:border-[#7E22CE]"
                placeholder="Enter your email"
                required
              />
            </div>

            <div>
              <label className="block text-gray-700 mb-2 text-sm">Password</label>
              <input
                type="password"
                value={signupForm.password}
                onChange={(e) => setSignupForm(prev => ({ ...prev, password: e.target.value }))}
                className="w-full h-11 bg-white border border-gray-300 rounded-md px-4 py-2 text-gray-900 text-sm focus:outline-none focus:border-[#7E22CE]"
                placeholder="Choose a password"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-11 rounded-md bg-gradient-to-r from-purple-500 to-orange-500 text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Creating account...
                </>
              ) : (
                'Create Account'
              )}
            </button>
          </form>
        )}

        {view === 'forgot' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="text-center mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Reset Password</h2>
              <p className="text-gray-600 text-sm">Enter your email address to receive a password reset link</p>
            </div>

            <form onSubmit={handleForgotPassword} className="space-y-6">
              <div>
                <label className="block text-gray-700 mb-2 text-sm">Email address</label>
                <input
                  type="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  className="w-full h-11 bg-white border border-gray-300 rounded-md px-4 py-2 text-gray-900 text-sm focus:outline-none focus:border-purple-500"
                  placeholder="Enter your email"
                  required
                  disabled={forgotLoading}
                />
              </div>

              <div className="space-y-2">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-xs text-blue-800">
                    💡 <strong>Note:</strong> Password reset is only available for registered accounts. Guests accounts cannot reset passwords.
                  </p>
                </div>

              </div>

              <button
                type="submit"
                disabled={forgotLoading}
                className="w-full h-11 rounded-md bg-gradient-to-r from-purple-500 to-orange-500 text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {forgotLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Sending...
                  </>
                ) : (
                  'Send Reset Link'
                )}
              </button>

              <button
                type="button"
                onClick={() => setView('login')}
                disabled={forgotLoading}
                className="w-full text-sm text-purple-600 hover:text-orange-500 transition-colors disabled:opacity-50"
              >
                Back to Login
              </button>
            </form>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default AuthPage;
