/**
 * Script to apply the storage setup migration
 * Run with: node supabase/apply-storage-migration.js
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyMigration() {
  console.log('🚀 Applying Storage Setup Migration...\n');

  try {
    const migrationPath = path.join(__dirname, 'migrations', '20260118000000_storage_setup.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('Executing SQL...');

    // Split the SQL by statements to handle them individually if needed, 
    // or run them together if the environment supports it via RPC.
    // Note: Most Supabase projects have a custom 'exec_sql' RPC for migrations.

    const { data, error } = await supabase.rpc('exec_sql', { sql });

    if (error) {
      console.warn('⚠️  RPC "exec_sql" failed. This is common if the function hasn\'t been created yet.');
      console.log('Error details:', error);
      console.log('\nAlternative: Please run the SQL manually in the Supabase SQL Editor:');
      console.log('----------------------------------------------------------');
      console.log(sql);
      console.log('----------------------------------------------------------');
      process.exit(1);
    }

    console.log('✅ Migration applied successfully!');
  } catch (error) {
    console.error('❌ Failed to apply migration:', error.message);
    process.exit(1);
  }
}

applyMigration();
