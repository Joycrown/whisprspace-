'use client'

import React from 'react';
import { AlertTriangle, WifiOff, ServerCrash, ShieldAlert } from 'lucide-react';
import { Button } from './Button';

interface ErrorStateProps {
  type?: 'general' | 'network' | 'server' | 'forbidden';
  title?: string;
  message?: string;
  retry?: () => void;
  className?: string;
}

const errorConfig = {
  general:   { icon: AlertTriangle, defaultTitle: 'Something went wrong',   defaultMessage: 'An unexpected error occurred. Please try again.' },
  network:   { icon: WifiOff,       defaultTitle: 'Connection lost',         defaultMessage: 'Check your internet connection and try again.' },
  server:    { icon: ServerCrash,   defaultTitle: 'Server error',            defaultMessage: 'Our servers are having trouble. Please try again later.' },
  forbidden: { icon: ShieldAlert,   defaultTitle: 'Access denied',           defaultMessage: "You don't have permission to access this." },
};

export function ErrorState({
  type = 'general',
  title,
  message,
  retry,
  className = '',
}: ErrorStateProps) {
  const { icon: Icon, defaultTitle, defaultMessage } = errorConfig[type];

  return (
    <div className={`flex flex-col items-center justify-center text-center p-8 md:p-12 ${className}`}>
      <div className="mb-4 text-[#E24B4A]">
        <Icon className="w-10 h-10 md:w-12 md:h-12" />
      </div>

      <h3 className="text-base font-medium text-[#F2F2F6] tracking-[-0.3px] mb-1">
        {title || defaultTitle}
      </h3>

      <p className="text-sm text-[#8F8FA3] mb-6 max-w-sm leading-relaxed">
        {message || defaultMessage}
      </p>

      {retry && (
        <Button onClick={retry} variant="secondary" size="md">
          Try again
        </Button>
      )}
    </div>
  );
}

export function InlineError({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 px-4 py-3 rounded-xl border border-[#E24B4A]/30 bg-[#E24B4A]/[0.07] text-sm text-[#F2F2F6]">
      <AlertTriangle className="w-4 h-4 text-[#E24B4A] flex-shrink-0" />
      <span>{message}</span>
    </div>
  );
}

export function ErrorBanner({ message, onDismiss }: { message: string; onDismiss?: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 border-l-2 border-[#E24B4A] bg-[#E24B4A]/[0.07] text-[#F2F2F6]">
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-[#E24B4A] flex-shrink-0" />
        <span className="text-sm">{message}</span>
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="text-[#5C5C6E] hover:text-[#F2F2F6] transition-colors text-lg leading-none"
        >
          ×
        </button>
      )}
    </div>
  );
}
