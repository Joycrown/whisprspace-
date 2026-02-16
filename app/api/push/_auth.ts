import { NextRequest } from 'next/server'
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js'
import { createClient as createSupabaseServerClient } from '@/lib/core/supabase/server'

type ResolvedRequestUser = {
  id: string
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

export const resolveUserFromRequest = async (
  request: NextRequest
): Promise<ResolvedRequestUser | null> => {
  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice('Bearer '.length)
    try {
      const supabaseAdmin = createAdminClient()
      const { data, error } = await supabaseAdmin.auth.getUser(token)
      if (!error && data?.user?.id) {
        return { id: data.user.id }
      }
    } catch (error) {
      console.error('Failed to resolve user from bearer token:', error)
    }
  }

  try {
    const supabase = await createSupabaseServerClient()
    const { data } = await supabase.auth.getUser()
    if (data?.user?.id) {
      return { id: data.user.id }
    }
  } catch (error) {
    console.error('Failed to resolve user from cookie session:', error)
  }

  return null
}

