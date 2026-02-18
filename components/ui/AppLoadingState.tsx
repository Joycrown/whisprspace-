'use client'

import WhisprSpinner from './WhisprSpinner'

interface AppLoadingStateProps {
  title?: string
  description?: string
  fullScreen?: boolean
  tone?: 'dark' | 'light'
  className?: string
}

export default function AppLoadingState({
  title = 'Almost there...',
  description,
  fullScreen = true,
  tone = 'dark',
  className = '',
}: AppLoadingStateProps) {
  const isLightTone = tone === 'light'

  return (
    <div
      className={`${
        fullScreen ? 'min-h-screen' : 'min-h-[220px]'
      } ${
        isLightTone ? 'bg-white' : 'bg-[#121212]'
      } flex items-center justify-center px-4 ${className}`}
    >
      <div className="flex flex-col items-center text-center">
        <WhisprSpinner size={52} showText={false} />
        <p className={`mt-4 text-sm font-medium ${isLightTone ? 'text-gray-800' : 'text-gray-200'}`}>
          {title}
        </p>
        {description && (
          <p className={`mt-1 max-w-md text-xs ${isLightTone ? 'text-gray-500' : 'text-gray-400'}`}>
            {description}
          </p>
        )}
      </div>
    </div>
  )
}
