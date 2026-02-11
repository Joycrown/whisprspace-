'use client';

import React, { useState } from 'react';
import {
  DollarSign,
  TrendingUp,
  Clock,
  CheckCircle,
  BarChart3,
  Download,
  Eye,
  Users,
  Sparkles
} from 'lucide-react';
import { CreatorEarnings, ThreadEarnings } from '@/types';

interface CreatorEarningsDashboardProps {
  earnings: CreatorEarnings;
  threadEarnings: ThreadEarnings[];
  isPremium: boolean;
  creatorId?: string;
  earningsSeries?: {
    week: number[];
    month: number[];
    all: number[];
  };
  isLoading?: boolean;
  onPayoutRequested?: () => void;
}

export default function CreatorEarningsDashboard({
  earnings,
  threadEarnings,
  isPremium,
  creatorId,
  earningsSeries,
  isLoading,
  onPayoutRequested
}: CreatorEarningsDashboardProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | 'all'>('month');
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [payoutLoading, setPayoutLoading] = useState(false);
  const [payoutError, setPayoutError] = useState<string | null>(null);
  const [bankCode, setBankCode] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [narration, setNarration] = useState('');

  // Mock data for earnings chart (would come from backend)
  const earningsData = {
    week: [12, 18, 15, 22, 28, 35, 42],
    month: [120, 150, 180, 210, 240, 280, 320, 360],
    all: [500, 750, 1200, 1800, 2200, 2800, 3200]
  };

  const chartData = earningsSeries || earningsData;

  const handlePayoutRequest = async () => {
    if (!creatorId) {
      setPayoutError('Unable to identify creator.');
      return;
    }

    if (!bankCode || !accountNumber) {
      setPayoutError('Bank code and account number are required.');
      return;
    }

    if (earnings.pendingEarnings < 10) {
      setPayoutError('Pending balance is below the payout threshold.');
      return;
    }

    setPayoutLoading(true);
    setPayoutError(null);

    try {
      const response = await fetch('/api/flutterwave/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creatorId,
          accountBank: bankCode,
          accountNumber,
          currency,
          narration: narration || 'Creator payout',
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => null);
        setPayoutError(error?.error || 'Failed to request payout.');
        setPayoutLoading(false);
        return;
      }

      setShowPayoutModal(false);
      setBankCode('');
      setAccountNumber('');
      setNarration('');
      onPayoutRequested?.();
    } catch (error) {
      setPayoutError('Failed to request payout.');
    } finally {
      setPayoutLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-purple-500 to-orange-500 rounded-lg">
              <DollarSign className="text-white" size={28} />
            </div>
            Creator Earnings
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Track your premium thread revenue and payouts
          </p>
        </div>

        {!isPremium && (
          <div className="bg-orange-100 dark:bg-orange-900/20 border border-orange-500 rounded-lg px-4 py-2">
            <p className="text-sm font-medium text-orange-800 dark:text-orange-200">
              Earning at 50% rate • Upgrade for 70%
            </p>
          </div>
        )}
      </div>

      {/* Earnings Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Total Earnings */}
        <div className="bg-gradient-to-br from-purple-600 to-orange-500 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={20} />
            <span className="text-sm font-medium">Total Earnings</span>
          </div>
          <div className="text-4xl font-bold mb-2">
            {isLoading ? '--' : `$${earnings.totalEarnings.toFixed(2)}`}
          </div>
          <div className="flex items-center gap-2 text-sm text-purple-100">
            <Sparkles size={14} />
            <span>{isLoading ? '--' : `${earnings.threadsSold} threads sold`}</span>
          </div>
        </div>

        {/* Pending Earnings */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border-2 border-gray-200 dark:border-gray-700 shadow-lg">
          <div className="flex items-center gap-2 mb-2 text-gray-600 dark:text-gray-400">
            <Clock size={20} />
            <span className="text-sm font-medium">Pending</span>
          </div>
          <div className="text-4xl font-bold text-orange-500 dark:text-orange-400 mb-2">
            {isLoading ? '--' : `$${earnings.pendingEarnings.toFixed(2)}`}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Next payout: {earnings.nextPayoutAt ? new Date(earnings.nextPayoutAt).toLocaleDateString() : 'TBD'}
          </div>
        </div>

        {/* Paid Out */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border-2 border-gray-200 dark:border-gray-700 shadow-lg">
          <div className="flex items-center gap-2 mb-2 text-gray-600 dark:text-gray-400">
            <CheckCircle size={20} />
            <span className="text-sm font-medium">Paid Out</span>
          </div>
          <div className="text-4xl font-bold text-purple-600 dark:text-purple-400 mb-2">
            {isLoading ? '--' : `$${earnings.paidEarnings.toFixed(2)}`}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Last: {earnings.lastPayoutAt ? new Date(earnings.lastPayoutAt).toLocaleDateString() : 'Never'}
          </div>
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border-2 border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <BarChart3 className="text-purple-500" size={24} />
          Performance Metrics
        </h2>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Sales</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {isLoading ? '--' : `$${earnings.totalSales.toFixed(2)}`}
            </p>
          </div>

          <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Threads Sold</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {isLoading ? '--' : earnings.threadsSold}
            </p>
          </div>

          <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Avg. Price</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {isLoading ? '--' : `$${earnings.averagePrice.toFixed(2)}`}
            </p>
          </div>

          <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Revenue Share</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {isPremium ? '70%' : '50%'}
            </p>
          </div>
        </div>
      </div>

      {/* Earnings Chart */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border-2 border-gray-200 dark:border-gray-700">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Earnings Over Time
          </h2>

          <div className="flex gap-2 self-start sm:self-auto">
            {(['week', 'month', 'all'] as const).map((period) => (
              <button
                key={period}
                onClick={() => setSelectedPeriod(period)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${selectedPeriod === period
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
              >
                {period === 'week' ? 'Week' : period === 'month' ? 'Month' : 'All Time'}
              </button>
            ))}
          </div>
        </div>

        {/* Simple Bar Chart */}
        <div className="h-64 flex items-end justify-between gap-2">
          {chartData[selectedPeriod].map((value, index) => {
            const maxValue = Math.max(...chartData[selectedPeriod]);
            const height = maxValue > 0 ? (value / maxValue) * 100 : 5;

            return (
              <div key={index} className="flex-1 flex flex-col items-center gap-2">
                <div className="w-full relative group">
                  <div
                    className="w-full bg-gradient-to-t from-purple-500 to-orange-500 rounded-t-lg transition-all hover:from-purple-600 hover:to-orange-600 cursor-pointer"
                    style={{ height: `${height}%`, minHeight: '20px' }}
                  >
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                      ${value}
                    </div>
                  </div>
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {selectedPeriod === 'week' ? `D${index + 1}` : selectedPeriod === 'month' ? `W${index + 1}` : `M${index + 1}`}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Thread Earnings Breakdown */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border-2 border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Eye className="text-purple-500" size={24} />
            Thread Earnings Breakdown
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Thread
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Price
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Sales
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Total Revenue
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Your Earnings
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {threadEarnings.length > 0 ? (
                threadEarnings.map((thread) => (
                  <tr key={thread.threadId} className="hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="max-w-xs">
                        <p className="font-medium text-gray-900 dark:text-white truncate">
                          {thread.threadTitle}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          Created {new Date(thread.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-900 dark:text-white font-medium">
                      ${thread.price.toFixed(2)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Users size={16} className="text-gray-400" />
                        <span className="text-gray-900 dark:text-white font-medium">
                          {thread.purchaseCount}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-900 dark:text-white font-medium">
                      ${thread.totalSales.toFixed(2)}
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-green-600 dark:text-green-400 font-bold">
                        ${thread.creatorEarnings.toFixed(2)}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="p-4 bg-gray-100 dark:bg-gray-900 rounded-full">
                        <DollarSign className="text-gray-400" size={32} />
                      </div>
                      <p className="text-gray-600 dark:text-gray-400">
                        No earnings yet. Create your first premium thread to start earning!
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div >

      {/* Payout Information */}
      <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-6 border-2 border-purple-200 dark:border-purple-800">
        <h3 className="font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
          <Download className="text-purple-500" size={20} />
          Payout Information
        </h3>
        <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
          <p>• Payouts are processed <strong>monthly</strong> on the 1st of each month</p>
          <p>• Minimum payout threshold: <strong>$10.00</strong></p>
          <p>• Earnings are held for <strong>7 days</strong> after sale (refund protection)</p>
          <p>• Payment method: Flutterwave transfer</p>
        </div>
        {
          earnings.pendingEarnings >= 10 && (
            <button
              onClick={() => {
                setPayoutError(null);
                setShowPayoutModal(true);
              }}
              className="mt-4 w-full py-2 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 transition-colors"
            >
              Request Payout
            </button>
          )
        }
      </div>

      {/* Payout Request Modal */}
      {
        showPayoutModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 pb-20 sm:pb-4">
            <div className="relative w-full max-w-md max-h-[85vh] sm:max-h-[90vh] bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-4 sm:p-6 overflow-y-auto mb-4 sm:mb-0">
              <button
                onClick={() => setShowPayoutModal(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
              >
                ✕
              </button>

              <div className="mb-6">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-100 dark:bg-purple-900/20 rounded-full mb-4">
                  <Download className="text-purple-600 dark:text-purple-400" size={32} />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  Request Payout
                </h2>
                <p className="text-gray-600 dark:text-gray-400">
                  Withdraw your pending earnings to your bank account
                </p>
              </div>

              <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Pending Balance:</span>
                  <span className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                    ${earnings.pendingEarnings.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Processing Fee:</span>
                  <span className="text-gray-900 dark:text-white font-medium">$0.00</span>
                </div>
                <div className="border-t border-gray-200 dark:border-gray-700 mt-3 pt-3 flex justify-between items-center">
                  <span className="font-medium text-gray-900 dark:text-white">You'll Receive:</span>
                  <span className="text-xl font-bold text-gray-900 dark:text-white">
                    ${earnings.pendingEarnings.toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="mb-6 p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  <strong>Payment Method:</strong> Flutterwave<br />
                  <strong>Processing Time:</strong> 2-5 business days<br />
                  <strong>Next Available:</strong> {earnings.nextPayoutAt ? new Date(earnings.nextPayoutAt).toLocaleDateString() : 'TBD'}
                </p>
              </div>

              <div className="space-y-4 mb-6">
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-3 text-xs text-gray-600 dark:text-gray-300">
                  Bank details are used only to process this payout and are not stored by WhisprSpace.
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Bank Code
                  </label>
                  <input
                    type="text"
                    value={bankCode}
                    onChange={(e) => setBankCode(e.target.value)}
                    placeholder="e.g. 044"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Account Number
                  </label>
                  <input
                    type="text"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    placeholder="Account number"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Currency
                    </label>
                    <input
                      type="text"
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                      placeholder="USD"
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Narration (optional)
                    </label>
                    <input
                      type="text"
                      value={narration}
                      onChange={(e) => setNarration(e.target.value)}
                      placeholder="Creator payout"
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                </div>

                {payoutError && (
                  <p className="text-sm text-red-500">{payoutError}</p>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowPayoutModal(false)}
                  className="flex-1 py-3 px-4 border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handlePayoutRequest}
                  disabled={payoutLoading}
                  className="flex-1 py-3 px-4 bg-gradient-to-r from-purple-600 to-orange-500 text-white rounded-lg font-medium hover:from-purple-700 hover:to-orange-600 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  <Download size={18} />
                  {payoutLoading ? 'Processing...' : 'Confirm Payout'}
                </button>
              </div>
            </div>
          </div>
        )
      }
    </div >
  );
}

