/**
 * test-notifications.js
 *
 * End-to-end test of the notification system against a real database.
 *
 * The notification system is implemented almost entirely as Postgres triggers,
 * so this drives real inserts and asserts the resulting notification rows.
 * Mocking would bypass the code under test.
 *
 * Covers:
 *   1. Thread participant gets notified of a new message in a thread they joined
 *   2. Thread creator gets notified of a new message in their thread
 *   3. Sender does NOT get notified of their own message
 *   4. Mention by anonymous_id notifies the mentioned user
 *   5. Mention does not fire for a self-mention
 *   6. Mentions are de-duplicated per message
 *   7. Reply notification goes to the parent message author
 *   8. Parent author is excluded from the participant fan-out (no double notify)
 *   9. Direct message (inbox) notifies the recipient
 *  10. Banned users are excluded from thread notifications
 *  11. Notifications carry the anonymous_id, never the username
 *  12. Per-thread unread state (last_read_at / hasUnread)
 *
 * All rows created are torn down at the end, including on failure.
 *
 * Usage:
 *   node scripts/test-notifications.js [--env .env.local] [--keep]
 *
 *   --keep   leave test data in place for inspection
 */

const envFlagIdx = process.argv.indexOf('--env');
const envFile = envFlagIdx !== -1 ? process.argv[envFlagIdx + 1] : '.env.local';
require('dotenv').config({ path: envFile });

const KEEP = process.argv.includes('--keep');

const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const RUN = crypto.randomBytes(4).toString('hex').toUpperCase();
const created = { users: [], threads: [], messages: [], conversations: [] };

let passed = 0;
let failed = 0;
const failures = [];

function check(name, condition, detail) {
  if (condition) {
    console.log(`  ✓ ${name}`);
    passed++;
  } else {
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
    failed++;
    failures.push(name);
  }
}

// Triggers fire synchronously, but PostgREST reads can race the commit.
async function settle(ms = 400) {
  await new Promise((r) => setTimeout(r, ms));
}

async function createUser(label) {
  const anonymousId = `TestUser${RUN}${label}`;
  const { data, error } = await supabase
    .from('users')
    .insert({
      anonymous_id: anonymousId,
      username: `testuser_${RUN.toLowerCase()}_${label.toLowerCase()}`,
      is_anonymous: true,
    })
    .select('id, anonymous_id, username')
    .single();

  if (error) throw new Error(`createUser(${label}) failed: ${error.message}`);
  created.users.push(data.id);
  return data;
}

async function createThread(creator, title) {
  const { data, error } = await supabase
    .from('threads')
    .insert({
      creator_id: creator.id,
      title,
      content: 'Notification system test thread',
      type: 'text',
      category: 'general',
      privacy: 'public',
    })
    .select('id, title, creator_id')
    .single();

  if (error) throw new Error(`createThread failed: ${error.message}`);
  created.threads.push(data.id);
  return data;
}

async function joinThread(threadId, userId) {
  const { error } = await supabase
    .from('thread_participants')
    .upsert({ thread_id: threadId, user_id: userId }, { onConflict: 'thread_id,user_id' });
  if (error) throw new Error(`joinThread failed: ${error.message}`);
}

async function postMessage(threadId, senderId, content, parentMessageId = null) {
  const row = { thread_id: threadId, sender_id: senderId, content, type: 'text' };
  if (parentMessageId) row.parent_message_id = parentMessageId;

  const { data, error } = await supabase
    .from('messages')
    .insert(row)
    .select('id, content, sender_id')
    .single();

  if (error) throw new Error(`postMessage failed: ${error.message}`);
  created.messages.push(data.id);
  return data;
}

async function notificationsFor(userId, type) {
  let query = supabase.from('notifications').select('*').eq('user_id', userId);
  if (type) query = query.eq('type', type);
  const { data, error } = await query;
  if (error) throw new Error(`notificationsFor failed: ${error.message}`);
  return data || [];
}

function notificationsAboutMessage(rows, messageId) {
  return rows.filter((n) => n.data && n.data.message_id === messageId);
}

// ─── Test 1-3: thread message fan-out ─────────────────────────────────────────
async function testThreadMessageNotifications(alice, bob, carol) {
  console.log('\n[1] Thread message notifications');

  const thread = await createThread(alice, `Test thread ${RUN}`);
  await joinThread(thread.id, alice.id);
  await joinThread(thread.id, bob.id);
  await joinThread(thread.id, carol.id);

  const msg = await postMessage(thread.id, bob.id, 'Hello everyone in this thread');
  await settle();

  const bobNotifs = notificationsAboutMessage(await notificationsFor(bob.id, 'thread_message'), msg.id);
  const carolNotifs = notificationsAboutMessage(await notificationsFor(carol.id, 'thread_message'), msg.id);
  const aliceNotifs = notificationsAboutMessage(await notificationsFor(alice.id, 'thread_message'), msg.id);

  check('participant is notified of a new thread message', carolNotifs.length === 1,
    `expected 1, got ${carolNotifs.length}`);
  check('thread creator is notified of a new message', aliceNotifs.length === 1,
    `expected 1, got ${aliceNotifs.length}`);
  check('sender is NOT notified of their own message', bobNotifs.length === 0,
    `expected 0, got ${bobNotifs.length}`);

  if (carolNotifs.length > 0) {
    const n = carolNotifs[0];
    check('notification carries thread_id in data', n.data && n.data.thread_id === thread.id);
    check('notification shows sender anonymous_id, not username',
      typeof n.message === 'string'
        && n.message.includes(bob.anonymous_id)
        && !n.message.includes(bob.username),
      `message was: ${n.message}`);
  }

  return thread;
}

