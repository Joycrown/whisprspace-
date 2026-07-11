/**
 * populate-seed-feed.js
 *
 * Directly creates live seed threads and messages from the playbook —
 * bypasses the schedule queue for immediate feed population.
 *
 * Usage:
 *   node scripts/populate-seed-feed.js [--env .env.local] [--threads 5]
 *
 * Examples:
 *   node scripts/populate-seed-feed.js --env .env             # staging, 5 threads
 *   node scripts/populate-seed-feed.js --env .env --threads 16  # staging, all threads
 *   node scripts/populate-seed-feed.js --env .env.production  # production
 */

const envFlagIdx = process.argv.indexOf('--env');
const envFile = envFlagIdx !== -1 ? process.argv[envFlagIdx + 1] : '.env.local';
require('dotenv').config({ path: envFile });
console.log(`Using env: ${envFile}\n`);

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

// Persona → username mapping (mirrors seed-personas.ts exactly)
const PERSONA_TO_USERNAME = {
  deep_thinker:     'zara_m',
  funny_one:        'seun_lol',
  skeptic:          'kennyq8',
  storyteller:      'ade_jnr',
  advisor:          'chisom_o',
  creative:         'dami99',
  researcher:       'tobifx',
  peacemaker:       'kola_w',
  provocateur:      'femi_b7',
  contrarian:       'chuka_x',
  tech_enthusiast:  'ifeoma_k',
  wellness_advocate:'amaka_7',
  realist:          'ngozi_rr',
  optimist:         'bola_t3',
  unfiltered:       'frank_ola',
  curious_one:      'ayok_',
  night_owl:        'babsng',
  wise_beyond_years:'emeka_t',
  debater:          'fola_j',
  poet:             'ada_ink',
};

async function getUserMap() {
  const { data: users, error } = await supabase
    .from('users')
    .select('id, username')
    .eq('is_seed', true);

  if (error) throw new Error(`Failed to get seed users: ${error.message}`);

  const map = {};
  for (const user of (users || [])) {
    const persona = Object.keys(PERSONA_TO_USERNAME).find(
      k => PERSONA_TO_USERNAME[k] === user.username
    );
    if (persona) map[persona] = user.id;
  }
  return map;
}

async function createThread(userId, title, content, category, type, pollOptions) {
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

  const { data: thread, error } = await supabase
    .from('threads')
    .insert({
      creator_id: userId,
      title,
      content,
      type: type || 'text',
      category,
      privacy: 'public',
      is_premium: false,
      is_seed: true,
      expires_at: expiresAt,
    })
    .select('id')
    .single();

  if (error || !thread) throw new Error(`Thread insert failed: ${error?.message}`);

  // Creator joins as participant
  try {
    await supabase.from('thread_participants').insert({ thread_id: thread.id, user_id: userId });
  } catch {}

  // Polls
  if (type === 'poll' && Array.isArray(pollOptions) && pollOptions.length >= 2) {
    try {
      const { data: poll } = await supabase
        .from('polls')
        .insert({
          thread_id: thread.id,
          question: title,
          duration_hours: 48,
          allow_multiple_votes: false,
          expires_at: expiresAt,
        })
        .select('id')
        .single();

      if (poll) {
        await supabase.from('poll_options').insert(
          pollOptions.map((text, idx) => ({ poll_id: poll.id, text, order_index: idx }))
        );
      }
    } catch {}
  }

  return thread.id;
}

async function createMessage(threadId, userId, content, parentMessageId) {
  const { data: message, error } = await supabase
    .from('messages')
    .insert({
      thread_id: threadId,
      sender_id: userId,
      content,
      type: 'text',
      is_seed: true,
      parent_message_id: parentMessageId || null,
    })
    .select('id')
    .single();

  if (error || !message) throw new Error(`Message insert failed: ${error?.message}`);

  // User joins as participant
  try {
    await supabase
      .from('thread_participants')
      .upsert({ thread_id: threadId, user_id: userId }, { onConflict: 'thread_id,user_id' });
  } catch {}

  return message.id;
}

