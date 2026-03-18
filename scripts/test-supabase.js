
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing env vars');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function test() {
  console.log('Testing connection to:', SUPABASE_URL);
  const { data, error } = await supabase.from('seed_config').select('*').limit(1);
  if (error) {
    console.error('Connection failed:', error.message);
    if (error.cause) console.error('Cause:', error.cause);
  } else {
    console.log('Connection success! Data:', data);
  }
}

test();
