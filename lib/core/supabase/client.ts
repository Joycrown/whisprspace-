import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// CRITICAL: Separate clients to prevent realtime subscription state from corrupting data operations
// Data Client: Used for INSERT/SELECT/UPDATE queries (thread-service, mutations)
export const supabase = createClient()

// Realtime Client: Used ONLY for realtime subscriptions (channels, presence, broadcasts)
// This prevents realtime state changes from affecting database operations
export const realtimeClient = createClient()
