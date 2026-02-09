'use client'

import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { useState } from 'react'
import { createQueryClient } from './client'

/**
 * React Query Provider Component
 * Wraps the app to provide React Query functionality
 */
export function QueryProvider({ children }: { children: React.ReactNode }) {
  // Create QueryClient instance once per component mount
  // This ensures a stable client across re-renders
  const [queryClient] = useState(() => createQueryClient())

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {/* Only include DevTools in development */}
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools
          initialIsOpen={false}
          buttonPosition="bottom-left"
          position="bottom"
        />
      )}
    </QueryClientProvider>
  )
}
