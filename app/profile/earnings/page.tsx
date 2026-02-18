'use client'

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUserStore } from '@/store/userStore';
import { ArrowLeft } from 'lucide-react';
import CreatorEarningsDashboard from '@/components/features/creator/CreatorEarningsDashboard';
import {
  CreatorEarnings,
  CreatorEarningsResponse,
  CreatorEarningsSeries,
  CreatorEarningsTransaction,
  ThreadEarnings,
} from '@/types';
import { supabase } from '@/lib/core/supabase/client';
import * as rawAuth from '@/lib/core/supabase/raw-auth';

const emptyEarnings: CreatorEarnings = {
  userId: '',
  totalEarnings: 0,
  pendingEarnings: 0,
  paidEarnings: 0,
  threadsSold: 0,
  totalSales: 0,
  averagePrice: 0,
  lastPayoutAt: undefined,
  nextPayoutAt: undefined,
};

const emptyEarningsSeries: CreatorEarningsSeries = {
  week: [0, 0, 0, 0, 0, 0, 0],
  month: [0, 0, 0, 0, 0, 0, 0, 0],
  all: Array.from({ length: 12 }, () => 0),
};

export default function CreatorEarningsPage() {
  const router = useRouter();
  const { session, sessionValidated } = useUserStore();
  const [earnings, setEarnings] = useState<CreatorEarnings>(emptyEarnings);
  const [threadEarnings, setThreadEarnings] = useState<ThreadEarnings[]>([]);
  const [earningsSeries, setEarningsSeries] = useState<CreatorEarningsSeries>(emptyEarningsSeries);
  const [recentTransactions, setRecentTransactions] = useState<CreatorEarningsTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  const userId = session.user?.id || '';

  useEffect(() => {
    if (sessionValidated && !session.user) {
      router.push('/auth');
    }
  }, [sessionValidated, session.user, router]);

  useEffect(() => {
    if (!userId) {
      setEarnings(emptyEarnings);
      setThreadEarnings([]);
      setEarningsSeries(emptyEarningsSeries);
      setRecentTransactions([]);
      setLoadError(null);
      return;
    }

    let isMounted = true;

    const loadEarnings = async () => {
      setIsLoading(true);
      setLoadError(null);

      try {
        const buildAuthHeaders = async (): Promise<HeadersInit> => {
          const headers: HeadersInit = {};
          const rawSession = rawAuth.getSession();
          if (rawSession?.access_token) {
            headers.Authorization = `Bearer ${rawSession.access_token}`;
            return headers;
          }

          // Fallback for flows that use Supabase SSR/SDK session
          const { data: { session: authSession } } = await supabase.auth.getSession();
          if (authSession?.access_token) {
            headers.Authorization = `Bearer ${authSession.access_token}`;
          }
          return headers;
        };

        const fetchEarnings = async (headers: HeadersInit) => {
          return fetch('/api/creator/earnings', {
            method: 'GET',
            headers,
            credentials: 'include',
            cache: 'no-store',
          });
        };

        const headers = await buildAuthHeaders();
        let response = await fetchEarnings(headers);

        if (response.status === 401) {
          // Retry once after token refresh in case the local token expired
          const refreshed = await rawAuth.refreshToken();
          if (refreshed?.session?.access_token) {
            response = await fetchEarnings({
              ...headers,
              Authorization: `Bearer ${refreshed.session.access_token}`,
            });
          }
        }

        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(payload?.error || 'Failed to load earnings data');
        }

        const data = payload as CreatorEarningsResponse;
        if (!isMounted) return;

        setEarnings(data.earnings || { ...emptyEarnings, userId });
        setThreadEarnings(data.threadEarnings || []);
        setEarningsSeries(data.earningsSeries || emptyEarningsSeries);
        setRecentTransactions(data.recentTransactions || []);
      } catch (error) {
        console.error('Failed to load earnings dashboard:', error);
        if (!isMounted) return;
        setLoadError(error instanceof Error ? error.message : 'Failed to load earnings data');
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadEarnings();

    return () => {
      isMounted = false;
    };
  }, [userId, refreshToken]);

  return (
    <div className="min-h-screen bg-[#121212]">
      {/* Header with Back Button */}
      <div className="sticky top-0 z-10 bg-[#121212]/95 backdrop-blur-sm border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">Back</span>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-8 pb-28 md:pb-8">
        {loadError && (
          <div className="mb-6 rounded-xl border border-red-800 bg-red-950/50 p-4 text-red-100">
            <p className="font-medium">Failed to load earnings</p>
            <p className="mt-1 text-sm text-red-200">{loadError}</p>
            <button
              onClick={() => setRefreshToken((value) => value + 1)}
              className="mt-3 rounded-md bg-red-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-600 transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        <CreatorEarningsDashboard
          earnings={earnings}
          threadEarnings={threadEarnings}
          isPremium={session.user?.isPremium || false}
          creatorId={userId}
          earningsSeries={earningsSeries}
          recentTransactions={recentTransactions}
          isLoading={isLoading}
          onPayoutRequested={() => setRefreshToken((value) => value + 1)}
        />
      </div>
    </div>
  );
}
