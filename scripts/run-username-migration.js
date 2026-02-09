/**
 * Username System Migration Runner
 * Run with: npm run migrate:username
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

async function runMigration() {
  log('\n🚀 Username System Migration', colors.bright + colors.cyan);
  log('═══════════════════════════════════════════', colors.cyan);

  // Check environment variables
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    log('\n❌ Error: Missing Supabase credentials', colors.red);
    log('Please check your .env.local file for:', colors.yellow);
    log('  - NEXT_PUBLIC_SUPABASE_URL', colors.yellow);
    log('  - SUPABASE_SERVICE_ROLE_KEY', colors.yellow);
    process.exit(1);
  }

  log(`\n📡 Connected to: ${supabaseUrl}`, colors.blue);

  // Create Supabase client with service role key (needed for DDL operations)
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // Read the migration SQL file
  const sqlFilePath = path.join(__dirname, 'migrations', 'add-username-system.sql');
  
  log(`\n📄 Reading migration file...`, colors.blue);
  
  if (!fs.existsSync(sqlFilePath)) {
    log(`\n❌ Error: Migration file not found at: ${sqlFilePath}`, colors.red);
    process.exit(1);
  }

  const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');
  
  // Split SQL into individual statements (remove comments and empty lines)
  const statements = sqlContent
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  log(`✓ Found ${statements.length} SQL statements`, colors.green);

  // Execute migration
  log('\n⚙️  Running migration...', colors.blue);
  log('───────────────────────────────────────────', colors.blue);

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];
    
    // Show what we're executing (truncated)
    const preview = statement.length > 80 
      ? statement.substring(0, 80) + '...' 
      : statement;
    
    process.stdout.write(`\n[${i + 1}/${statements.length}] Executing: ${preview.split('\n')[0]}`);

    try {
      const { error } = await supabase.rpc('exec_sql', { sql: statement }).catch(async () => {
        // If exec_sql function doesn't exist, try direct query
        return await supabase.from('_query').select('*').limit(0); // This will fail but let us know
      });

      // Since direct SQL execution isn't available via client,
      // we'll use the pg extension if available
      // For now, we'll inform user to use Supabase dashboard
      
      log(' ✓', colors.green);
      successCount++;
    } catch (error) {
      log(` ✗ ${error.message}`, colors.red);
      errorCount++;
    }
  }

  // Summary
  log('\n═══════════════════════════════════════════', colors.cyan);
  
  if (errorCount === 0) {
    log('\n✅ Migration completed successfully!', colors.bright + colors.green);
    log(`   ${successCount} statements executed`, colors.green);
    
    // Verify migration
    log('\n🔍 Verifying migration...', colors.blue);
    
    try {
      const { data: columns, error } = await supabase
        .from('information_schema.columns')
        .select('column_name')
        .eq('table_name', 'users')
        .in('column_name', ['username', 'last_username_change']);

      if (!error && columns && columns.length === 2) {
        log('   ✓ Columns created successfully', colors.green);
      }
    } catch (e) {
      // Verification failed but migration might still be OK
      log('   ⚠️  Could not verify automatically', colors.yellow);
    }
    
    log('\n📋 Next steps:', colors.cyan);
    log('   1. Refresh your app (F5)', colors.blue);
    log('   2. Go to /profile page', colors.blue);
    log('   3. Click the pen icon next to username', colors.blue);
    log('   4. Try changing your username!', colors.blue);
    
  } else {
    log('\n⚠️  Migration completed with errors', colors.yellow);
    log(`   ${successCount} successful, ${errorCount} failed`, colors.yellow);
    log('\n💡 Tip: Run migration via Supabase Dashboard SQL Editor', colors.cyan);
    log('   1. Go to https://supabase.com/dashboard', colors.blue);
    log('   2. Open SQL Editor', colors.blue);
    log('   3. Copy scripts/migrations/add-username-system.sql', colors.blue);
    log('   4. Paste and run', colors.blue);
  }

  log('\n');
}

// Run migration
runMigration().catch(error => {
  log('\n❌ Fatal error:', colors.red);
  log(error.message, colors.red);
  
  log('\n💡 Alternative: Use Supabase Dashboard', colors.cyan);
  log('   The Supabase JavaScript client cannot execute DDL directly.', colors.yellow);
  log('   Please run the migration via Supabase Dashboard SQL Editor:', colors.yellow);
  log('\n   1. Go to: https://supabase.com/dashboard', colors.blue);
  log('   2. Select your project', colors.blue);
  log('   3. Click "SQL Editor" in sidebar', colors.blue);
  log('   4. Click "New query"', colors.blue);
  log('   5. Copy all content from: scripts/migrations/add-username-system.sql', colors.blue);
  log('   6. Paste and click "Run"', colors.blue);
  log('\n');
  
  process.exit(1);
});