async function main() {
  const threadsFlag = process.argv.indexOf('--threads');
  const threadsLimit = threadsFlag !== -1 ? parseInt(process.argv[threadsFlag + 1], 10) : 5;

  console.log('WhisprSpace — Populate Seed Feed');
  console.log('==================================\n');

  // Confirm seed config
  const { data: config, error: configErr } = await supabase
    .from('seed_config').select('*').eq('id', 1).single();
  if (configErr || !config) {
    console.error('No seed config found. Run reset-and-reload-playbook.js first.');
    process.exit(1);
  }
  console.log(`Seed config: ${config.threads_per_day} threads/day, ` +
    `${config.max_participants_per_thread} participants, ` +
    `${config.messages_per_user} msgs/user, active=${config.is_active}\n`);

  // Build persona → user ID map
  console.log('Loading seed user map...');
  const userMap = await getUserMap();
  console.log(`  Mapped ${Object.keys(userMap).length} personas\n`);

  if (Object.keys(userMap).length === 0) {
    console.error('No seed users found. Run reset-and-reload-playbook.js first.');
    process.exit(1);
  }

  // Pick unused playbook threads
  console.log(`Fetching up to ${threadsLimit} unused playbook threads...`);
  const { data: threads, error: threadErr } = await supabase
    .from('seed_playbook_threads')
    .select('*')
    .eq('is_used', false)
    .order('created_at', { ascending: true })
    .limit(threadsLimit);

  if (threadErr) { console.error(threadErr.message); process.exit(1); }
  console.log(`  Found ${(threads || []).length} unused threads\n`);

  if (!threads || threads.length === 0) {
    console.log('No unused threads available. Reset and reload the playbook first:');
    console.log('  node scripts/reset-and-reload-playbook.js whs_new_batch_final.json --env .env');
    process.exit(0);
  }

  let createdThreads = 0;
  let createdMessages = 0;
  let failedThreads = 0;

  for (let i = 0; i < threads.length; i++) {
    const pb = threads[i];
    const label = pb.title.length > 55 ? pb.title.slice(0, 55) + '…' : pb.title;
    console.log(`── Thread ${i + 1}/${threads.length}: "${label}"`);

    const creatorId = userMap[pb.creator_persona];
    if (!creatorId) {
      console.warn(`  ✗ No user mapped for creator persona: ${pb.creator_persona}`);
      failedThreads++;
      continue;
    }

    let threadId;
    try {
      threadId = await createThread(creatorId, pb.title, pb.content, pb.category, pb.type, pb.poll_options);
      console.log(`  ✓ Thread ${threadId}`);
      createdThreads++;
    } catch (err) {
      console.error(`  ✗ ${err.message}`);
      failedThreads++;
      continue;
    }

    // Fetch replies for this playbook thread
    const { data: replies } = await supabase
      .from('seed_playbook_replies')
      .select('*')
      .eq('thread_playbook_id', pb.id)
      .order('sequence_order', { ascending: true });

    const replyList = replies || [];
    const seqToMsgId = {};
    let replyOk = 0;
    let replyFail = 0;

    for (const r of replyList) {
      const userId = userMap[r.persona_tag];
      if (!userId) { replyFail++; continue; }

      const parentId = r.reply_to_sequence ? (seqToMsgId[r.reply_to_sequence] || null) : null;

      try {
        const msgId = await createMessage(threadId, userId, r.content, parentId);
        seqToMsgId[r.sequence_order] = msgId;
        replyOk++;
        createdMessages++;
      } catch (err) {
        console.warn(`    ✗ Reply seq=${r.sequence_order}: ${err.message}`);
        replyFail++;
      }
    }

    console.log(`  ✓ ${replyOk}/${replyList.length} replies posted${replyFail ? ` (${replyFail} failed)` : ''}`);

    // Mark playbook thread as used
    await supabase
      .from('seed_playbook_threads')
      .update({ is_used: true, times_used: (pb.times_used || 0) + 1 })
      .eq('id', pb.id);
  }

  console.log('\n══════════════════════════════════');
  console.log('Summary');
  console.log('══════════════════════════════════');
  console.log(`Threads created:   ${createdThreads}`);
  console.log(`Messages created:  ${createdMessages}`);
  console.log(`Threads failed:    ${failedThreads}`);
  console.log('\nFeed is now live. Check the admin dashboard or staging.whisprspace.com');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
