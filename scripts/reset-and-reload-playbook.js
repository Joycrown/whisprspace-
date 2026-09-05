/**
 * reset-and-reload-playbook.js
 *
 * Full seed reset: wipes all old seed content (playbook, schedule, published
 * seed threads/messages, seed users), then re-creates seed users and imports
 * a fresh playbook JSON.
 *
 * Usage:
 *   node scripts/reset-and-reload-playbook.js <playbook.json> [--env .env.local]
 *
 * Examples:
 *   node scripts/reset-and-reload-playbook.js whs_new_batch_final.json
 *   node scripts/reset-and-reload-playbook.js whs_new_batch_final.json --env .env.production
 */

const envFlagIdx = process.argv.indexOf('--env');
const envFile = envFlagIdx !== -1 ? process.argv[envFlagIdx + 1] : '.env.local';
require('dotenv').config({ path: envFile });
console.log(`Using env: ${envFile}\n`);

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

// ─── Personas (matches lib/seeding/seed-personas.ts) ─────────────────────────
const SEED_USERS = [
  { username: 'zara_m',    persona: 'deep_thinker',      tone: 'Philosophical, reflective, asks probing questions',       categories: ['general', 'lifestyle', 'education'] },
  { username: 'seun_lol',  persona: 'funny_one',          tone: 'Witty, sarcastic, uses humor to make points',             categories: ['entertainment', 'general', 'lifestyle'] },
  { username: 'kennyq8',   persona: 'skeptic',            tone: 'Questions everything, asks for evidence, analytical',     categories: ['tech', 'politics', 'business'] },
  { username: 'ade_jnr',   persona: 'storyteller',        tone: 'Shares anecdotes, narrative style, vivid details',       categories: ['general', 'lifestyle', 'entertainment'] },
  { username: 'chisom_o',  persona: 'advisor',            tone: 'Gives practical advice, empathetic, warm',               categories: ['health', 'lifestyle', 'education'] },
  { username: 'dami99',    persona: 'creative',           tone: 'Imaginative, brings unique perspectives',                categories: ['tech', 'entertainment', 'education'] },
  { username: 'tobifx',    persona: 'researcher',         tone: 'Data-driven, cites facts and stats',                     categories: ['tech', 'business', 'politics'] },
  { username: 'kola_w',    persona: 'peacemaker',         tone: 'Calm, bridges disagreements, inclusive',                 categories: ['general', 'health', 'lifestyle'] },
  { username: 'femi_b7',   persona: 'provocateur',        tone: 'Hot takes, bold opinions, sparks debate',                categories: ['politics', 'entertainment', 'business'] },
  { username: 'chuka_x',   persona: 'contrarian',         tone: 'Plays devils advocate thoughtfully',                     categories: ['politics', 'general', 'education'] },
  { username: 'ifeoma_k',  persona: 'tech_enthusiast',    tone: 'Passionate about tech, breaks down complex topics',      categories: ['tech', 'business', 'education'] },
  { username: 'amaka_7',   persona: 'wellness_advocate',  tone: 'Focused on health, balance, self-care',                  categories: ['health', 'lifestyle', 'general'] },
  { username: 'ngozi_rr',  persona: 'realist',            tone: 'Practical, grounded, no-nonsense',                       categories: ['business', 'general', 'politics'] },
  { username: 'bola_t3',   persona: 'optimist',           tone: 'Sees the bright side, motivational',                     categories: ['lifestyle', 'health', 'education'] },
  { username: 'frank_ola', persona: 'unfiltered',         tone: 'Direct, honest, cut-the-BS style',                       categories: ['general', 'politics', 'business'] },
  { username: 'ayok_',     persona: 'curious_one',        tone: 'Asks lots of questions, genuinely curious',              categories: ['education', 'tech', 'general'] },
  { username: 'babsng',    persona: 'night_owl',          tone: 'Casual late-night vibe, relatable',                      categories: ['general', 'entertainment', 'lifestyle'] },
  { username: 'emeka_t',   persona: 'wise_beyond_years',  tone: 'Mature perspective, timeless wisdom',                    categories: ['education', 'lifestyle', 'health'] },
  { username: 'fola_j',    persona: 'debater',            tone: 'Loves structured arguments, thesis-style',               categories: ['politics', 'business', 'tech'] },
  { username: 'ada_ink',   persona: 'poet',               tone: 'Poetic, metaphorical, emotionally resonant',             categories: ['general', 'lifestyle', 'entertainment'] },
];

