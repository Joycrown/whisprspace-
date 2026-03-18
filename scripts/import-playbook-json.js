/**
 * import-playbook-json.js
 *
 * Imports a playbook JSON file into Supabase (seed_playbook_threads + seed_playbook_replies).
 * Skips threads that already exist by title — safe to re-run.
 *
 * Usage:
 *   node scripts/import-playbook-json.js <playbook.json> [--env .env.production]
 *
 * Defaults to .env.local. Use --env to target a different environment:
 *   node scripts/import-playbook-json.js whisprspace_300_threads_expanded.json --env .env.production
 *
 * Expects the env file to have:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * JSON format expected:
 * [
 *   {
 *     "title": "string",
 *     "content": "string",
 *     "category": "general|tech|lifestyle|...",
 *     "type": "text|poll",
 *     "pollOptions": ["option1", "option2"],   // optional, polls only
 *     "creatorPersona": "storyteller",
 *     "replies": [
 *       { "personaTag": "advisor", "content": "...", "sequenceOrder": 1 }
 *     ]
 *   }
 * ]
 */

const envFlagIdx = process.argv.indexOf('--env');
const envFile = envFlagIdx !== -1 ? process.argv[envFlagIdx + 1] : '.env.local';
require('dotenv').config({ path: envFile });
console.log(`Using env: ${envFile}`);
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

// Valid categories — extend if your playbook uses others
const VALID_CATEGORIES = ['general', 'tech', 'lifestyle', 'entertainment', 'politics', 'education', 'business', 'health'];
const VALID_TYPES = ['text', 'poll'];

function validateThread(thread, idx) {
  const errors = [];
  if (!thread.title || typeof thread.title !== 'string') errors.push('missing title');
  if (!thread.content || typeof thread.content !== 'string') errors.push('missing content');
  if (!thread.category) errors.push('missing category');
  if (!thread.creatorPersona) errors.push('missing creatorPersona');
  if (thread.type && !VALID_TYPES.includes(thread.type)) errors.push(`invalid type "${thread.type}"`);
  if (!Array.isArray(thread.replies) || thread.replies.length === 0) errors.push('no replies array');
  if (errors.length > 0) {
    console.warn(`[${idx + 1}] Warning — thread "${String(thread.title).slice(0, 50)}" has issues: ${errors.join(', ')}`);
    return false;
  }
  return true;
}

async function main() {
  const inputFile = process.argv[2];
  if (!inputFile) {
    console.error('Usage: node scripts/import-playbook-json.js <playbook.json>');
    process.exit(1);
  }

  if (!fs.existsSync(inputFile)) {
    console.error(`File not found: ${inputFile}`);
    process.exit(1);
  }

  console.log(`Reading ${inputFile}...`);
  let threads;
  try {
    threads = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
  } catch (err) {
    console.error(`Failed to parse JSON: ${err.message}`);
    process.exit(1);
  }

  if (!Array.isArray(threads)) {
    console.error('JSON must be an array of thread objects.');
    process.exit(1);
  }

  console.log(`Loaded ${threads.length} threads.\n`);

  // Fetch all existing threads (title + reply count) in one query
  const { data: existing, error: fetchErr } = await supabase
    .from('seed_playbook_threads')
    .select('id, title, seed_playbook_replies(count)');

  if (fetchErr) {
    console.error(`Failed to fetch existing threads: ${fetchErr.message}`);
    process.exit(1);
  }

  // Map title → { id, replyCount } for duplicate + incomplete reply detection
  const existingMap = new Map(
    (existing || []).map(t => [t.title, { id: t.id, replyCount: t.seed_playbook_replies[0]?.count ?? 0 }])
  );
  console.log(`Already in DB: ${existingMap.size} threads\n`);

  let inserted = 0;
  let skipped = 0;
  let invalid = 0;
  let totalReplies = 0;
  let replyErrors = 0;

  for (let i = 0; i < threads.length; i++) {
    const thread = threads[i];

    // Validate
    if (!validateThread(thread, i)) {
      invalid++;
      continue;
    }

    // Skip if already in DB with a full reply set
    const dbEntry = existingMap.get(thread.title);
    if (dbEntry) {
      const expectedReplies = (thread.replies || []).length;
      if (dbEntry.replyCount >= expectedReplies) {
        skipped++;
        continue;
      }
      // Thread exists but replies are incomplete — insert missing replies only
      console.log(`[${i + 1}] Patching replies for "${thread.title.slice(0, 60)}" (has ${dbEntry.replyCount}/${expectedReplies})`);
      const missing = (thread.replies || []).slice(dbEntry.replyCount).map((r, idx) => ({
        thread_playbook_id: dbEntry.id,
        persona_tag: r.personaTag,
        content: r.content,
        sequence_order: dbEntry.replyCount + idx + 1,
        reply_to_sequence: r.replyToSequence ?? null,
      }));
      const { error: patchErr } = await supabase.from('seed_playbook_replies').insert(missing);
      if (patchErr) {
        console.error(`  ✗ Patch failed: ${patchErr.message}`);
        replyErrors++;
      } else {
        totalReplies += missing.length;
        console.log(`  ✓ Patched ${missing.length} replies`);
      }
      skipped++;
      continue;
    }

    // Insert thread
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
      console.error(`[${i + 1}] ✗ Thread insert failed: ${threadErr?.message}`);
      invalid++;
      continue;
    }

    // Insert replies in batches of 100 to avoid payload limits
    const replies = (thread.replies || []).map((r, idx) => ({
      thread_playbook_id: insertedThread.id,
      persona_tag: r.personaTag,
      content: r.content,
      sequence_order: r.sequenceOrder ?? (idx + 1),
      reply_to_sequence: r.replyToSequence ?? null,
    }));

    const BATCH_SIZE = 100;
    for (let b = 0; b < replies.length; b += BATCH_SIZE) {
      const batch = replies.slice(b, b + BATCH_SIZE);
      const { error: replyErr } = await supabase
        .from('seed_playbook_replies')
        .insert(batch);

      if (replyErr) {
        console.error(`[${i + 1}] ✗ Reply batch failed: ${replyErr.message}`);
        replyErrors++;
      } else {
        totalReplies += batch.length;
      }
    }

    inserted++;
    existingMap.set(thread.title, { id: insertedThread.id, replyCount: replies.length }); // prevent re-insert if JSON has duplicate titles

    if ((i + 1) % 25 === 0 || i === threads.length - 1) {
      process.stdout.write(`\rProgress: ${i + 1}/${threads.length} | Inserted: ${inserted} | Skipped: ${skipped} | Replies: ${totalReplies}`);
    }
  }

  console.log('\n\n─── Import Summary ───────────────────────────────');
  console.log(`Threads inserted:  ${inserted}`);
  console.log(`Threads skipped:   ${skipped} (already in DB)`);
  console.log(`Invalid/errored:   ${invalid}`);
  console.log(`Replies inserted:  ${totalReplies}`);
  console.log(`Reply batch errors: ${replyErrors}`);
  console.log(`\nDone.`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