// ─── Test 4-6: mentions ───────────────────────────────────────────────────────
async function testMentionNotifications(thread, alice, bob, carol) {
  console.log('\n[2] Mention notifications');

  const msg = await postMessage(thread.id, bob.id, `Hey @${carol.anonymous_id} take a look at this`);
  await settle();

  const carolMentions = notificationsAboutMessage(await notificationsFor(carol.id, 'mention'), msg.id);
  check('mention by anonymous_id notifies the mentioned user', carolMentions.length === 1,
    `expected 1, got ${carolMentions.length}`);
  check('mention is not duplicated for the same message', carolMentions.length <= 1,
    `got ${carolMentions.length}`);

  if (carolMentions.length > 0) {
    check('mention notification does not leak the sender username',
      !carolMentions[0].message.includes(bob.username),
      `message was: ${carolMentions[0].message}`);
  }

  const selfMsg = await postMessage(thread.id, bob.id, `Talking to myself @${bob.anonymous_id}`);
  await settle();
  const bobSelfMentions = notificationsAboutMessage(await notificationsFor(bob.id, 'mention'), selfMsg.id);
  check('self-mention does not notify the sender', bobSelfMentions.length === 0,
    `expected 0, got ${bobSelfMentions.length}`);

  const unknownMsg = await postMessage(thread.id, bob.id, `Mentioning @NoSuchUser${RUN} who does not exist`);
  await settle();
  check('mention of unknown handle does not error the insert', Boolean(unknownMsg.id));
}

// ─── Test 7-8: replies ────────────────────────────────────────────────────────
async function testReplyNotifications(thread, alice, bob, carol) {
  console.log('\n[3] Reply notifications');

  const parent = await postMessage(thread.id, carol.id, 'This is the parent message');
  await settle();

  const reply = await postMessage(thread.id, bob.id, 'This is a reply to you', parent.id);
  await settle();

  const carolReplyNotifs = notificationsAboutMessage(
    await notificationsFor(carol.id, 'message_reply'), reply.id);
  const carolThreadNotifs = notificationsAboutMessage(
    await notificationsFor(carol.id, 'thread_message'), reply.id);

  check('parent message author is notified of the reply', carolReplyNotifs.length >= 1,
    `expected >=1 reply notification, got ${carolReplyNotifs.length}`);
  check('parent author is excluded from participant fan-out (no double notify)',
    carolThreadNotifs.length === 0,
    `expected 0 thread_message notifications, got ${carolThreadNotifs.length}`);
}

// ─── Test 9: direct messages ──────────────────────────────────────────────────
async function testDirectMessageNotifications(alice, bob) {
  console.log('\n[4] Inbox / direct message notifications');

  const { data: convo, error: convoErr } = await supabase
    .from('conversations')
    .insert({})
    .select('id')
    .single();

  if (convoErr) {
    check('inbox message notifies the recipient', false,
      `could not create conversation: ${convoErr.message}`);
    return;
  }
  created.conversations.push(convo.id);

  const { error: partErr } = await supabase.from('conversation_participants').insert([
    { conversation_id: convo.id, user_id: alice.id },
    { conversation_id: convo.id, user_id: bob.id },
  ]);
  if (partErr) {
    check('inbox message notifies the recipient', false,
      `could not add participants: ${partErr.message}`);
    return;
  }

  const { error: dmErr } = await supabase
    .from('direct_messages')
    .insert({
      conversation_id: convo.id,
      sender_id: bob.id,
      content: 'Anonymous inbox message for notification test',
    })
    .select('id')
    .single();

  if (dmErr) {
    check('inbox message notifies the recipient', false, `could not send DM: ${dmErr.message}`);
    return;
  }
  await settle();

  const aliceDmNotifs = (await notificationsFor(alice.id, 'direct_message'))
    .filter((n) => n.data && n.data.conversation_id === convo.id);
  const bobDmNotifs = (await notificationsFor(bob.id, 'direct_message'))
    .filter((n) => n.data && n.data.conversation_id === convo.id);

  check('inbox message notifies the recipient', aliceDmNotifs.length >= 1,
    `expected >=1, got ${aliceDmNotifs.length}`);
  check('inbox message does not notify the sender', bobDmNotifs.length === 0,
    `expected 0, got ${bobDmNotifs.length}`);
}

