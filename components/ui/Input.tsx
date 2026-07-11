'use client'

import React, { forwardRef } from 'react';
import { AlertCircle } from 'lucide-react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(({
  label,
  error,
  helperText,
  leftIcon,
  rightIcon,
  fullWidth = false,
  className = '',
  ...props
}, ref) => {
  return (
    <div className={fullWidth ? 'w-full' : ''}>
      {label && (
        <label className="block text-xs font-medium text-[#8F8FA3] uppercase tracking-wide mb-1.5">
          {label}
        </label>
      )}

      <div className="relative">
        {leftIcon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5C5C6E]">
            {leftIcon}
          </div>
        )}

        <input
          ref={ref}
          className={`
            w-full h-11 px-4 rounded-xl
            text-sm text-[#F2F2F6] placeholder-[#5C5C6E]
            bg-white/[0.03] border
            focus:outline-none transition-colors
            disabled:opacity-40 disabled:cursor-not-allowed
            ${leftIcon ? 'pl-10' : ''}
            ${rightIcon || error ? 'pr-10' : ''}
            ${error
              ? 'border-[#E24B4A]/60 focus:border-[#E24B4A]'
              : 'border-[#2A2A38] focus:border-[#8B5CF6]/60'}
            ${className}
          `}
          style={{ fontSize: '16px' }}
          {...props}
        />

        {rightIcon && !error && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5C5C6E]">
            {rightIcon}
          </div>
        )}

        {error && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[#E24B4A]">
            <AlertCircle className="w-4 h-4" />
          </div>
        )}
      </div>

      {error && (
        <p className="mt-1.5 text-xs text-[#E24B4A]">{error}</p>
      )}

      {helperText && !error && (
        <p className="mt-1.5 text-xs text-[#5C5C6E]">{helperText}</p>
      )}
    </div>
  );
});

Input.displayName = 'Input';
