'use client'

import React, { useState } from 'react';
import { Crown, Lock, Eye } from 'lucide-react';
import PaymentModal from '../modals/PaymentModal';

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

  // Get preview text
  const previewText = content.slice(0, previewLength);
  const hasMoreContent = content.length > previewLength;

  const handlePaymentSuccess = () => {
    setUserHasAccess(true);
    if (onAccessGranted) {
      onAccessGranted();
    }
  };

  // If user has access, show full content
  if (userHasAccess) {
    return (
      <div className="relative">
        <div className="flex items-center gap-2 mb-3 text-sm text-purple-600">
          <Crown className="w-4 h-4" />
          <span className="font-medium">Premium Content - Access Granted</span>
        </div>
        <div className="prose prose-sm max-w-none text-gray-700">
          {content}
        </div>
      </div>
    );
  }

  // Show preview with blur overlay
  return (
    <>
      <div className="relative">
        {/* Premium Badge */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-purple-100 to-orange-100 border border-purple-200 rounded-full">
            <Crown className="w-4 h-4 text-purple-600" />
            <span className="text-sm font-semibold text-purple-900">Premium Content</span>
          </div>
          <div className="flex items-center gap-2 text-purple-600 font-bold text-lg">
            <span>${price.toFixed(2)}</span>
          </div>
        </div>

        {/* Content Preview with Blur */}
        <div className="relative">
          <div className="prose prose-sm max-w-none text-gray-700">
            {previewText}
            {hasMoreContent && '...'}
          </div>
          
          {/* Blur Overlay */}
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/50 to-white backdrop-blur-sm"></div>
        </div>

        {/* Locked Content Indicator */}
        <div className="relative mt-8 p-6 bg-gradient-to-br from-purple-50 to-orange-50 border-2 border-dashed border-purple-300 rounded-xl text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-white" />
          </div>
          
          <h3 className="text-xl font-bold text-gray-900 mb-2">
            Unlock Premium Content
          </h3>
          <p className="text-gray-600 mb-4 max-w-md mx-auto">
            Get instant access to the full thread and support the creator. 70% of your payment goes directly to them.
          </p>

          <button
            onClick={() => setShowPaymentModal(true)}
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-orange-500 text-white rounded-lg font-semibold hover:opacity-90 transition-opacity transform hover:scale-105 duration-200"
          >
            <Crown className="w-5 h-5" />
            <span>Unlock for ${price.toFixed(2)}</span>
          </button>

          <div className="mt-4 flex items-center justify-center gap-4 text-sm text-gray-600">
            <div className="flex items-center gap-1">
              <Eye className="w-4 h-4" />
              <span>Full access</span>
            </div>
            <div className="flex items-center gap-1">
              <Lock className="w-4 h-4" />
              <span>Secure payment</span>
            </div>
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      <PaymentModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        threadId={threadId}
        threadTitle={threadTitle}
        price={price}
        creatorId={creatorId}
        onSuccess={handlePaymentSuccess}
      />
    </>
  );
}
