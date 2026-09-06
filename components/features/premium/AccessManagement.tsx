'use client'

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Copy, Plus, Gift, Check, Link2, Share2 } from 'lucide-react';
import { AccessCode } from '@/types';

interface AccessManagementProps {
  accessCodes: AccessCode[];
  onGenerateCode: () => void;
  isGenerating?: boolean;
  errorMessage?: string | null;
  isThreadActive?: boolean;
  /** Full thread URL — used to build the ready-to-send code link. */
  threadUrl?: string;
}

export default function AccessManagement({
  accessCodes,
  onGenerateCode,
  isGenerating,
  errorMessage,
  isThreadActive = true,
  threadUrl,
}: AccessManagementProps) {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const buildShareLink = (code: string) => {
    if (!threadUrl) return code;
    const sep = threadUrl.includes('?') ? '&' : '?';
    return `${threadUrl}${sep}code=${encodeURIComponent(code)}`;
  };

  const handleCopyLink = (code: string) => {
    const link = buildShareLink(code);
    navigator.clipboard.writeText(link);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleShareLink = async (code: string) => {
    const link = buildShareLink(code);
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Discussion access link',
          text: 'Use this link to get free access to my premium discussion.',
          url: link,
        });
      } catch { /* user cancelled */ }
    } else {
      handleCopyLink(code);
    }
  };

  const isUnlimited = (code: AccessCode) => code.maxUses <= 0;
  const isUsable = (code: AccessCode) => isUnlimited(code) || code.currentUses < code.maxUses;

  const effectiveActive = accessCodes.filter(
    (ac) => isThreadActive && ac.isActive && isUsable(ac)
  );
  const effectiveInactive = accessCodes.filter(
    (ac) => !isThreadActive || !ac.isActive || !isUsable(ac)
  );

  const canGenerate = isThreadActive && accessCodes.length < 5;

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
            Up to five codes per premium thread. Share the ready-to-use link — no copy-pasting needed.
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
          Generate up to five unique access codes for contributors or partners. Each code comes with
          a one-tap link you can send directly — no manual entry required.
        </p>

        <button
          onClick={onGenerateCode}
          disabled={!canGenerate || isGenerating}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-purple-600 to-orange-500 hover:opacity-90 rounded-lg text-white font-semibold transition-opacity disabled:opacity-50"
        >
          <Plus className="w-5 h-5" />
          {isGenerating ? 'Generating…' : 'Generate Access Code'}
        </button>

        {accessCodes.length >= 5 && (
          <p className="text-xs text-yellow-400 mt-3">
            You've reached the five-code limit for this thread. Revoke an existing code to create a new one.
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

          <div className="space-y-4">
            {effectiveActive.map((accessCode) => {
              const shareLink = buildShareLink(accessCode.code);
              const isCopied = copiedCode === accessCode.code;
              return (
                <motion.div
                  key={accessCode.code}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 bg-gray-900 rounded-xl border border-gray-700"
                >
                  {/* Code + usage row */}
                  <div className="flex items-center justify-between mb-3">
                    <code className="text-base font-mono font-bold text-purple-400">
                      {accessCode.code}
                    </code>
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                      <span>
                        {isUnlimited(accessCode)
                          ? `${accessCode.currentUses} used`
                          : `${accessCode.currentUses}/${accessCode.maxUses}`}
                      </span>
                      {isUnlimited(accessCode) && (
                        <span className="text-xs text-purple-300 bg-purple-900/30 px-2 py-0.5 rounded-full">
                          Unlimited
                        </span>
                      )}
                      <span className="text-green-400 text-xs">Active</span>
                    </div>
                  </div>

                  {/* Ready-to-send link */}
                  {threadUrl && (
                    <div className="flex items-center gap-2 bg-gray-800/60 border border-gray-700 rounded-lg px-3 py-2 mb-3">
                      <Link2 className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
                      <span className="flex-1 text-xs text-gray-400 font-mono truncate">
                        {shareLink.replace('https://', '')}
                      </span>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleCopyLink(accessCode.code)}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm text-white transition-colors"
                    >
                      {isCopied
                        ? <><Check className="w-4 h-4 text-green-400" /> Copied</>
                        : <><Copy className="w-4 h-4" /> Copy link</>
                      }
                    </button>
                    <button
                      onClick={() => handleShareLink(accessCode.code)}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 rounded-lg text-sm text-purple-300 transition-colors"
                    >
                      <Share2 className="w-4 h-4" />
                      Share
                    </button>
                  </div>
                </motion.div>
              );
            })}
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
                      : 'Discussion expired'}
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
