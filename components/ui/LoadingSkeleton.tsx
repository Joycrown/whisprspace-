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
    text: 'h-4 rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-lg',
  };

  return (
    <div
      className={`
        bg-gray-800
        ${animate ? 'animate-pulse' : ''}
        ${variantStyles[variant]}
        ${className}
      `}
      style={{ width, height }}
    />
  );
}

// Preset skeletons for common use cases
export function ThreadCardSkeleton() {
  return (
    <div className="p-3 md:p-4 border-b border-gray-800">
      <div className="flex items-start gap-3">
        <Skeleton variant="circular" width="40px" height="40px" />
        <div className="flex-1 space-y-3">
          <div className="flex justify-between">
            <Skeleton width="60%" height="20px" />
            <Skeleton width="60px" height="16px" />
          </div>
          <Skeleton width="100%" height="16px" />
          <Skeleton width="80%" height="16px" />
          <div className="flex gap-4 mt-3">
            <Skeleton width="60px" height="16px" />
            <Skeleton width="60px" height="16px" />
            <Skeleton width="80px" height="16px" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function MessageCardSkeleton() {
  return (
    <div className="p-3 md:p-4 bg-gray-800 rounded-xl border border-gray-700">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <Skeleton variant="circular" width="32px" height="32px" />
          <Skeleton width="100px" height="16px" />
        </div>
        <Skeleton width="50px" height="14px" />
      </div>
      <Skeleton width="100%" height="16px" />
      <Skeleton width="80%" height="16px" className="mt-2" />
    </div>
  );
}

export function InboxStatsSkeleton() {
  return (
    <div className="grid grid-cols-3 gap-3 md:gap-4 mb-6">
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-gray-800 rounded-xl p-3 md:p-4">
          <Skeleton variant="circular" width="32px" height="32px" className="mb-2" />
          <Skeleton width="60px" height="12px" className="mb-1" />
          <Skeleton width="40px" height="24px" />
        </div>
      ))}
    </div>
  );
}

export function ProfileHeaderSkeleton() {
  return (
    <div className="flex items-center gap-4 p-6">
      <Skeleton variant="circular" width="80px" height="80px" />
      <div className="flex-1 space-y-2">
        <Skeleton width="150px" height="24px" />
        <Skeleton width="200px" height="16px" />
        <Skeleton width="120px" height="16px" />
      </div>
    </div>
  );
}
