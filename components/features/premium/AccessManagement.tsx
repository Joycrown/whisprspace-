'use client'

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Copy, Plus, Trash2, Gift, Link2, Check, RefreshCw } from 'lucide-react';
import { AccessCode } from '../utils/types';

interface AccessManagementProps {
  threadId: string;
  threadTitle: string;
  accessCodes: AccessCode[];
  secretToken?: string;
  onGenerateCode: (maxUses: number, expiryDays?: number) => void;
  onDeleteCode: (code: string) => void;
  onRegenerateSecretLink: () => void;
}

export default function AccessManagement({
  threadId,
  threadTitle,
  accessCodes,
  secretToken,
  onGenerateCode,
  onDeleteCode,
  onRegenerateSecretLink,
}: AccessManagementProps) {
  const [maxUses, setMaxUses] = useState(10);
  const [expiryDays, setExpiryDays] = useState<number | undefined>(30);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const secretLink = `${typeof window !== 'undefined' ? window.location.origin : ''}/threads/${threadId}?access=${secretToken}`;

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(secretLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const activeAccessCodes = accessCodes.filter(ac => ac.isActive && ac.currentUses < ac.maxUses);
  const expiredCodes = accessCodes.filter(ac => !ac.isActive || ac.currentUses >= ac.maxUses);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-purple-500/20 rounded-lg">
          <Gift className="w-6 h-6 text-purple-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">Free Access Management</h2>
          <p className="text-sm text-gray-400">Grant free access to collaborators and partners</p>
        </div>
      </div>

      {/* Secret Link Section */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Link2 className="w-5 h-5 text-orange-400" />
            <h3 className="text-lg font-semibold text-white">Secret Access Link</h3>
          </div>
          <button
            onClick={onRegenerateSecretLink}
            className="flex items-center gap-2 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm text-gray-300 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Regenerate
          </button>
        </div>
        
        <p className="text-sm text-gray-400 mb-4">
          Share this link for instant free access. Anyone with this link can access your premium thread without payment.
        </p>

        <div className="flex items-center gap-2">
          <input
            type="text"
            value={secretLink}
            readOnly
            className="flex-1 px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-300 text-sm font-mono"
          />
          <button
            onClick={handleCopyLink}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-white transition-colors"
          >
            {copiedLink ? (
              <>
                <Check className="w-4 h-4" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                Copy
              </>
            )}
          </button>
        </div>

        <div className="mt-3 p-3 bg-blue-900/20 border border-blue-500/30 rounded-lg">
          <p className="text-xs text-blue-300">
            💡 <strong>Tip:</strong> Regenerate this link if it gets leaked or you want to revoke previous access.
          </p>
        </div>
      </div>

      {/* Generate New Code Section */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Generate Invite Code</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Max Uses
            </label>
            <input
              type="number"
              value={maxUses}
              onChange={(e) => setMaxUses(parseInt(e.target.value) || 1)}
              min="1"
              max="1000"
              className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Expires In (Days)
            </label>
            <input
              type="number"
              value={expiryDays || ''}
              onChange={(e) => setExpiryDays(e.target.value ? parseInt(e.target.value) : undefined)}
              min="1"
              max="365"
              placeholder="Never"
              className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
        </div>

        <button
          onClick={() => {
            onGenerateCode(maxUses, expiryDays);
            setMaxUses(10);
            setExpiryDays(30);
          }}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-purple-600 to-orange-500 hover:opacity-90 rounded-lg text-white font-semibold transition-opacity"
        >
          <Plus className="w-5 h-5" />
          Generate New Code
        </button>
      </div>

      {/* Active Codes */}
      {activeAccessCodes.length > 0 && (
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">
            Active Invite Codes ({activeAccessCodes.length})
          </h3>
          
          <div className="space-y-3">
            {activeAccessCodes.map((accessCode) => (
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
                      Used: <span className="text-white font-semibold">
                        {accessCode.currentUses}/{accessCode.maxUses}
                      </span>
                    </span>
                    {accessCode.expiresAt && (
                      <span>
                        Expires: {new Date(accessCode.expiresAt).toLocaleDateString()}
                      </span>
                    )}
                    <span className="text-green-400">● Active</span>
                  </div>
                </div>

                <button
                  onClick={() => onDeleteCode(accessCode.code)}
                  className="p-2 hover:bg-red-500/20 rounded-lg text-red-400 transition-colors"
                  title="Delete code"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Expired/Full Codes */}
      {expiredCodes.length > 0 && (
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-gray-400 mb-4">
            Inactive Codes ({expiredCodes.length})
          </h3>
          
          <div className="space-y-2">
            {expiredCodes.map((accessCode) => (
              <div
                key={accessCode.code}
                className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg border border-gray-800 opacity-60"
              >
                <div>
                  <code className="text-sm font-mono text-gray-500">
                    {accessCode.code}
                  </code>
                  <span className="ml-3 text-xs text-gray-600">
                    {accessCode.currentUses >= accessCode.maxUses ? 'Fully Used' : 'Expired'}
                  </span>
                </div>
                <button
                  onClick={() => onDeleteCode(accessCode.code)}
                  className="p-1 hover:bg-red-500/20 rounded text-red-500/50 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
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
