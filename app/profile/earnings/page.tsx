'use client'

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUserStore } from '@/store/userStore';
import { ArrowLeft } from 'lucide-react';
import CreatorEarningsDashboard from '@/components/features/creator/CreatorEarningsDashboard';
import { CreatorEarnings, ThreadEarnings } from '@/types';
import { supabase } from '@/lib/core/supabase/client';

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

type EarningsSeries = {
  week: number[];
  month: number[];
  all: number[];
};

export default function CreatorEarningsPage() {
  const router = useRouter();
  const { session } = useUserStore();
  const [earnings, setEarnings] = useState<CreatorEarnings>(emptyEarnings);
  const [threadEarnings, setThreadEarnings] = useState<ThreadEarnings[]>([]);
  const [earningsSeries, setEarningsSeries] = useState<EarningsSeries>({
    week: [0, 0, 0, 0, 0, 0, 0],
    month: [0, 0, 0, 0, 0, 0, 0, 0],
    all: new Array(12).fill(0),
  });
  const [isLoading, setIsLoading] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);

  const userId = session.user?.id || '';

  const nextPayoutDate = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();
  }, []);

  const buildEarningsSeries = (rows: any[]): EarningsSeries => {
    const now = new Date();

    const weekBuckets = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(now);
      date.setDate(now.getDate() - (6 - index));
      date.setHours(0, 0, 0, 0);
      return { date, total: 0 };
    });

    const monthBuckets = Array.from({ length: 8 }, (_, index) => {
      const date = new Date(now);
      date.setDate(now.getDate() - (7 * (7 - index)));
      date.setHours(0, 0, 0, 0);
      return { date, total: 0 };
    });

    const allBuckets = Array.from({ length: 12 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - (11 - index), 1);
      return { date, total: 0 };
    });

    rows.forEach((row) => {
      const amount = Number(row.net_amount || 0);
      if (!amount) return;

      if (!row.created_at) return;
      const createdAt = new Date(row.created_at);

      weekBuckets.forEach((bucket, index) => {
        const nextDay = new Date(bucket.date);
        nextDay.setDate(bucket.date.getDate() + 1);
        if (createdAt >= bucket.date && createdAt < nextDay) {
          weekBuckets[index].total += amount;
        }
      });

      monthBuckets.forEach((bucket, index) => {
        const nextWeek = new Date(bucket.date);
        nextWeek.setDate(bucket.date.getDate() + 7);
        if (createdAt >= bucket.date && createdAt < nextWeek) {
          monthBuckets[index].total += amount;
        }
      });

      allBuckets.forEach((bucket, index) => {
        const nextMonth = new Date(bucket.date.getFullYear(), bucket.date.getMonth() + 1, 1);
        if (createdAt >= bucket.date && createdAt < nextMonth) {
          allBuckets[index].total += amount;
        }
      });
    });

    return {
      week: weekBuckets.map(bucket => Number(bucket.total.toFixed(2))),
      month: monthBuckets.map(bucket => Number(bucket.total.toFixed(2))),
      all: allBuckets.map(bucket => Number(bucket.total.toFixed(2))),
    };
  };

  useEffect(() => {
    if (!userId) return;

    const loadEarnings = async () => {
      setIsLoading(true);

      const { data: earningsRows, error: earningsError } = await supabase
        .from('creator_earnings')
        .select('id, thread_id, amount, platform_fee, net_amount, status, created_at')
        .eq('creator_id', userId);

      if (earningsError) {
        console.error('Failed to load creator earnings:', earningsError);
        setIsLoading(false);
        return;
      }

      const { data: threadsRows, error: threadsError } = await supabase
        .from('threads')
        .select('id, title, price, created_at')
        .eq('creator_id', userId);

      if (threadsError) {
        console.error('Failed to load creator threads:', threadsError);
      }

      const { data: payoutRows } = await supabase
        .from('transaction_ledger')
        .select('occurred_at')
        .eq('payment_provider', 'flutterwave')
        .eq('payment_type', 'payout')
        .eq('status', 'completed')
        .eq('creator_id', userId)
        .order('occurred_at', { ascending: false })
        .limit(1);

      const lastPayoutAt = payoutRows && payoutRows.length > 0 ? payoutRows[0].occurred_at : undefined;

      const rows = earningsRows || [];
      const totalSales = rows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
      const totalEarningsValue = rows.reduce((sum, row) => sum + Number(row.net_amount || 0), 0);
      const pendingEarningsValue = rows
        .filter(row => row.status === 'pending' || row.status === 'processing')
        .reduce((sum, row) => sum + Number(row.net_amount || 0), 0);
      const paidEarningsValue = rows
        .filter(row => row.status === 'paid')
        .reduce((sum, row) => sum + Number(row.net_amount || 0), 0);

      const threadsSold = rows.length;
      const averagePrice = threadsSold > 0 ? totalSales / threadsSold : 0;

      const threadMap = new Map<string, ThreadEarnings>();
      const threadById = new Map<string, { title: string; price: number; created_at: string }>();
      (threadsRows || []).forEach((thread) => {
        threadById.set(thread.id, {
          title: thread.title || 'Untitled Thread',
          price: Number(thread.price || 0),
          created_at: thread.created_at,
        });
      });

      rows.forEach((row) => {
        const threadId = row.thread_id;
        if (!threadId) return;

        const existing = threadMap.get(threadId);
        const threadInfo = threadById.get(threadId);

        const next: ThreadEarnings = existing || {
          threadId,
          threadTitle: threadInfo?.title || 'Unknown Thread',
          price: threadInfo?.price || 0,
          totalSales: 0,
          purchaseCount: 0,
          creatorEarnings: 0,
          platformFees: 0,
          createdAt: threadInfo?.created_at || new Date().toISOString(),
          lastSaleAt: undefined,
        };

        next.totalSales += Number(row.amount || 0);
        next.creatorEarnings += Number(row.net_amount || 0);
        next.platformFees += Number(row.platform_fee || 0);
        next.purchaseCount += 1;
        if (!next.lastSaleAt || new Date(row.created_at) > new Date(next.lastSaleAt)) {
          next.lastSaleAt = row.created_at;
        }

        threadMap.set(threadId, next);
      });

      const threadEarningsList = Array.from(threadMap.values()).sort((a, b) => b.totalSales - a.totalSales);

      setThreadEarnings(threadEarningsList);
      setEarnings({
        userId,
        totalEarnings: totalEarningsValue,
        pendingEarnings: pendingEarningsValue,
        paidEarnings: paidEarningsValue,
        threadsSold,
        totalSales,
        averagePrice,
        lastPayoutAt,
        nextPayoutAt: nextPayoutDate,
      });

      setEarningsSeries(buildEarningsSeries(rows));
      setIsLoading(false);
    };

    loadEarnings();
  }, [userId, nextPayoutDate, refreshToken]);

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
        <CreatorEarningsDashboard
          earnings={earnings}
          threadEarnings={threadEarnings}
          isPremium={session.user?.isPremium || false}
          creatorId={userId}
          earningsSeries={earningsSeries}
          isLoading={isLoading}
          onPayoutRequested={() => setRefreshToken((value) => value + 1)}
        />
      </div>
    </div>
  );
}
