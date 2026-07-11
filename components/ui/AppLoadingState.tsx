'use client'

import WhisprSpinner from './WhisprSpinner'

interface AppLoadingStateProps {
  title?: string
  description?: string
  fullScreen?: boolean
  className?: string
  // tone prop kept for API compatibility but dark is always used
  tone?: 'dark' | 'light'
}

export default function AppLoadingState({
  title = 'Almost there...',
  description,
  fullScreen = true,
  className = '',
}: AppLoadingStateProps) {
  return (
    <div
      className={`${fullScreen ? 'min-h-screen' : 'min-h-[220px]'} bg-[#0A0A10] flex items-center justify-center px-4 ${className}`}
    >
      <div className="flex flex-col items-center text-center">
        <WhisprSpinner size={48} showText={false} />
        <p className="mt-4 text-sm font-medium text-[#8F8FA3]">{title}</p>
        {description && (
          <p className="mt-1 max-w-sm text-xs text-[#5C5C6E] leading-relaxed">{description}</p>
        )}
      </div>
    </div>
  )
}
