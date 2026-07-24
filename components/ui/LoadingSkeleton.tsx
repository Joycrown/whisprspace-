'use client'

import React from 'react';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string;
  height?: string;
  animate?: boolean;
}

export function Skeleton({
  className = '',
  variant = 'rectangular',
  width,
  height,
  animate = true,
}: SkeletonProps) {
  const variantStyles = {
    text: 'h-4 rounded-lg',
    circular: 'rounded-full',
    rectangular: 'rounded-xl',
  };

  return (
    <div
      className={`bg-white/[0.05] ${animate ? 'animate-pulse' : ''} ${variantStyles[variant]} ${className}`}
      style={{ width, height }}
    />
  );
}

export function ThreadCardSkeleton() {
  return (
    <div className="px-3 md:px-4 py-3 border-b border-[#23232E]">
      <div className="flex items-start gap-2.5">
        <Skeleton variant="circular" width="36px" height="36px" />
        <div className="flex-1 space-y-2.5">
          <div className="flex justify-between">
            <Skeleton width="55%" height="16px" />
            <Skeleton width="48px" height="12px" />
          </div>
          <Skeleton width="90%" height="12px" />
          <Skeleton width="70%" height="12px" />
          <div className="flex gap-3 mt-1">
            <Skeleton width="40px" height="12px" />
            <Skeleton width="40px" height="12px" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function MessageCardSkeleton() {
  return (
    <div className="p-3 md:p-4 bg-white/[0.03] border border-[#23232E] rounded-xl">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <Skeleton variant="circular" width="32px" height="32px" />
          <Skeleton width="90px" height="14px" />
        </div>
        <Skeleton width="44px" height="12px" />
      </div>
      <Skeleton width="100%" height="14px" />
      <Skeleton width="75%" height="14px" className="mt-2" />
    </div>
  );
}

export function InboxStatsSkeleton() {
  return (
    <div className="grid grid-cols-3 gap-3 mb-6">
      {[0, 1, 2].map((i) => (
        <div key={i} className="bg-white/[0.03] border border-[#23232E] rounded-xl p-3">
          <Skeleton variant="circular" width="28px" height="28px" className="mb-2" />
          <Skeleton width="52px" height="10px" className="mb-1" />
          <Skeleton width="36px" height="20px" />
        </div>
      ))}
    </div>
  );
}

export function ProfileHeaderSkeleton() {
  return (
    <div className="flex items-center gap-4 p-6">
      <Skeleton variant="circular" width="72px" height="72px" />
      <div className="flex-1 space-y-2">
        <Skeleton width="140px" height="20px" />
        <Skeleton width="180px" height="14px" />
        <Skeleton width="100px" height="14px" />
      </div>
    </div>
  );
}
