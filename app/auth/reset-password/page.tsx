"use client";

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { Lock, CheckCircle, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { updatePassword } from '@/lib/auth/auth-service';
import { supabase } from '@/lib/core/supabase/client';

const ResetPasswordContent = () => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isValidToken, setIsValidToken] = useState<boolean | null>(null);
  const [resetSuccess, setResetSuccess] = useState(false);

  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useToast();


  useEffect(() => {
    const verifyToken = async () => {

      const timer = setTimeout(async () => {
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
          setIsValidToken(false);
        }
      }, 4000);

      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
          clearTimeout(timer);
          setIsValidToken(true);
        }
      });


      const { data: { session } } = await supabase.auth.getSession();

      if (session) {
        clearTimeout(timer);
        setIsValidToken(true);
      } else {
        // Fallback: Manually parse hash if session isn't found immediately
        // This is necessary for Implicit Flow if the automatic listener misses the event
        const hash = window.location.hash;
        if (hash && hash.includes('access_token')) {
          const params = new URLSearchParams(hash.substring(1)); // remove #
          const accessToken = params.get('access_token');
          const refreshToken = params.get('refresh_token');

          if (accessToken && refreshToken) {
            const { error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });

            if (!error) {
              clearTimeout(timer);
              setIsValidToken(true);
            }
          }
        }
      }

      return () => {
        subscription.unsubscribe();
        clearTimeout(timer);
      };
    };

    verifyToken();
  }, [showToast]);

  const validatePassword = (password: string): { valid: boolean; message: string } => {
    if (password.length < 8) {
      return { valid: false, message: 'Password must be at least 8 characters long' };
    }
    if (!/[A-Z]/.test(password)) {
      return { valid: false, message: 'Password must contain at least one uppercase letter' };
    }
    if (!/[a-z]/.test(password)) {
      return { valid: false, message: 'Password must contain at least one lowercase letter' };
    }
    if (!/[0-9]/.test(password)) {
      return { valid: false, message: 'Password must contain at least one number' };
    }
    return { valid: true, message: '' };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate passwords match
    if (newPassword !== confirmPassword) {
      showToast({
        type: 'error',
        title: 'Passwords Don\'t Match',
        message: 'Please make sure both passwords are the same',
        duration: 4000,
      });
      return;
    }

    // Validate password strength
    const validation = validatePassword(newPassword);
    if (!validation.valid) {
      showToast({
        type: 'error',
        title: 'Weak Password',
        message: validation.message,
        duration: 4000,
      });
      return;
    }

    setIsLoading(true);

    try {
      const result = await updatePassword(newPassword);

      if (result.success) {
        setResetSuccess(true);
        showToast({
          type: 'success',
          title: 'Password Updated!',
          message: result.message,
          duration: 5000,
        });

        // Redirect to login after 3 seconds
        setTimeout(() => {
          router.push('/auth');
        }, 3000);
      } else {
        showToast({
          type: 'error',
          title: 'Update Failed',
          message: result.message,
          duration: 5000,
        });
      }
    } catch (error) {
      console.error('Password reset error:', error);
      showToast({
        type: 'error',
        title: 'Error',
        message: 'An unexpected error occurred. Please try again.',
        duration: 4000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToLogin = () => {
    router.push('/auth');
  };

  if (isValidToken === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Verifying reset link...</p>
        </div>
      </div>
    );
  }

  if (isValidToken === false) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white p-4">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-1">WhisprSpace</h1>
          <p className="text-gray-600 text-md">Speak freely, stay hidden</p>
        </div>

        <div className="w-full max-w-md bg-white rounded-lg p-8 border border-gray-200 shadow-xl">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center space-y-6"
          >
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>

            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Invalid Reset Link</h2>
              <p className="text-gray-600 text-sm">
                This password reset link is invalid or has expired. Please request a new password reset.
              </p>
            </div>

            <button
              onClick={handleBackToLogin}
              className="w-full h-12 rounded-md bg-gradient-to-r from-purple-500 to-orange-500 text-white text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Back to Login
            </button>
          </motion.div>
        </div>
      </div>
    );
  }

  if (resetSuccess) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white p-4">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-1">WhisprSpace</h1>
          <p className="text-gray-600 text-md">Speak freely, stay hidden</p>
        </div>

        <div className="w-full max-w-md bg-white rounded-lg p-8 border border-gray-200 shadow-xl">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center space-y-6"
          >
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>

            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Password Updated!</h2>
              <p className="text-gray-600 text-sm">
                Your password has been successfully updated. You can now log in with your new password.
              </p>
            </div>

            <button
              onClick={handleBackToLogin}
              className="w-full h-12 rounded-md bg-gradient-to-r from-purple-500 to-orange-500 text-white text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Go to Login
            </button>

            <p className="text-xs text-gray-500">
              Redirecting automatically in 3 seconds...
            </p>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white p-4">
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-1">WhisprSpace</h1>
        <p className="text-gray-600 text-md">Speak freely, stay hidden</p>
      </div>

      <div className="w-full max-w-md bg-white rounded-lg p-8 border border-gray-200 shadow-xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="text-center">
            <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock className="w-8 h-8 text-purple-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Set New Password</h2>
            <p className="text-gray-600 text-sm">
              Create a strong password for your account
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-gray-700 mb-2 text-sm font-medium">New Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full h-11 bg-white border border-gray-300 rounded-md px-4 py-2 pr-10 text-gray-900 text-sm focus:outline-none focus:border-purple-500"
                  placeholder="Enter new password"
                  required
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-gray-700 mb-2 text-sm font-medium">Confirm Password</label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full h-11 bg-white border border-gray-300 rounded-md px-4 py-2 pr-10 text-gray-900 text-sm focus:outline-none focus:border-purple-500"
                  placeholder="Confirm new password"
                  required
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2">
              <p className="text-xs font-semibold text-blue-900">Password Requirements:</p>
              <ul className="text-xs text-blue-800 space-y-1 ml-4 list-disc">
                <li>At least 8 characters long</li>
                <li>Contains uppercase letter (A-Z)</li>
                <li>Contains lowercase letter (a-z)</li>
                <li>Contains number (0-9)</li>
              </ul>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-11 rounded-md bg-gradient-to-r from-purple-500 to-orange-500 text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Updating Password...
                </>
              ) : (
                'Update Password'
              )}
            </button>

            <button
              type="button"
              onClick={handleBackToLogin}
              disabled={isLoading}
              className="w-full text-sm text-purple-600 hover:text-orange-500 transition-colors disabled:opacity-50"
            >
              Back to Login
            </button>
          </form>
        </motion.div>
      </div>
    </div>
  );
};

const ResetPasswordPage = () => {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <ResetPasswordContent />
    </Suspense>
  );
};

export default ResetPasswordPage;
