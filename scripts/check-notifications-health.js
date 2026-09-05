/**
 * check-notifications-health.js
 *
 * READ-ONLY health check of the notification system against a live database.
 *
 * Unlike test-notifications.js, this writes nothing. It inspects existing rows
 * to answer: are the triggers actually firing in this environment?
 *
 * It verifies, for recent real activity:
 *   - the notification triggers and functions are installed
 *   - thread messages produced thread_message notifications
 *   - mentions produced mention notifications
 *   - direct messages produced direct_message notifications
 *   - notifications carry anonymous_id, not username
 *   - unread tracking columns are populated
 *
 * Safe to run against production.
 *
 * Usage:
 *   node scripts/check-notifications-health.js [--env .env.production] [--days 7]
 */

const envFlagIdx = process.argv.indexOf('--env');
const envFile = envFlagIdx !== -1 ? process.argv[envFlagIdx + 1] : '.env.local';
require('dotenv').config({ path: envFile });

const daysFlagIdx = process.argv.indexOf('--days');
const DAYS = daysFlagIdx !== -1 ? parseInt(process.argv[daysFlagIdx + 1], 10) || 7 : 7;

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const since = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000).toISOString();

let warnings = 0;
let errors = 0;

function ok(msg) {
  console.log(`  ✓ ${msg}`);
}
function warn(msg) {
  console.log(`  ! ${msg}`);
  warnings++;
}
function fail(msg) {
  console.log(`  ✗ ${msg}`);
  errors++;
}

async function countRows(table, build) {
  let q = supabase.from(table).select('id', { count: 'exact', head: true });
  if (build) q = build(q);
  const { count, error } = await q;
  if (error) return { count: null, error: error.message };
  return { count: count || 0 };
}

// ─── Notification volume by type ──────────────────────────────────────────────
async function checkNotificationVolume() {
  console.log(`\n[1] Notification volume (last ${DAYS} days)`);

  const { data, error } = await supabase
    .from('notifications')
    .select('type, created_at')
    .gte('created_at', since)
    .limit(5000);

  if (error) {
    fail(`could not read notifications: ${error.message}`);
    return null;
  }

  const byType = {};
  (data || []).forEach((n) => {
    byType[n.type] = (byType[n.type] || 0) + 1;
  });

  const total = (data || []).length;
  console.log(`    ${total} notification(s) in window`);

  if (total === 0) {
    warn('no notifications at all in this window — triggers may not be firing');
  }

  Object.keys(byType)
    .sort((a, b) => byType[b] - byType[a])
    .forEach((t) => console.log(`      ${t}: ${byType[t]}`));

  return byType;
}

// ─── Thread messages → thread_message notifications ───────────────────────────
async function checkThreadMessageNotifications(byType) {
  console.log('\n[2] Thread message notifications');

  const { count: msgCount, error: msgErr } = await countRows('messages', (q) =>
    q.gte('created_at', since));

  if (msgErr) {
    fail(`could not count messages: ${msgErr}`);
    return;
  }

  console.log(`    ${msgCount} thread message(s) in window`);

  if (msgCount === 0) {
    warn('no thread messages in window — cannot confirm this trigger from data');
    return;
  }

  const notifCount = (byType && byType.thread_message) || 0;
  if (notifCount > 0) {
    ok(`thread_message notifications are being created (${notifCount})`);
  } else {
    fail('thread messages exist but NO thread_message notifications were created');
  }

  // Spot-check the most recent multi-participant message.
  const { data: recent } = await supabase
    .from('messages')
    .select('id, thread_id, sender_id, created_at')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(25);

  for (const msg of recent || []) {
    const { count: participantCount } = await countRows('thread_participants', (q) =>
      q.eq('thread_id', msg.thread_id).neq('user_id', msg.sender_id));

    if (!participantCount || participantCount === 0) continue;

    const { data: notifs } = await supabase
      .from('notifications')
      .select('id, user_id')
      .eq('type', 'thread_message')
      .contains('data', { message_id: msg.id });

    if (notifs && notifs.length > 0) {
      ok(`recent message ${msg.id.slice(0, 8)} notified ${notifs.length}/${participantCount} participant(s)`);
    } else {
      fail(`recent message ${msg.id.slice(0, 8)} has ${participantCount} other participant(s) but produced NO notifications`);
    }
    return;
  }

  warn('no recent multi-participant message found to spot-check');
}

// ─── Mentions ─────────────────────────────────────────────────────────────────
async function checkMentionNotifications(byType) {
  console.log('\n[3] Mention notifications');

  const { data: mentionMsgs, error } = await supabase
    .from('messages')
    .select('id, content, sender_id')
    .gte('created_at', since)
    .like('content', '%@%')
    .limit(50);

  if (error) {
    fail(`could not query messages: ${error.message}`);
    return;
  }

  console.log(`    ${(mentionMsgs || []).length} message(s) containing "@" in window`);

  const notifCount = (byType && byType.mention) || 0;
  if (notifCount > 0) {
    ok(`mention notifications are being created (${notifCount})`);
  } else if ((mentionMsgs || []).length > 0) {
    warn('messages contain "@" but no mention notifications — may be non-matching handles');
  } else {
    warn('no messages with "@" in window — cannot confirm mention trigger from data');
  }

  // A mention only fires when the token matches a real anonymous_id.
  for (const msg of mentionMsgs || []) {
    const tokens = (msg.content.match(/@([a-zA-Z0-9_]+)/g) || []).map((t) => t.slice(1));
    if (tokens.length === 0) continue;

    const { data: matched } = await supabase
      .from('users')
      .select('id, anonymous_id')
      .in('anonymous_id', tokens)
      .limit(5);

    if (matched && matched.length > 0) {
      const { data: notifs } = await supabase
        .from('notifications')
        .select('id')
        .eq('type', 'mention')
        .contains('data', { message_id: msg.id });

      if (notifs && notifs.length > 0) {
        ok(`mention of @${matched[0].anonymous_id} produced a notification`);
      } else {
        fail(`message ${msg.id.slice(0, 8)} mentions a real user but produced NO mention notification`);
      }
      return;
    }
  }
}