function randomId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

// ─── Step 1: Wipe old seed content ───────────────────────────────────────────
async function cleanup() {
  console.log('── Step 1: Cleaning up old seed content ──');

  // Get seed user IDs first (needed for thread_participants)
  const { data: seedUsers } = await supabase
    .from('users')
    .select('id')
    .eq('is_seed', true);
  const seedUserIds = (seedUsers || []).map(u => u.id);

  const steps = [
    { table: 'seed_activity_log',     filter: q => q.neq('id', '00000000-0000-0000-0000-000000000000') },
    { table: 'seed_scheduled_content',filter: q => q.neq('id', '00000000-0000-0000-0000-000000000000') },
    { table: 'messages',              filter: q => q.eq('is_seed', true) },
    { table: 'seed_playbook_replies', filter: q => q.neq('id', '00000000-0000-0000-0000-000000000000') },
    { table: 'seed_playbook_threads', filter: q => q.neq('id', '00000000-0000-0000-0000-000000000000') },
  ];

  // thread_participants only if there are seed users
  if (seedUserIds.length > 0) {
    const { error } = await supabase
      .from('thread_participants')
      .delete()
      .in('user_id', seedUserIds);
    if (error) console.warn('  thread_participants cleanup warning:', error.message);
    else console.log('  ✓ thread_participants');
  }

  for (const step of steps) {
    const { error } = await step.filter(supabase.from(step.table).delete());
    if (error) console.warn(`  ${step.table} cleanup warning:`, error.message);
    else console.log(`  ✓ ${step.table}`);
  }

  // Threads last (after messages)
  const { error: threadErr } = await supabase
    .from('threads')
    .delete()
    .eq('is_seed', true);
  if (threadErr) console.warn('  threads cleanup warning:', threadErr.message);
  else console.log('  ✓ threads');

  // Seed users last
  const { error: userErr } = await supabase
    .from('users')
    .delete()
    .eq('is_seed', true);
  if (userErr) console.warn('  users cleanup warning:', userErr.message);
  else console.log('  ✓ users (seed personas)');

  console.log('  Done.\n');
}

// Mirrors generateAnonymousId in lib/utils.ts
function generateAnonymousId() {
  const adjectives = [
    'Anonymous', 'Mysterious', 'Silent', 'Hidden', 'Secret', 'Quiet',
    'Invisible', 'Unknown', 'Nameless', 'Faceless', 'Shadowy', 'Enigmatic'
  ];
  const nouns = [
    'Whisper', 'Voice', 'Soul', 'Mind', 'Spirit', 'Thought',
    'Dream', 'Echo', 'Shadow', 'Phantom', 'Ghost', 'Wanderer'
  ];
  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const number = Math.floor(Math.random() * 9999) + 1;
  return `${adjective}${noun}${number}`;
}

// ─── Step 2: Create seed users ────────────────────────────────────────────────
async function createSeedUsers() {
  console.log('── Step 2: Creating seed users ──');

  let created = 0;
  let skipped = 0;
  const takenAnonymousIds = new Set();
  for (const profile of SEED_USERS) {
    let anonymousId = generateAnonymousId();
    while (takenAnonymousIds.has(anonymousId)) {
      anonymousId = generateAnonymousId();
    }
    takenAnonymousIds.add(anonymousId);
    const { error } = await supabase.from('users').insert({
      id: randomId(),
      anonymous_id: anonymousId,
      username: profile.username,
      is_anonymous: true,
      is_seed: true,
      is_premium: false,
      points: Math.floor(Math.random() * 200) + 50,
      level: Math.floor(Math.random() * 3) + 1,
      preferences: { persona: profile.persona, tone: profile.tone, categories: profile.categories },
    });
    if (error) {
      console.warn(`  ✗ Failed to create ${profile.username} (${profile.persona}):`, error.message);
      skipped++;
    } else {
      created++;
    }
  }
  console.log(`  ✓ Created ${created}/${SEED_USERS.length} seed users (${skipped} failed)\n`);
}

