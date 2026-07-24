'use client'

import React, { useState } from 'react';
import { Crown, Lock } from 'lucide-react';
import PaymentModal from '../modals/PaymentModal';
import { redeemThreadAccessCode } from '@/lib/threads/thread-service';

interface PremiumContentPreviewProps {
  threadId: string;
  threadTitle: string;
  content: string;
  price: number;
  creatorId: string;
  hasAccess: boolean;
  previewLength?: number;
  onAccessGranted?: () => void;
}

export default function PremiumContentPreview({
  threadId,
  threadTitle,
  content,
  price,
  creatorId,
  hasAccess,
  previewLength = 150,
  onAccessGranted,
}: PremiumContentPreviewProps) {
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [userHasAccess, setUserHasAccess] = useState(hasAccess);

  const previewText = content.slice(0, previewLength);
  const hasMoreContent = content.length > previewLength;

  const handlePaymentSuccess = () => {
    setUserHasAccess(true);
    onAccessGranted?.();
  };

  if (userHasAccess) {
    return (
      <div className="relative">
        <div className="flex items-center gap-2 mb-3 text-xs text-[#C4B5FD]">
          <Crown className="w-3.5 h-3.5" />
          <span>Premium — access granted</span>
        </div>
        <p className="text-sm text-[#8F8FA3] whitespace-pre-wrap break-words">{content}</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {/* Premium label */}
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-[#8B5CF6]/40 text-xs text-[#C4B5FD]">
            <Crown className="w-3.5 h-3.5" />
            Premium content
          </span>
          <span className="text-[#F2F2F6] font-medium text-sm">${price.toFixed(2)}</span>
        </div>

        {/* Blurred preview */}
        <div className="relative overflow-hidden rounded-xl">
          <p className="text-sm text-[#8F8FA3] whitespace-pre-wrap break-words">
            {previewText}{hasMoreContent ? '…' : ''}
          </p>
          <div
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(to bottom, transparent 30%, #0A0A10 90%)',
            }}
          />
        </div>

        {/* Paywall card */}
        <div className="rounded-2xl border border-dashed border-[#8B5CF6]/30 bg-[#8B5CF6]/[0.04] p-6 text-center space-y-4">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center mx-auto"
            style={{ background: 'linear-gradient(135deg, #8B5CF6, #F97316)' }}
          >
            <Lock className="w-5 h-5 text-white" />
          </div>

          <div className="space-y-1">
            <h3 className="text-base font-medium text-[#F2F2F6]">Unlock premium content</h3>
            <p className="text-sm text-[#8F8FA3]">
              Full thread access. 70% goes directly to the creator.
            </p>
          </div>

          <button
            onClick={() => setShowPaymentModal(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[11px] text-sm font-medium text-white active:scale-[0.97] transition-all"
            style={{ background: 'linear-gradient(100deg, #8B5CF6, #F97316)' }}
          >
            <Crown className="w-4 h-4" />
            Unlock for ${price.toFixed(2)}
          </button>
        </div>
      </div>

      <PaymentModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        threadId={threadId}
        threadTitle={threadTitle}
        price={price}
        creatorId={creatorId}
        onSuccess={handlePaymentSuccess}
        onValidateCode={(code) => redeemThreadAccessCode(threadId, code).then((res) => res.success)}
      />
    </>
  );
}
