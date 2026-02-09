// Quick test script to verify Supabase connectivity outside of React
// Run with: node scripts/test-supabase.js

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_KEY in .env.local');
  process.exit(1);
}

console.log('🔗 Supabase URL:', supabaseUrl);

const supabase = createClient(supabaseUrl, supabaseKey);

async function testConnection() {
  console.log('\n📡 Testing SELECT from users...');
  const start1 = Date.now();
  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('id, anonymous_id')
    .limit(1);
  console.log(`✅ SELECT users: ${Date.now() - start1}ms`, usersError ? `ERROR: ${usersError.message}` : `Found ${users?.length} user(s)`);

  console.log('\n📡 Testing SELECT from threads...');
  const start2 = Date.now();
  const { data: threads, error: threadsError } = await supabase
    .from('threads')
    .select('id, title')
    .limit(1);
  console.log(`✅ SELECT threads: ${Date.now() - start2}ms`, threadsError ? `ERROR: ${threadsError.message}` : `Found ${threads?.length} thread(s)`);

  // Get a valid thread ID and user ID for INSERT test
  if (threads?.length > 0 && users?.length > 0) {
    const threadId = threads[0].id;
    const userId = users[0].id;

    console.log('\n📡 Testing INSERT into messages...');
    const start3 = Date.now();
    const { data: message, error: insertError } = await supabase
      .from('messages')
      .insert({
        thread_id: threadId,
        sender_id: userId,
        content: 'TEST MESSAGE FROM SCRIPT - DELETE ME',
        type: 'text',
        attachments: [],
      })
      .select('id, content')
      .single();
    console.log(`✅ INSERT message: ${Date.now() - start3}ms`, insertError ? `ERROR: ${insertError.message}` : `Created message ID: ${message?.id}`);

    // Clean up test message
    if (message?.id) {
      console.log('\n🗑️ Cleaning up test message...');
      await supabase.from('messages').delete().eq('id', message.id);
      console.log('✅ Test message deleted');
    }
  } else {
    console.log('\n⚠️ Skipping INSERT test - no threads or users found');
  }
}

testConnection()
  .then(() => {
    console.log('\n✅ All tests completed!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n❌ Test failed:', err);
    process.exit(1);
  });
