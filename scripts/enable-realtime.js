/**
 * Run this script to enable Supabase Realtime
 * Usage: node scripts/enable-realtime.js
 * 
 * Note: This requires your Supabase credentials in .env.local
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function enableRealtime() {
  console.log('🚀 Enabling Supabase Realtime on tables...\n');

  const migrations = [
    'ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS public.messages;',
    'ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS public.notifications;',
    'ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS public.threads;',
    'ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS public.thread_likes;',
    'ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS public.poll_votes;',
  ];

  console.log('⚠️  NOTE: This script cannot execute raw SQL with anon key.');
  console.log('   You need either:');
  console.log('   1. SUPABASE_SERVICE_ROLE_KEY in .env.local');
  console.log('   2. Run SQL manually in Supabase dashboard\n');

  console.log('📋 Copy this SQL and run in Supabase SQL Editor:\n');
  console.log('─'.repeat(60));
  migrations.forEach(sql => console.log(sql));
  console.log('─'.repeat(60));
  console.log('\nOnce run, your realtime features will be enabled! 🎉');
}

enableRealtime();
