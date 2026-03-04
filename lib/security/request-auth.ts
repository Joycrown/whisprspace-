import { NextRequest } from 'next/server'
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js'
import { createClient as createSupabaseServerClient } from '@/lib/core/supabase/server'

export type ResolvedRequestUser = {
  id: string
  email?: string | null
  userMetadata: Record<string, unknown>
}

const createAdminClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase admin environment variables are not configured')
  }

  return createSupabaseAdminClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

const mapUser = (
  user: { id: string; email?: string | null; user_metadata?: unknown } | null
): ResolvedRequestUser | null => {
  if (!user?.id) return null
  const metadata =
    user.user_metadata && typeof user.user_metadata === 'object'
      ? (user.user_metadata as Record<string, unknown>)
      : {}

  return {
    id: user.id,
    email: user.email || null,
    userMetadata: metadata,
  }
}

export const resolveUserFromRequest = async (
  request: NextRequest
): Promise<ResolvedRequestUser | null> => {
  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice('Bearer '.length).trim()
    if (token) {
      try {
        const supabaseAdmin = createAdminClient()
        const { data, error } = await supabaseAdmin.auth.getUser(token)
        if (!error && data?.user) {
          return mapUser(data.user as { id: string; email?: string | null; user_metadata?: unknown })
        }
      } catch (error) {
        console.error('Failed to resolve user from bearer token:', error)
      }
    }
  }

  try {
    const supabase = await createSupabaseServerClient()
    const { data } = await supabase.auth.getUser()
    if (data?.user) {
      return mapUser(data.user as { id: string; email?: string | null; user_metadata?: unknown })
    }
  } catch (error) {
    console.error('Failed to resolve user from cookie session:', error)
  }

  return null
}