// ─── Step 3: Import new playbook ─────────────────────────────────────────────
async function importPlaybook(filePath) {
  console.log(`── Step 3: Importing playbook from ${filePath} ──`);

  let threads;
  try {
    threads = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    console.error(`Failed to parse JSON: ${err.message}`);
    process.exit(1);
  }

  if (!Array.isArray(threads)) {
    console.error('JSON must be an array of thread objects.');
    process.exit(1);
  }

  console.log(`  Loaded ${threads.length} threads`);

  let inserted = 0;
  let failed = 0;
  let totalReplies = 0;

  for (let i = 0; i < threads.length; i++) {
    const thread = threads[i];

    if (!thread.title || !thread.content || !thread.category || !thread.creatorPersona) {
      console.warn(`  ✗ Thread ${i + 1} missing required fields, skipping`);
      failed++;
      continue;
    }

    const { data: insertedThread, error: threadErr } = await supabase
      .from('seed_playbook_threads')
      .insert({
        title: thread.title.trim(),
        content: thread.content.trim(),
        category: thread.category,
        type: thread.type || 'text',
        poll_options: thread.pollOptions || null,
        creator_persona: thread.creatorPersona,
      })
      .select('id')
      .single();

    if (threadErr || !insertedThread) {
      console.error(`  ✗ Thread ${i + 1} insert failed: ${threadErr?.message}`);
      failed++;
      continue;
    }

    const replies = (thread.replies || []).map((r, idx) => ({
      thread_playbook_id: insertedThread.id,
      persona_tag: r.personaTag,
      content: r.content,
      sequence_order: r.sequenceOrder ?? (idx + 1),
      reply_to_sequence: r.replyToSequence ?? null,
    }));

    // Insert replies in batches of 100
    for (let b = 0; b < replies.length; b += 100) {
      const batch = replies.slice(b, b + 100);
      const { error: replyErr } = await supabase.from('seed_playbook_replies').insert(batch);
      if (replyErr) {
        console.error(`  ✗ Replies for thread ${i + 1} batch failed: ${replyErr.message}`);
      } else {
        totalReplies += batch.length;
      }
    }

    inserted++;
    process.stdout.write(`\r  Progress: ${i + 1}/${threads.length} | Inserted: ${inserted} | Replies: ${totalReplies}`);
  }

  console.log(`\n  Done.\n`);
  return { inserted, failed, totalReplies };
}

// ─── Step 4: Activate seeding ─────────────────────────────────────────────────
async function activateSeeding() {
  console.log('── Step 4: Activating seeding ──');
  const { error } = await supabase
    .from('seed_config')
    .update({ is_active: true })
    .gte('id', 0);
  if (error) console.warn('  Could not activate seeding:', error.message);
  else console.log('  ✓ Seeding is active\n');
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const inputFile = process.argv[2];
  if (!inputFile) {
    console.error('Usage: node scripts/reset-and-reload-playbook.js <playbook.json> [--env .env.local]');
    process.exit(1);
  }

  if (!fs.existsSync(inputFile)) {
    console.error(`File not found: ${inputFile}`);
    process.exit(1);
  }

  console.log('WhisprSpace Seed Reset & Reload');
  console.log('================================\n');

  await cleanup();
  await createSeedUsers();
  const result = await importPlaybook(inputFile);
  await activateSeeding();

  console.log('══════════════════════════════════');
  console.log('Summary');
  console.log('══════════════════════════════════');
  console.log(`Threads imported:  ${result.inserted}`);
  console.log(`Threads failed:    ${result.failed}`);
  console.log(`Replies imported:  ${result.totalReplies}`);
  console.log('\nNext step: go to the admin dashboard → Seeding tab');
  console.log('→ Click "Prepare Today\'s Schedule" then "Approve" to start the new content.');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
