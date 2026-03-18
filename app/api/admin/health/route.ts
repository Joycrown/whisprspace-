
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const res = await fetch('https://www.google.com', { method: 'HEAD' });
    return NextResponse.json({ 
      status: 'ok', 
      can_reach_google: res.ok,
      supabase_url_exists: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      admin_key_exists: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      node_version: process.version
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message, stack: err.stack }, { status: 500 });
  }
}
