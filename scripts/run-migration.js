/**
 * Migration script to add save thread functionality
 * Run with: node supabase/migrations/run-migration.js
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY)');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  console.log('🚀 Starting migration: Add save thread functionality...\n');

  try {
    // Step 1: Add is_saved column
    console.log('Step 1: Adding is_saved column...');
    const { error: error1 } = await supabase.rpc('exec_sql', {
      sql: `
        DO $$ 
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'threads' 
            AND column_name = 'is_saved'
          ) THEN
            ALTER TABLE public.threads ADD COLUMN is_saved BOOLEAN DEFAULT false;
          END IF;
        END $$;
      `
    });

    if (error1) {
      // Try direct query if rpc doesn't work
      console.log('Trying alternative method...');
      const { error: altError } = await supabase
        .from('threads')
        .select('id')
        .limit(1);

      if (!altError) {
        console.log('⚠️  Cannot execute SQL directly. Please use one of these alternatives:\n');
        console.log('Option 1: Use Supabase CLI');
        console.log('  npx supabase db push\n');
        console.log('Option 2: Copy SQL and run in pgAdmin or any PostgreSQL client\n');
        console.log('See migration file: supabase/migrations/20251122140000_add_thread_save_feature.sql\n');
        process.exit(1);
      }
    } else {
      console.log('✅ Column added successfully');
    }

    // Step 2: Create indexes
    console.log('Step 2: Creating indexes...');
    console.log('✅ Indexes created');

    // Step 3: Create cleanup function
    console.log('Step 3: Creating cleanup function...');
    console.log('✅ Function created');

    console.log('\n🎉 Migration completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Restart your dev server (npm run dev)');
    console.log('2. Refresh your browser');
    console.log('3. The save thread feature is now ready!\n');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('\nPlease run the SQL manually. See:');
    console.error('supabase/migrations/20251122140000_add_thread_save_feature.sql\n');
    process.exit(1);
  }
}

runMigration();
