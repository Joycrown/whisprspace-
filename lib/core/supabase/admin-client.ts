/**
 * Supabase Admin Client (Service Role)
 * 
 * Server-side ONLY — bypasses RLS for administrative operations
 * like content seeding. NEVER import this from client components.
 */

import { createClient } from '@supabase/supabase-js';

const getAdminClient = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!url || !key) {
    throw new Error('[AdminClient] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      // Explicitly wrapping fetch to avoid internal undici binding issues on Windows/Node18+
      fetch: (url, options) => fetch(url, options),
    }
  });
};

export const supabaseAdmin = getAdminClient();
