import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { resolveUserFromRequest } from '@/lib/security/request-auth'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

export async function GET(request: NextRequest) {
  try {
    const user = await resolveUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    // Verify Admin Status
    const { data: userRecord, error: userError } = await supabaseAdmin
      .from('users')
      .select('is_admin')
      .eq('id', user.id)
      .single()

    const { data: adminUser, error: adminError } = await supabaseAdmin
      .from('admin_users')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle()

    if (userError || (!userRecord?.is_admin && !adminUser)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Fetch all payout requests
    const { data: requests, error } = await supabaseAdmin
      .from('payout_requests')
      .select(`
        *,
        user:users(anonymous_id, email)
      `)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Failed to fetch payout requests for admin:', error)
      return NextResponse.json({ error: 'Failed to load requests' }, { status: 500 })
    }

    return NextResponse.json({ data: requests })
  } catch (error) {
    console.error('Admin payout listing error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
