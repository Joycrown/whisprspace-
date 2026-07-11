'use client'

import React from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  children: React.ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  // Hero — gradient, used once per view max
  primary: 'text-white hover:opacity-90',
  // Secondary — low-contrast surface
  secondary: 'bg-white/[0.05] border border-[#2A2A38] text-[#F2F2F6] hover:bg-white/[0.08]',
  // Ghost — text only
  ghost: 'bg-transparent text-[#8F8FA3] hover:text-[#F2F2F6]',
  // Danger — red-tinted surface (not solid red)
  danger: 'bg-[#E24B4A]/[0.08] border border-[#E24B4A]/30 text-[#E24B4A] hover:bg-[#E24B4A]/[0.15]',
  // Success — teal-tinted surface
  success: 'bg-[#5DCAA5]/[0.08] border border-[#5DCAA5]/30 text-[#5DCAA5] hover:bg-[#5DCAA5]/[0.15]',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm min-h-[36px]',
  md: 'px-4 py-2.5 text-sm min-h-[44px]',
  lg: 'px-5 py-3 text-sm min-h-[50px]',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  leftIcon,
  rightIcon,
  disabled,
  className = '',
  children,
  style,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;

  const gradientStyle =
    variant === 'primary'
      ? { background: 'linear-gradient(100deg, #8B5CF6 0%, #F97316 100%)', ...style }
      : style;

  return (
    <motion.button
      whileTap={!isDisabled ? { scale: 0.97 } : {}}
      className={`
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${fullWidth ? 'w-full' : ''}
        ${isDisabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
        font-medium rounded-[11px] transition-all
        flex items-center justify-center gap-2
        focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/50
        ${className}
      `}
      disabled={isDisabled}
      style={gradientStyle}
      {...props}
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
      {!loading && leftIcon}
      {children}
      {!loading && rightIcon}
    </motion.button>
  );
}
