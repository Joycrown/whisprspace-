const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runSQL() {
  try {
    const sqlPath = path.join(__dirname, '20260126000000_add_thread_participants.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('Running SQL migration...');
    const { error } = await supabase.rpc('exec_sql', { sql });

    if (error) {
      // Fallback: try to just create the table via raw query if supported or error out
      console.error('RPC exec_sql failed:', error.message);
      console.log('Attempting alternative execution via raw query...');
      // This part depends on Supabase setup. Usually RPC exec_sql is custom.
      // If it fails, we inform the user.
      process.exit(1);
    }

    console.log('✅ Migration executed successfully');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

runSQL();
