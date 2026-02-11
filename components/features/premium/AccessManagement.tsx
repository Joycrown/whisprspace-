'use client'

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Copy, Plus, Gift, Check } from 'lucide-react';
import { AccessCode } from '@/types';

interface AccessManagementProps {
  accessCodes: AccessCode[];
  onGenerateCode: () => void;
  isGenerating?: boolean;
  errorMessage?: string | null;
  isThreadActive?: boolean;
}

export default function AccessManagement({
  accessCodes,
  onGenerateCode,
  isGenerating,
  errorMessage,
  isThreadActive = true,
}: AccessManagementProps) {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const isUnlimited = (code: AccessCode) => code.maxUses <= 0;
  const isUsable = (code: AccessCode) => isUnlimited(code) || code.currentUses < code.maxUses;

  const effectiveActive = accessCodes.filter(
    (ac) => isThreadActive && ac.isActive && isUsable(ac)
  );
  const effectiveInactive = accessCodes.filter(
    (ac) => !isThreadActive || !ac.isActive || !isUsable(ac)
  );

  const canGenerate = isThreadActive && accessCodes.length < 2;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-purple-500/20 rounded-lg">
          <Gift className="w-6 h-6 text-purple-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">Partner Access Codes</h2>
          <p className="text-sm text-gray-400">
            Two permanent codes per premium thread. Codes stay active while the thread is active.
          </p>
        </div>
      </div>

      {!isThreadActive && (
        <div className="rounded-xl border border-yellow-500/30 bg-yellow-900/20 p-4 text-sm text-yellow-200">
          This thread has expired. Access codes are now inactive.
        </div>
      )}

      {/* Generate New Code Section */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-2">Generate Access Codes</h3>
        <p className="text-sm text-gray-400 mb-4">
          Generate up to two unique access codes for contributors or partners.
        </p>

        <button
          onClick={onGenerateCode}
          disabled={!canGenerate || isGenerating}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-purple-600 to-orange-500 hover:opacity-90 rounded-lg text-white font-semibold transition-opacity disabled:opacity-50"
        >
          <Plus className="w-5 h-5" />
          {isGenerating ? 'Generating...' : 'Generate Access Code'}
        </button>

        {accessCodes.length >= 2 && (
          <p className="text-xs text-yellow-400 mt-3">
            You already have two codes for this thread.
          </p>
        )}

        {errorMessage && (
          <p className="text-xs text-red-400 mt-3">{errorMessage}</p>
        )}
      </div>

      {/* Active Codes */}
      {effectiveActive.length > 0 && (
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">
            Active Codes ({effectiveActive.length})
          </h3>

          <div className="space-y-3">
            {effectiveActive.map((accessCode) => (
              <motion.div
                key={accessCode.code}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-between p-4 bg-gray-900 rounded-lg border border-gray-700"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <code className="text-lg font-mono font-bold text-purple-400">
                      {accessCode.code}
                    </code>
                    <button
                      onClick={() => handleCopyCode(accessCode.code)}
                      className="p-1 hover:bg-gray-800 rounded transition-colors"
                    >
                      {copiedCode === accessCode.code ? (
                        <Check className="w-4 h-4 text-green-400" />
                      ) : (
                        <Copy className="w-4 h-4 text-gray-400" />
                      )}
                    </button>
                  </div>

                  <div className="flex items-center gap-4 text-sm text-gray-400">
                    <span>
                      Uses: <span className="text-white font-semibold">
                        {isUnlimited(accessCode)
                          ? accessCode.currentUses
                          : `${accessCode.currentUses}/${accessCode.maxUses}`}
                      </span>
                      {isUnlimited(accessCode) && (
                        <span className="ml-2 text-xs text-purple-300">Unlimited uses</span>
                      )}
                    </span>
                    <span className="text-green-400">Active</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Inactive Codes */}
      {effectiveInactive.length > 0 && (
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-gray-400 mb-4">
            Inactive Codes ({effectiveInactive.length})
          </h3>

          <div className="space-y-2">
            {effectiveInactive.map((accessCode) => (
              <div
                key={accessCode.code}
                className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg border border-gray-800 opacity-60"
              >
                <div>
                  <code className="text-sm font-mono text-gray-500">
                    {accessCode.code}
                  </code>
                  <span className="ml-3 text-xs text-gray-600">
                    {isThreadActive
                      ? (!isUnlimited(accessCode) && accessCode.currentUses >= accessCode.maxUses)
                        ? 'Fully Used'
                        : 'Inactive'
                      : 'Thread expired'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Usage Stats */}
      <div className="bg-gradient-to-br from-purple-900/30 to-orange-900/30 border border-purple-500/30 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Free Access Stats</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-400">Total Codes</p>
            <p className="text-2xl font-bold text-white">{accessCodes.length}</p>
          </div>
          <div>
            <p className="text-sm text-gray-400">Total Redemptions</p>
            <p className="text-2xl font-bold text-purple-400">
              {accessCodes.reduce((sum, code) => sum + code.currentUses, 0)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
