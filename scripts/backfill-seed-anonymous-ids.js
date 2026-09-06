/**
 * backfill-seed-anonymous-ids.js
 *
 * Rewrites anonymous_id for existing seed users from the old prefixed formats
 * (SEED_MAYA0000, seed_ranter_1738...) to the same format real users get
 * (SilentWhisper4823), so seeded threads no longer identify themselves.
 *
 * Threads render anonymous_id only, so any row left on an old format is
 * visibly synthetic to end users.
 *
 * Dry-run by default. Pass --apply to write.
 *
 * Usage:
 *   node scripts/backfill-seed-anonymous-ids.js [--env .env.local] [--apply]
 *
 * Examples:
 *   node scripts/backfill-seed-anonymous-ids.js --env .env.production
 *   node scripts/backfill-seed-anonymous-ids.js --env .env.production --apply
 */

const envFlagIdx = process.argv.indexOf('--env');
const envFile = envFlagIdx !== -1 ? process.argv[envFlagIdx + 1] : '.env.local';
require('dotenv').config({ path: envFile });

const APPLY = process.argv.includes('--apply');

console.log(`Using env: ${envFile}`);
console.log(APPLY ? 'Mode: APPLY (writes)\n' : 'Mode: DRY RUN (no writes) — pass --apply to commit\n');

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

// Mirrors generateSeedAnonymousId in lib/seeding/seed-service.ts
function generateAnonymousId() {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let suffix = '';
  for (let i = 0; i < 8; i++) {
    suffix += letters[Math.floor(Math.random() * letters.length)];
  }
  return `ANON_${suffix}`;
}

// Target shape: ANON_ + 8 uppercase letters. Anything else on a seed row is
// stale — the old SEED_/seed_ prefixes, or the word-style IDs used briefly
// before this format was settled on.
function needsBackfill(anonymousId) {
  if (!anonymousId) return true;
  return !/^ANON_[A-Z]{8}$/.test(anonymousId);
}

async function main() {
  const { data: seedUsers, error: seedErr } = await supabase
    .from('users')
    .select('id, anonymous_id, username')
    .eq('is_seed', true)
    .order('created_at', { ascending: true });

  if (seedErr) {
    console.error('Failed to load seed users:', seedErr.message);
    process.exit(1);
  }

  if (!seedUsers || seedUsers.length === 0) {
    console.log('No seed users found. Nothing to do.');
    return;
  }

  const stale = seedUsers.filter((u) => needsBackfill(u.anonymous_id));
  console.log(`Seed users: ${seedUsers.length} total, ${stale.length} needing backfill\n`);

  if (stale.length === 0) {
    console.log('All seed users already use the real-user ID format.');
    return;
  }

  // Reserve every anonymous_id in the table, not just seed rows, so a
  // regenerated ID can't collide with a real user's.
  const { data: allIds, error: allErr } = await supabase
    .from('users')
    .select('anonymous_id');

  if (allErr) {
    console.error('Failed to load existing anonymous_ids:', allErr.message);
    process.exit(1);
  }

  const taken = new Set((allIds || []).map((u) => u.anonymous_id).filter(Boolean));

  const plan = stale.map((user) => {
    let next = generateAnonymousId();
    while (taken.has(next)) {
      next = generateAnonymousId();
    }
    taken.add(next);
    return { user, next };
  });

  for (const { user, next } of plan) {
    console.log(`  ${user.username || '(no username)'}: ${user.anonymous_id} → ${next}`);
  }

  if (!APPLY) {
    console.log(`\nDry run complete. ${plan.length} row(s) would be updated.`);
    console.log('Re-run with --apply to write these changes.');
    return;
  }

  console.log('');
  let updated = 0;
  let failed = 0;

  for (const { user, next } of plan) {
    const { error } = await supabase
      .from('users')
      .update({ anonymous_id: next })
      .eq('id', user.id)
      .eq('is_seed', true);

    if (error) {
      console.error(`  ✗ ${user.username || user.id}: ${error.message}`);
      failed++;
    } else {
      updated++;
    }
  }

  console.log(`\n✓ Updated ${updated}/${plan.length} seed users${failed ? ` (${failed} failed)` : ''}`);
}

main().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
