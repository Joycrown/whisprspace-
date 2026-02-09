'use client'

import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info';
  size?: 'sm' | 'md' | 'lg';
  dot?: boolean;
  className?: string;
}

const variantStyles = {
  default: 'bg-gray-700 text-gray-300',
  primary: 'bg-gradient-to-r from-purple-600 to-orange-500 text-white',
  success: 'bg-green-600 text-white',
  warning: 'bg-orange-500 text-white',
  danger: 'bg-red-600 text-white',
  info: 'bg-blue-600 text-white',
};

const sizeStyles = {
  sm: 'px-2 py-0.5 text-[10px]',
  md: 'px-2.5 py-1 text-xs',
  lg: 'px-3 py-1.5 text-sm',
};

export function Badge({
  children,
  variant = 'default',
  size = 'md',
  dot = false,
  className = '',
}: BadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center gap-1.5
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        rounded-full font-semibold
        ${className}
      `}
    >
      {dot && (
        <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
      )}
      {children}
    </span>
  );
}

// Counter badge (for notifications)
export function CountBadge({ count, max = 99 }: { count: number; max?: number }) {
  if (count === 0) return null;
  
  const displayCount = count > max ? `${max}+` : count;
  
  return (
    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full px-1">
      {displayCount}
    </span>
  );
}

// Status badge
export function StatusBadge({ 
  status 
}: { 
  status: 'online' | 'offline' | 'away' | 'busy' 
}) {
  const statusConfig = {
    online: { color: 'bg-green-500', label: 'Online' },
    offline: { color: 'bg-gray-500', label: 'Offline' },
    away: { color: 'bg-yellow-500', label: 'Away' },
    busy: { color: 'bg-red-500', label: 'Busy' },
  };

  const config = statusConfig[status];

  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-800 rounded-full text-xs text-gray-300">
      <span className={`w-2 h-2 rounded-full ${config.color}`} />
      {config.label}
    </span>
  );
}
