import type { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/core/supabase/admin-client'
import { resolveUserFromRequest } from '@/lib/security/request-auth'

export async function requireAdmin(request: NextRequest): Promise<{ id: string } | null> {
  const user = await resolveUserFromRequest(request)
  if (!user) return null

  const [{ data: profile }, { data: adminRow }] = await Promise.all([
    supabaseAdmin.from('users').select('is_admin').eq('id', user.id).maybeSingle(),
    supabaseAdmin.from('admin_users').select('role').eq('user_id', user.id).maybeSingle(),
  ])

  return profile?.is_admin === true || adminRow ? { id: user.id } : null
}
