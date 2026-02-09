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
  default: 'bg-gray-800 border border-gray-700',
  elevated: 'bg-gray-800 shadow-lg',
  bordered: 'bg-gray-800 border-2 border-gray-700',
  gradient: 'bg-gradient-to-br from-purple-900/30 to-orange-900/30 border border-purple-500/50',
};

const paddingStyles = {
  none: '',
  sm: 'p-3 md:p-4',
  md: 'p-4 md:p-6',
  lg: 'p-6 md:p-8',
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
        rounded-xl transition-all duration-200
        ${hover ? 'hover:border-purple-500/50 hover:shadow-lg' : ''}
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
  return (
    <div className={`mb-4 ${className}`}>
      {children}
    </div>
  );
}

export function CardTitle({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <h3 className={`text-lg md:text-xl font-semibold text-white ${className}`}>
      {children}
    </h3>
  );
}

export function CardDescription({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={`text-sm md:text-base text-gray-400 ${className}`}>
      {children}
    </p>
  );
}

export function CardContent({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      {children}
    </div>
  );
}

export function CardFooter({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`mt-4 pt-4 border-t border-gray-700 ${className}`}>
      {children}
    </div>
  );
}
