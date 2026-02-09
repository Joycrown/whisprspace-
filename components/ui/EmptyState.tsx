'use client'

import React, { ReactNode } from 'react';
import { LucideIcon } from 'lucide-react';
import { Button } from './Button';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: ReactNode;
  };
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className = '',
}: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center text-center p-8 md:p-12 ${className}`}>
      {Icon && (
        <div className="mb-4 text-gray-600">
          <Icon className="w-12 h-12 md:w-16 md:h-16" />
        </div>
      )}
      
      <h3 className="text-lg md:text-xl font-semibold text-white mb-2">
        {title}
      </h3>
      
      {description && (
        <p className="text-sm md:text-base text-gray-400 mb-6 max-w-md">
          {description}
        </p>
      )}
      
      {action && (
        <Button
          onClick={action.onClick}
          leftIcon={action.icon}
          size="md"
        >
          {action.label}
        </Button>
      )}
    </div>
  );
}

// Preset empty states for common scenarios
export function EmptyThreads() {
  return (
    <EmptyState
      title="No Threads Yet"
      description="Be the first to start a conversation. Create a thread and share your thoughts anonymously."
    />
  );
}

export function EmptyMessages() {
  return (
    <EmptyState
      title="No Messages Yet"
      description="Share your DM link to start receiving anonymous messages from anyone."
    />
  );
}

export function EmptySearchResults() {
  return (
    <EmptyState
      title="No Results Found"
      description="Try adjusting your search terms or filters to find what you're looking for."
    />
  );
}

export function EmptyNotifications() {
  return (
    <EmptyState
      title="All Caught Up!"
      description="You don't have any new notifications right now."
    />
  );
}
