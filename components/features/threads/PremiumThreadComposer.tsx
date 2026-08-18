'use client';

import React, { useState, useEffect, useRef } from 'react';
import { DollarSign, TrendingUp, Info, Check, Crown, Zap } from 'lucide-react';
import { User } from '@/types';
import {
  getPremiumThreadRules,
  validatePremiumThreadPrice,
  calculateRevenueSplit,
  getUpgradeBenefits
} from '@/lib/utils/utils/helpers/premiumThreadHelpers';

interface PremiumThreadComposerProps {
  user: User;
  onPriceChange: (price: number) => void;
  onUpgrade?: () => void;
}

export default function PremiumThreadComposer({
  user,
  onPriceChange,
  onUpgrade
}: PremiumThreadComposerProps) {
  const rules = getPremiumThreadRules(user);
  const [price, setPrice] = useState<number>(rules.priceRange.min);
  const [error, setError] = useState<string | null>(null);
  const isInitialMount = useRef(true);

  useEffect(() => {
    // Call onPriceChange only after initial mount or when price changes
    if (isInitialMount.current) {
      isInitialMount.current = false;
      onPriceChange(price);
    } else {
      onPriceChange(price);
    }
  }, [price]);

  const handlePriceChange = (newPrice: number) => {
    const validation = validatePremiumThreadPrice(newPrice, user);

    if (!validation.valid) {
      setError(validation.reason || 'Invalid price');
    } else {
      setError(null);
    }

    setPrice(newPrice);
  };

  const revenueSplit = calculateRevenueSplit(price, user.isPremium || false);
  const upgradeBenefits = getUpgradeBenefits(price);

  return (
    <div className="space-y-6">
      {/* Premium Thread Toggle Section */}
      <div className="bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-xl p-4 sm:p-6 border-2 border-purple-200 dark:border-purple-800">
        <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
          <div className="p-1.5 sm:p-2 bg-purple-500 rounded-lg flex-shrink-0">
            <DollarSign className="text-white" size={20} />
          </div>
          <div className="flex-1">
            <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">
              Premium Thread Pricing
            </h3>
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
              Set a price for exclusive access to this thread
            </p>
          </div>
          {user.isPremium && (
            <div className="flex items-center gap-1 px-3 py-1 bg-yellow-500 text-white text-xs font-bold rounded-full">
              <Crown size={12} />
              PREMIUM
            </div>
          )}
        </div>

        {/* Price Input */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Thread Price
            </label>
            {user.isPremium && (
              <span className="text-xs text-purple-500 dark:text-purple-400 font-medium">
                Set any price — no limit
              </span>
            )}
          </div>

          {user.isPremium ? (
            /* Premium users: free-form number input with $1.00 floor */
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 font-semibold">$</span>
              <input
                type="number"
                min={rules.priceRange.min}
                step={0.01}
                value={price}
                onChange={(e) => handlePriceChange(parseFloat(e.target.value) || 0)}
                className="w-full pl-7 pr-4 py-3 text-2xl font-bold text-purple-600 dark:text-purple-400 bg-white dark:bg-gray-800 border-2 border-purple-300 dark:border-purple-700 rounded-xl focus:outline-none focus:border-purple-500 dark:focus:border-purple-400"
                placeholder="1.00"
              />
            </div>
          ) : (
            /* Free users: slider capped at $2.99 */
            <>
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400 mb-2">
                ${price.toFixed(2)}
              </div>
              <input
                type="range"
                min={rules.priceRange.min * 100}
                max={299}
                step={25}
                value={price * 100}
                onChange={(e) => handlePriceChange(parseInt(e.target.value) / 100)}
                className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-600"
              />
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                <span>${rules.priceRange.min.toFixed(2)}</span>
                <span>$2.99 max</span>
              </div>
            </>
          )}

          {error && (
            <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}
        </div>

        {/* Revenue Split Display */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-3 sm:p-4 space-y-2 sm:space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Price per access:</span>
            <span className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white">${price.toFixed(2)}</span>
          </div>

          <div className="border-t border-gray-200 dark:border-gray-700 pt-2 sm:pt-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 sm:gap-2 flex-1 min-w-0">
                <TrendingUp className="text-green-500 flex-shrink-0" size={14} />
                <span className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
                  You earn ({Math.round(rules.revenueShare.creator * 100)}%):
                </span>
              </div>
              <span className="text-base sm:text-lg font-bold text-green-600 dark:text-green-400 flex-shrink-0">
                ${revenueSplit.creatorShare.toFixed(2)}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500 dark:text-gray-400">
                Platform fee ({Math.round(rules.revenueShare.platform * 100)}%):
              </span>
              <span className="text-gray-600 dark:text-gray-400">
                ${revenueSplit.platformShare.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Estimated Earnings */}
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-2 sm:p-3">
            <p className="text-xs font-medium text-blue-900 dark:text-blue-100 mb-2">
              💡 Estimated Monthly Earnings:
            </p>
            <div className="space-y-1 text-xs text-blue-800 dark:text-blue-200">
              <div className="flex justify-between">
                <span>10 sales:</span>
                <span className="font-bold">${(revenueSplit.creatorShare * 10).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>50 sales:</span>
                <span className="font-bold">${(revenueSplit.creatorShare * 50).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>100 sales:</span>
                <span className="font-bold">${(revenueSplit.creatorShare * 100).toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Upgrade Prompt (for free users) */}
      {!user.isPremium && (
        <div className="border-2 border-yellow-500 bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 rounded-xl p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row items-start gap-3 sm:gap-4 mb-3 sm:mb-4">
            <div className="p-2 sm:p-3 bg-yellow-500 rounded-lg flex-shrink-0 self-center sm:self-start">
              <Crown className="text-white" size={24} />
            </div>
            <div className="flex-1">
              <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white mb-2">
                Unlock Better Earnings with Premium
              </h3>
              <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 mb-3 sm:mb-4">
                Upgrade to earn more per sale and access unlimited premium thread creation
              </p>

              <div className="grid grid-cols-2 gap-2 sm:gap-4 mb-3 sm:mb-4">
                <div className="bg-white dark:bg-gray-800 rounded-lg p-2 sm:p-3">
                  <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 mb-1">Current (Free)</p>
                  <p className="text-sm sm:text-lg font-bold text-gray-700 dark:text-gray-300">
                    ${upgradeBenefits.freeEarnings.toFixed(2)}/sale
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">50% revenue</p>
                </div>

                <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg p-2 sm:p-3 border-2 border-green-500">
                  <p className="text-[10px] sm:text-xs text-green-700 dark:text-green-300 mb-1 font-medium">With Premium</p>
                  <p className="text-sm sm:text-lg font-bold text-green-600 dark:text-green-400">
                    ${upgradeBenefits.premiumEarnings.toFixed(2)}/sale
                  </p>
                  <p className="text-xs text-green-600 dark:text-green-400 font-medium">70% revenue (+{upgradeBenefits.revenueBoost}%!)</p>
                </div>
              </div>

              <div className="space-y-1.5 sm:space-y-2 mb-3 sm:mb-4">
                <div className="flex items-start gap-1.5 sm:gap-2 text-xs sm:text-sm text-gray-700 dark:text-gray-300">
                  <Check className="text-green-500 flex-shrink-0 mt-0.5" size={14} />
                  <span><strong>Set any price</strong> — no cap (vs $2.99 max now)</span>
                </div>
                <div className="flex items-start gap-1.5 sm:gap-2 text-xs sm:text-sm text-gray-700 dark:text-gray-300">
                  <Check className="text-green-500 flex-shrink-0 mt-0.5" size={14} />
                  <span><strong>Unlimited</strong> premium threads (vs 5/month limit)</span>
                </div>
                <div className="flex items-start gap-1.5 sm:gap-2 text-xs sm:text-sm text-gray-700 dark:text-gray-300">
                  <Check className="text-green-500 flex-shrink-0 mt-0.5" size={14} />
                  <span>Threads last <strong>7 days</strong> (vs 48 hours) — and can be saved forever</span>
                </div>
                <div className="flex items-start gap-1.5 sm:gap-2 text-xs sm:text-sm text-gray-700 dark:text-gray-300">
                  <Check className="text-green-500 flex-shrink-0 mt-0.5" size={14} />
                  <span>Creator badge</span>
                </div>
              </div>

              {onUpgrade && (
                <button
                  onClick={onUpgrade}
                  className="w-full py-2.5 sm:py-3 bg-gradient-to-r from-yellow-500 to-orange-500 text-white text-sm sm:text-base font-bold rounded-lg hover:from-yellow-600 hover:to-orange-600 transition-all flex items-center justify-center gap-2 shadow-lg"
                >
                  <Zap size={18} className="sm:w-5 sm:h-5" />
                  <span className="truncate">Upgrade to Premium - $2/month</span>
                </button>
              )}

              <p className="text-xs text-center text-gray-600 dark:text-gray-400 mt-2">
                💡 Pays for itself after just 2 thread sales!
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Thread Limits Info */}
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 sm:p-4">
        <div className="flex items-start gap-2 sm:gap-3">
          <Info className="text-blue-500 flex-shrink-0 mt-0.5" size={16} />
          <div className="text-xs sm:text-sm text-gray-700 dark:text-gray-300">
            <p className="font-medium mb-1">
              {user.isPremium ? 'Premium Benefits Active' : 'Free Tier Limits'}
            </p>
            <p>
              {user.isPremium
                ? 'You have unlimited premium thread creation with 70% revenue share.'
                : `You can create up to ${rules.limits.monthly} premium threads per month with 50% revenue share.`
              }
            </p>
            {!user.isPremium && user.premiumThreadsCreatedThisMonth !== undefined && (
              <p className="mt-1 text-blue-600 dark:text-blue-400 font-medium">
                {rules.limits.monthly - user.premiumThreadsCreatedThisMonth} premium threads remaining this month
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
