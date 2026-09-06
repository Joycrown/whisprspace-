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
        <div className="mb-4 text-[#5C5C6E]">
          <Icon className="w-10 h-10 md:w-12 md:h-12" />
        </div>
      )}

      <h3 className="text-base font-medium text-[#F2F2F6] tracking-[-0.3px] mb-1">
        {title}
      </h3>

      {description && (
        <p className="text-sm text-[#8F8FA3] mb-6 max-w-sm leading-relaxed">
          {description}
        </p>
      )}

      {action && (
        <Button onClick={action.onClick} leftIcon={action.icon} size="md">
          {action.label}
        </Button>
      )}
    </div>
  );
}

export function EmptyThreads() {
  return (
    <EmptyState
      title="No discussions yet"
      description="Be the first to start a conversation. Create a discussion and speak freely."
    />
  );
}

export function EmptyMessages() {
  return (
    <EmptyState
      title="No messages yet"
      description="Share your inbox link to start receiving anonymous messages from anyone."
    />
  );
}

export function EmptySearchResults() {
  return (
    <EmptyState
      title="No results"
      description="Try adjusting your search terms or filters."
    />
  );
}

export function EmptyNotifications() {
  return (
    <EmptyState
      title="All caught up"
      description="No new notifications right now."
    />
  );
}
