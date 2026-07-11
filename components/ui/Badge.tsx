'use client'

import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info';
  size?: 'sm' | 'md' | 'lg';
  dot?: boolean;
  className?: string;
}

// All variants use low-opacity tinted surfaces — no solid colored fills
const variantStyles = {
  default: 'bg-white/[0.05] text-[#8F8FA3] border border-[#2A2A38]',
  primary: 'border border-[#8B5CF6]/40 text-[#C4B5FD]',
  success: 'bg-[#5DCAA5]/[0.08] border border-[#5DCAA5]/30 text-[#5DCAA5]',
  warning: 'bg-[#EF9F27]/[0.08] border border-[#EF9F27]/30 text-[#EF9F27]',
  danger:  'bg-[#E24B4A]/[0.08] border border-[#E24B4A]/30 text-[#E24B4A]',
  info:    'bg-[#8B5CF6]/[0.08] border border-[#8B5CF6]/30 text-[#C4B5FD]',
};

// primary gets gradient bg via style prop
const gradientVariants = new Set(['primary']);

const sizeStyles = {
  sm: 'px-2 py-0.5 text-[10px]',
  md: 'px-2.5 py-0.5 text-xs',
  lg: 'px-3 py-1 text-sm',
};

export function Badge({
  children,
  variant = 'default',
  size = 'md',
  dot = false,
  className = '',
}: BadgeProps) {
  const isGradient = gradientVariants.has(variant);

  return (
    <span
      className={`
        inline-flex items-center gap-1.5 rounded-full font-medium
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${className}
      `}
      style={
        isGradient
          ? { background: 'linear-gradient(100deg, #8B5CF6 0%, #F97316 100%)', color: 'white', border: 'none' }
          : undefined
      }
    >
      {dot && <span className="w-1.5 h-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

export function CountBadge({ count, max = 99 }: { count: number; max?: number }) {
  if (count === 0) return null;
  const display = count > max ? `${max}+` : count;
  return (
    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center bg-[#E24B4A] text-white text-[10px] font-bold rounded-full px-1">
      {display}
    </span>
  );
}

export function StatusBadge({ status }: { status: 'online' | 'offline' | 'away' | 'busy' }) {
  const config = {
    online:  { color: 'bg-[#5DCAA5]', label: 'Online' },
    offline: { color: 'bg-[#5C5C6E]', label: 'Offline' },
    away:    { color: 'bg-[#EF9F27]', label: 'Away' },
    busy:    { color: 'bg-[#E24B4A]', label: 'Busy' },
  }[status];

  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white/[0.04] border border-[#23232E] rounded-full text-xs text-[#8F8FA3]">
      <span className={`w-1.5 h-1.5 rounded-full ${config.color}`} />
      {config.label}
    </span>
  );
}