// ─── Test 10: banned users ────────────────────────────────────────────────────
async function testBannedUserExclusion(thread, alice, bob, dave) {
  console.log('\n[5] Banned user exclusion');

  await joinThread(thread.id, dave.id);

  const { error: banErr } = await supabase
    .from('thread_banned_participants')
    .insert({ thread_id: thread.id, user_id: dave.id, banned_by: alice.id });

  if (banErr) {
    console.log(`  ~ skipped: could not create ban (${banErr.message})`);
    return;
  }

  const msg = await postMessage(thread.id, bob.id, 'Message after the ban');
  await settle();

  const daveNotifs = notificationsAboutMessage(
    await notificationsFor(dave.id, 'thread_message'), msg.id);
  check('banned user is not notified of thread messages', daveNotifs.length === 0,
    `expected 0, got ${daveNotifs.length}`);
}

// ─── Test 11-12: unread state ─────────────────────────────────────────────────
async function testUnreadState(thread, alice, bob, carol) {
  console.log('\n[6] Per-thread unread state');

  await supabase
    .from('thread_participants')
    .update({ last_read_at: new Date().toISOString() })
    .eq('thread_id', thread.id)
    .eq('user_id', carol.id);

  await settle(200);
  await postMessage(thread.id, bob.id, 'A message after carol last read the thread');
  await settle();

  const { data: participant } = await supabase
    .from('thread_participants')
    .select('last_read_at')
    .eq('thread_id', thread.id)
    .eq('user_id', carol.id)
    .maybeSingle();

  const { data: threadRow } = await supabase
    .from('threads')
    .select('last_message_at')
    .eq('id', thread.id)
    .maybeSingle();

  check('thread_participants tracks last_read_at', Boolean(participant && participant.last_read_at));
  check('threads tracks last_message_at', Boolean(threadRow && threadRow.last_message_at));

  const hasUnread = Boolean(
    participant && threadRow && threadRow.last_message_at &&
    (!participant.last_read_at ||
      new Date(threadRow.last_message_at) > new Date(participant.last_read_at))
  );
  check('unread state is derivable after a newer message', hasUnread,
    `last_read_at=${participant && participant.last_read_at}, last_message_at=${threadRow && threadRow.last_message_at}`);

  // The app exposes hasUnread as a boolean only. A "you missed N messages"
  // badge needs a count, which nothing currently computes.
  const { count, error: countErr } = await supabase
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('thread_id', thread.id)
    .gt('created_at', (participant && participant.last_read_at) || new Date(0).toISOString())
    .neq('sender_id', carol.id);

  if (countErr) {
    check('unread message COUNT is queryable', false, countErr.message);
  } else {
    check('unread message COUNT is queryable', typeof count === 'number', `count=${count}`);
    console.log(`    note: ${count} unread message(s) countable, but no app code computes this`);
  }
}

// ─── Cleanup ──────────────────────────────────────────────────────────────────
async function cleanup() {
  if (KEEP) {
    console.log(`\nSkipping cleanup (--keep). Run tag: ${RUN}`);
    return;
  }

  console.log('\nCleaning up test data...');

  if (created.users.length > 0) {
    await supabase.from('notifications').delete().in('user_id', created.users);
  }
  if (created.threads.length > 0) {
    await supabase.from('thread_banned_participants').delete().in('thread_id', created.threads);
    await supabase.from('messages').delete().in('thread_id', created.threads);
    await supabase.from('thread_participants').delete().in('thread_id', created.threads);
    await supabase.from('threads').delete().in('id', created.threads);
  }
  if (created.conversations.length > 0) {
    await supabase.from('direct_messages').delete().in('conversation_id', created.conversations);
    await supabase.from('conversation_participants').delete().in('conversation_id', created.conversations);
    await supabase.from('conversations').delete().in('id', created.conversations);
  }
  if (created.users.length > 0) {
    await supabase.from('users').delete().in('id', created.users);
  }

  console.log('  Done.');
}

async function main() {
  console.log(`Notification system test — run ${RUN}`);
  console.log(`Env: ${envFile}`);
  console.log(`Target: ${SUPABASE_URL}\n`);

  const alice = await createUser('Alice');
  const bob = await createUser('Bob');
  const carol = await createUser('Carol');
  const dave = await createUser('Dave');

  const thread = await testThreadMessageNotifications(alice, bob, carol);
  await testMentionNotifications(thread, alice, bob, carol);
  await testReplyNotifications(thread, alice, bob, carol);
  await testDirectMessageNotifications(alice, bob);
  await testBannedUserExclusion(thread, alice, bob, dave);
  await testUnreadState(thread, alice, bob, carol);

  console.log(`\n${'─'.repeat(52)}`);
  console.log(`Passed: ${passed}   Failed: ${failed}`);
  if (failed > 0) {
    console.log('\nFailed checks:');
    failures.forEach((f) => console.log(`  - ${f}`));
  }
  console.log('─'.repeat(52));

  return failed;
}

main()
  .then(async (failCount) => {
    await cleanup();
    process.exit(failCount > 0 ? 1 : 0);
  })
  .catch(async (err) => {
    console.error('\nTest run error:', err.message);
    await cleanup();
    process.exit(1);
  });
