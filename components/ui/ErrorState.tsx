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
  general: {
    icon: AlertTriangle,
    defaultTitle: 'Something Went Wrong',
    defaultMessage: 'An unexpected error occurred. Please try again.',
  },
  network: {
    icon: WifiOff,
    defaultTitle: 'Connection Lost',
    defaultMessage: 'Please check your internet connection and try again.',
  },
  server: {
    icon: ServerCrash,
    defaultTitle: 'Server Error',
    defaultMessage: 'Our servers are having trouble. Please try again later.',
  },
  forbidden: {
    icon: ShieldAlert,
    defaultTitle: 'Access Denied',
    defaultMessage: "You don't have permission to access this resource.",
  },
};

export function ErrorState({
  type = 'general',
  title,
  message,
  retry,
  className = '',
}: ErrorStateProps) {
  const config = errorConfig[type];
  const Icon = config.icon;

  return (
    <div className={`flex flex-col items-center justify-center text-center p-8 md:p-12 ${className}`}>
      <div className="mb-4 text-red-500">
        <Icon className="w-12 h-12 md:w-16 md:h-16" />
      </div>
      
      <h3 className="text-lg md:text-xl font-semibold text-white mb-2">
        {title || config.defaultTitle}
      </h3>
      
      <p className="text-sm md:text-base text-gray-400 mb-6 max-w-md">
        {message || config.defaultMessage}
      </p>
      
      {retry && (
        <Button onClick={retry} variant="secondary">
          Try Again
        </Button>
      )}
    </div>
  );
}

// Inline error component for forms
export function InlineError({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 p-3 bg-red-900/20 border border-red-500/50 rounded-lg text-red-400 text-sm">
      <AlertTriangle className="w-4 h-4 flex-shrink-0" />
      <span>{message}</span>
    </div>
  );
}

// Banner error for page-level errors
export function ErrorBanner({ 
  message, 
  onDismiss 
}: { 
  message: string; 
  onDismiss?: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 p-4 bg-red-900/20 border-l-4 border-red-500 text-red-400">
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-5 h-5 flex-shrink-0" />
        <span className="text-sm md:text-base">{message}</span>
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="text-red-400 hover:text-red-300 transition-colors"
        >
          ×
        </button>
      )}
    </div>
  );
}
