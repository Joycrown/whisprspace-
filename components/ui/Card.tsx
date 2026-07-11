'use client'

import React from 'react';
import { motion } from 'framer-motion';

interface CardProps {
  children: React.ReactNode;
  variant?: 'default' | 'elevated' | 'bordered' | 'gradient';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  hover?: boolean;
  clickable?: boolean;
  className?: string;
  onClick?: () => void;
}

const variantStyles = {
  default:  'bg-[#12121A] border border-[#23232E]',
  elevated: 'bg-[#12121A] border border-[#23232E]',
  bordered: 'bg-[#12121A] border-2 border-[#23232E]',
  gradient: 'bg-[#15101E] border border-[#8B5CF6]/25',
};

const paddingStyles = {
  none: '',
  sm:   'p-3 md:p-4',
  md:   'p-4 md:p-6',
  lg:   'p-6 md:p-8',
};

export function Card({
  children,
  variant = 'default',
  padding = 'md',
  hover = false,
  clickable = false,
  className = '',
  onClick,
}: CardProps) {
  const Component = clickable || onClick ? motion.div : 'div';

  return (
    <Component
      className={`
        ${variantStyles[variant]}
        ${paddingStyles[padding]}
        rounded-2xl transition-colors
        ${hover ? 'hover:border-[#8B5CF6]/40' : ''}
        ${clickable ? 'cursor-pointer active:scale-[0.98]' : ''}
        ${className}
      `}
      onClick={onClick}
      {...(clickable && { whileTap: { scale: 0.98 } })}
    >
      {children}
    </Component>
  );
}

export function CardHeader({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`mb-4 ${className}`}>{children}</div>;
}

export function CardTitle({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <h3 className={`text-base font-medium text-[#F2F2F6] tracking-[-0.3px] ${className}`}>
      {children}
    </h3>
  );
}

export function CardDescription({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={`text-sm text-[#8F8FA3] ${className}`}>{children}</p>
  );
}

export function CardContent({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={className}>{children}</div>;
}

export function CardFooter({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`mt-4 pt-4 border-t border-[#23232E] ${className}`}>{children}</div>
  );
}