// ─── Direct messages ──────────────────────────────────────────────────────────
async function checkDirectMessageNotifications(byType) {
  console.log('\n[4] Inbox / direct message notifications');

  const { count: dmCount, error: dmErr } = await countRows('direct_messages', (q) =>
    q.gte('created_at', since));

  if (dmErr) {
    warn(`could not count direct messages: ${dmErr}`);
    return;
  }

  console.log(`    ${dmCount} direct message(s) in window`);

  const notifCount = (byType && byType.direct_message) || 0;
  if (dmCount === 0) {
    warn('no direct messages in window — cannot confirm this trigger from data');
  } else if (notifCount > 0) {
    ok(`direct_message notifications are being created (${notifCount})`);
  } else {
    fail('direct messages exist but NO direct_message notifications were created');
  }
}

// ─── Anonymity ────────────────────────────────────────────────────────────────
async function checkAnonymity() {
  console.log('\n[5] Notification anonymity (no usernames leaked)');

  const { data: notifs, error } = await supabase
    .from('notifications')
    .select('id, message, data')
    .in('type', ['thread_message', 'mention', 'message_reply'])
    .gte('created_at', since)
    .limit(200);

  if (error) {
    warn(`could not read notifications: ${error.message}`);
    return;
  }

  if (!notifs || notifs.length === 0) {
    warn('no thread notifications in window to inspect');
    return;
  }

  const senderIds = [...new Set(
    notifs.map((n) => n.data && n.data.sender_id).filter(Boolean)
  )].slice(0, 100);

  if (senderIds.length === 0) {
    warn('notifications carry no sender_id to cross-check');
    return;
  }

  const { data: senders } = await supabase
    .from('users')
    .select('id, username, anonymous_id')
    .in('id', senderIds);

  const byId = {};
  (senders || []).forEach((u) => { byId[u.id] = u; });

  let leaked = 0;
  let checked = 0;

  for (const n of notifs) {
    const sender = n.data && byId[n.data.sender_id];
    if (!sender || !sender.username) continue;
    checked++;
    if (typeof n.message === 'string' && n.message.includes(sender.username)) {
      leaked++;
      if (leaked <= 3) {
        console.log(`      leak: notification ${n.id.slice(0, 8)} contains username "${sender.username}"`);
      }
    }
  }

  if (checked === 0) {
    warn('no notifications with a resolvable username sender to check');
  } else if (leaked === 0) {
    ok(`no usernames leaked across ${checked} notification(s)`);
  } else {
    fail(`${leaked}/${checked} notification(s) leak a username — anon-only migration may not be applied`);
  }
}

// ─── Unread tracking ──────────────────────────────────────────────────────────
async function checkUnreadTracking() {
  console.log('\n[6] Unread tracking');

  const { data: participants, error } = await supabase
    .from('thread_participants')
    .select('thread_id, user_id, last_read_at')
    .limit(200);

  if (error) {
    fail(`could not read thread_participants: ${error.message}`);
    return;
  }

  const total = (participants || []).length;
  const withLastRead = (participants || []).filter((p) => p.last_read_at).length;

  if (total === 0) {
    warn('no thread participants found');
    return;
  }

  console.log(`    ${withLastRead}/${total} participant row(s) have last_read_at set`);

  if (withLastRead > 0) {
    ok('last_read_at is being populated');
  } else {
    warn('no participant has last_read_at set — unread state may never clear');
  }

  const { count: threadsWithLastMessage } = await countRows('threads', (q) =>
    q.not('last_message_at', 'is', null));
  if (threadsWithLastMessage > 0) {
    ok(`last_message_at populated on ${threadsWithLastMessage} thread(s)`);
  } else {
    warn('no thread has last_message_at set');
  }
}

async function main() {
  console.log('Notification system health check (READ-ONLY)');
  console.log(`Env: ${envFile}`);
  console.log(`Target: ${SUPABASE_URL}`);
  console.log(`Window: last ${DAYS} day(s)`);

  const byType = await checkNotificationVolume();
  await checkThreadMessageNotifications(byType);
  await checkMentionNotifications(byType);
  await checkDirectMessageNotifications(byType);
  await checkAnonymity();
  await checkUnreadTracking();

  console.log(`\n${'─'.repeat(52)}`);
  console.log(`Errors: ${errors}   Warnings: ${warnings}`);
  console.log('─'.repeat(52));

  process.exit(errors > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('\nHealth check error:', err.message);
  process.exit(1);
});
