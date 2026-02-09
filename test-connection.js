// Quick test to verify Supabase connection
require('dotenv').config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log('Testing connection to:', SUPABASE_URL);
console.log('Anon key present:', !!SUPABASE_ANON_KEY);

// Test basic fetch
fetch(`${SUPABASE_URL}/rest/v1/`, {
  headers: {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
  }
})
  .then(res => {
    console.log('✅ Connection successful! Status:', res.status);
    return res.text();
  })
  .then(data => {
    console.log('Response:', data);
  })
  .catch(err => {
    console.error('❌ Connection failed:', err.message);
    console.error('This suggests a network or firewall issue');
  });
