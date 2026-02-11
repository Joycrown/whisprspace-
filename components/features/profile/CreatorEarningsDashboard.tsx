'use client'

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { 
  DollarSign, 
  TrendingUp, 
  Eye, 
  Users, 
  Crown,
  Calendar,
  Download,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';

interface EarningsData {
  totalEarnings: number;
  monthlyEarnings: number;
  weeklyEarnings: number;
  todayEarnings: number;
  totalSales: number;
  totalViews: number;
  conversionRate: number;
  pendingPayout: number;
  lastPayout: number;
  lastPayoutDate: string;
  topPerformingThreads: Array<{
    id: string;
    title: string;
    sales: number;
    earnings: number;
    views: number;
  }>;
  recentTransactions: Array<{
    id: string;
    threadTitle: string;
    amount: number;
    date: string;
    status: 'completed' | 'pending' | 'failed';
  }>;
  earningsHistory: Array<{
    date: string;
    amount: number;
  }>;
}

// Mock data service
const fetchCreatorEarnings = async (): Promise<EarningsData> => {
  await new Promise(resolve => setTimeout(resolve, 500));
  
  return {
    totalEarnings: 2847.50,
    monthlyEarnings: 1243.20,
    weeklyEarnings: 387.50,
    todayEarnings: 94.30,
    totalSales: 342,
    totalViews: 8420,
    conversionRate: 4.06,
    pendingPayout: 487.90,
    lastPayout: 1360.60,
    lastPayoutDate: '2025-09-25',
    topPerformingThreads: [
      {
        id: 'thread_1',
        title: 'Advanced React Patterns & Best Practices',
        sales: 87,
        earnings: 608.90,
        views: 1842,
      },
      {
        id: 'thread_2',
        title: 'Building Scalable APIs with Node.js',
        sales: 64,
        earnings: 447.20,
        views: 1456,
      },
      {
        id: 'thread_3',
        title: 'TypeScript Deep Dive: Advanced Types',
        sales: 52,
        earnings: 363.40,
        views: 1203,
      },
    ],
    recentTransactions: [
      {
        id: 'txn_1',
        threadTitle: 'Advanced React Patterns',
        amount: 6.99,
        date: '2025-10-04',
        status: 'completed',
      },
      {
          id: 'txn_2',
          threadTitle: 'Building Scalable APIs',
          amount: 2.0,
        date: '2025-10-04',
        status: 'completed',
      },
      {
        id: 'txn_3',
        threadTitle: 'TypeScript Deep Dive',
        amount: 5.99,
        date: '2025-10-03',
        status: 'pending',
      },
    ],
    earningsHistory: [
      { date: '2025-09', amount: 1243.20 },
      { date: '2025-08', amount: 987.40 },
      { date: '2025-07', amount: 617.90 },
    ],
  };
};

export default function CreatorEarningsDashboard() {
  const [earningsData, setEarningsData] = useState<EarningsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<'today' | 'week' | 'month' | 'all'>('month');

  useEffect(() => {
    const loadEarnings = async () => {
      setIsLoading(true);
      const data = await fetchCreatorEarnings();
      setEarningsData(data);
      setIsLoading(false);
    };
    loadEarnings();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-12 h-12 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!earningsData) return null;

  const getEarningsByPeriod = () => {
    switch (selectedPeriod) {
      case 'today':
        return earningsData.todayEarnings;
      case 'week':
        return earningsData.weeklyEarnings;
      case 'month':
        return earningsData.monthlyEarnings;
      case 'all':
        return earningsData.totalEarnings;
      default:
        return earningsData.monthlyEarnings;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Creator Earnings</h1>
          <p className="text-gray-400">Track your premium content performance and earnings</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
          <Download className="w-4 h-4" />
          Export Report
        </button>
      </div>

      {/* Period Selector */}
      <div className="flex gap-2 p-1 bg-gray-800 rounded-lg w-fit">
        {['today', 'week', 'month', 'all'].map((period) => (
          <button
            key={period}
            onClick={() => setSelectedPeriod(period as typeof selectedPeriod)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              selectedPeriod === period
                ? 'bg-purple-600 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            {period === 'all' ? 'All Time' : period.charAt(0).toUpperCase() + period.slice(1)}
          </button>
        ))}
      </div>

      {/* Earnings Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-purple-600 to-purple-700 rounded-xl p-6 text-white"
        >
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-white/20 rounded-lg">
              <DollarSign className="w-6 h-6" />
            </div>
            <span className="text-sm bg-green-500/20 text-green-300 px-2 py-1 rounded-full flex items-center gap-1">
              <ArrowUpRight className="w-3 h-3" />
              12%
            </span>
          </div>
          <h3 className="text-3xl font-bold mb-1">${getEarningsByPeriod().toFixed(2)}</h3>
          <p className="text-purple-200 text-sm capitalize">{selectedPeriod} Earnings</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gray-800 rounded-xl p-6 border border-gray-700"
        >
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-orange-500/20 rounded-lg">
              <TrendingUp className="w-6 h-6 text-orange-400" />
            </div>
          </div>
          <h3 className="text-3xl font-bold text-white mb-1">{earningsData.totalSales}</h3>
          <p className="text-gray-400 text-sm">Total Sales</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-gray-800 rounded-xl p-6 border border-gray-700"
        >
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Eye className="w-6 h-6 text-blue-400" />
            </div>
          </div>
          <h3 className="text-3xl font-bold text-white mb-1">{earningsData.totalViews.toLocaleString()}</h3>
          <p className="text-gray-400 text-sm">Total Views</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-gray-800 rounded-xl p-6 border border-gray-700"
        >
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-green-500/20 rounded-lg">
              <Users className="w-6 h-6 text-green-400" />
            </div>
          </div>
          <h3 className="text-3xl font-bold text-white mb-1">{earningsData.conversionRate.toFixed(2)}%</h3>
          <p className="text-gray-400 text-sm">Conversion Rate</p>
        </motion.div>
      </div>

      {/* Payout Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="w-5 h-5 text-purple-400" />
            <h3 className="text-lg font-semibold text-white">Pending Payout</h3>
          </div>
          <p className="text-3xl font-bold text-white mb-2">${earningsData.pendingPayout.toFixed(2)}</p>
          <p className="text-sm text-gray-400">Available for withdrawal</p>
          <button className="mt-4 w-full py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
            Request Payout
          </button>
        </div>

        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <div className="flex items-center gap-2 mb-4">
            <DollarSign className="w-5 h-5 text-green-400" />
            <h3 className="text-lg font-semibold text-white">Last Payout</h3>
          </div>
          <p className="text-3xl font-bold text-white mb-2">${earningsData.lastPayout.toFixed(2)}</p>
          <p className="text-sm text-gray-400">on {new Date(earningsData.lastPayoutDate).toLocaleDateString()}</p>
        </div>
      </div>

      {/* Top Performing Threads */}
      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
        <div className="flex items-center gap-2 mb-6">
          <Crown className="w-5 h-5 text-yellow-400" />
          <h3 className="text-lg font-semibold text-white">Top Performing Premium Threads</h3>
        </div>
        <div className="space-y-4">
          {earningsData.topPerformingThreads.map((thread, index) => (
            <div key={thread.id} className="flex items-center justify-between p-4 bg-gray-900/50 rounded-lg hover:bg-gray-900 transition-colors">
              <div className="flex items-center gap-4">
                <div className="flex items-center justify-center w-8 h-8 bg-purple-600 text-white rounded-full font-bold text-sm">
                  {index + 1}
                </div>
                <div>
                  <h4 className="text-white font-medium">{thread.title}</h4>
                  <p className="text-sm text-gray-400">{thread.views.toLocaleString()} views · {thread.sales} sales</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-green-400">${thread.earnings.toFixed(2)}</p>
                <p className="text-xs text-gray-400">earned</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
        <h3 className="text-lg font-semibold text-white mb-6">Recent Transactions</h3>
        <div className="space-y-3">
          {earningsData.recentTransactions.map((transaction) => (
            <div key={transaction.id} className="flex items-center justify-between p-4 bg-gray-900/50 rounded-lg">
              <div>
                <h4 className="text-white font-medium">{transaction.threadTitle}</h4>
                <p className="text-sm text-gray-400">{new Date(transaction.date).toLocaleDateString()}</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-white">${transaction.amount.toFixed(2)}</p>
                <span className={`text-xs px-2 py-1 rounded-full ${
                  transaction.status === 'completed' 
                    ? 'bg-green-500/20 text-green-400'
                    : transaction.status === 'pending'
                    ? 'bg-yellow-500/20 text-yellow-400'
                    : 'bg-red-500/20 text-red-400'
                }`}>
                  {transaction.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
