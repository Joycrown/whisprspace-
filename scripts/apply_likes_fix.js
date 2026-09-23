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
    const sqlPath = path.join(__dirname, '20260126010000_fix_likes_policies.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('Running SQL migration for Likes Policies...');
    const { error } = await supabase.rpc('exec_sql', { sql });

    if (error) {
      console.error('RPC exec_sql failed:', error.message);
      // Fallback or exit
      process.exit(1);
    }

    console.log('✅ Likes Policies updated successfully');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

runSQL();
