/**
 * Seed Service — Low-level CRUD for seeding system
 * Uses Supabase admin client (service role) to bypass RLS
 */

import { supabaseAdmin } from '@/lib/core/supabase/admin-client';
import { SEED_USERS } from './seed-personas';
import { SEED_THREADS, PlaybookThread, PlaybookReply } from './content-playbook';

// ─── SEED CONFIG ─────────────────────────────────────────────

export interface SeedConfig {
  is_active: boolean;
  threads_per_day: number;
  thread_spacing_minutes: number;
  max_participants_per_thread: number;
  messages_per_user: number;
  reply_interval_minutes: number;
  first_thread_hour: number;
  last_run_at: string | null;
}

export async function getSeedConfig(): Promise<SeedConfig> {
  const { data, error } = await supabaseAdmin
    .from('seed_config')
    .select('*')
    .eq('id', 1)
    .single();

  if (error) throw new Error(`Failed to get seed config: ${error.message}`);
  return data as SeedConfig;
}

export async function updateSeedConfig(updates: Partial<SeedConfig>): Promise<SeedConfig> {
  const { data, error } = await supabaseAdmin
    .from('seed_config')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', 1)
    .select()
    .single();

  if (error) throw new Error(`Failed to update seed config: ${error.message}`);
  return data as SeedConfig;
}

// ─── SEED USERS ──────────────────────────────────────────────

export async function getSeedUsers() {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('id, anonymous_id, username, is_seed')
    .eq('is_seed', true)
    .order('created_at', { ascending: true });

  if (error) throw new Error(`Failed to get seed users: ${error.message}`);
  return data || [];
}

export async function createSeedUsers(): Promise<{ created: number; skipped: number }> {
  // Check existing seed users
  const existing = await getSeedUsers();
  const existingUsernames = new Set(existing.map((u: any) => u.username));

  let created = 0;
  let skipped = 0;

  for (const profile of SEED_USERS) {
    if (existingUsernames.has(profile.username)) {
      skipped++;
      continue;
    }

    const anonymousId = `SEED_${profile.username.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8).padEnd(8, '0')}`;

    const { error } = await supabaseAdmin
      .from('users')
      .insert({
        anonymous_id: anonymousId,
        username: profile.username,
        is_anonymous: true,
        is_seed: true,
        points: Math.floor(Math.random() * 200) + 50,
        level: Math.floor(Math.random() * 3) + 1,
        preferences: {
          theme: 'system',
          notifications: { email: false, push: false, inApp: false, likes: false, replies: false, mentions: false, groupInvites: false },
          privacy: { showOnlineStatus: false, allowDirectMessages: false },
        },
      });

    if (error) {
      console.error(`Failed to create seed user ${profile.username}:`, error.message);
      continue;
    }

    created++;
    await logActivity('user_created', 'user', anonymousId, undefined, { username: profile.username, persona: profile.persona });
  }

  return { created, skipped };
}

/**
 * Get seed user ID by persona tag
 */
export async function getSeedUserByPersona(personaTag: string): Promise<string | null> {
  const profile = SEED_USERS.find(u => u.persona === personaTag);
  if (!profile) return null;

  const { data } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('username', profile.username)
    .eq('is_seed', true)
    .single();

  return data?.id || null;
}

/**
 * Get map of persona -> userId for all seed users
 */
export async function getSeedUserMap(): Promise<Record<string, string>> {
  const users = await getSeedUsers();
  const map: Record<string, string> = {};

  for (const user of users) {
    const profile = SEED_USERS.find(p => p.username === user.username);
    if (profile) {
      map[profile.persona] = user.id;
    }
  }

  return map;
}

// ─── PLAYBOOK MANAGEMENT ─────────────────────────────────────

export async function loadPlaybookIntoDB(): Promise<{ threads: number; replies: number }> {
  let threadCount = 0;
  let replyCount = 0;

  for (const thread of SEED_THREADS) {
    // Check if already exists (by title)
    const { data: existing } = await supabaseAdmin
      .from('seed_playbook_threads')
      .select('id')
      .eq('title', thread.title)
      .limit(1);

    if (existing && existing.length > 0) continue;

    // Insert thread template
    const { data: insertedThread, error: threadErr } = await supabaseAdmin
      .from('seed_playbook_threads')
      .insert({
        title: thread.title,
        content: thread.content,
        category: thread.category,
        type: thread.type,
        poll_options: thread.pollOptions || null,
        creator_persona: thread.creatorPersona,
      })
      .select('id')
      .single();

    if (threadErr || !insertedThread) {
      console.error(`Failed to insert playbook thread: ${threadErr?.message}`);
      continue;
    }

    threadCount++;

    // Insert reply templates
    for (const reply of thread.replies) {
      const { error: replyErr } = await supabaseAdmin
        .from('seed_playbook_replies')
        .insert({
          thread_playbook_id: insertedThread.id,
          persona_tag: reply.personaTag,
          content: reply.content,
          sequence_order: reply.sequenceOrder,
          reply_to_sequence: reply.replyToSequence || null,
        });

      if (replyErr) {
        console.error(`Failed to insert playbook reply: ${replyErr.message}`);
        continue;
      }
      replyCount++;
    }
  }

  return { threads: threadCount, replies: replyCount };
}

export async function getPlaybookStats() {
  const { count: totalThreads } = await supabaseAdmin
    .from('seed_playbook_threads')
    .select('*', { count: 'exact', head: true });

  const { count: usedThreads } = await supabaseAdmin
    .from('seed_playbook_threads')
    .select('*', { count: 'exact', head: true })
    .eq('is_used', true);

  const { count: totalReplies } = await supabaseAdmin
    .from('seed_playbook_replies')
    .select('*', { count: 'exact', head: true });

  return {
    totalThreads: totalThreads || 0,
    usedThreads: usedThreads || 0,
    availableThreads: (totalThreads || 0) - (usedThreads || 0),
    totalReplies: totalReplies || 0,
  };
}

// ─── THREAD & MESSAGE CREATION ───────────────────────────────

export async function createSeedThread(
  userId: string,
  title: string,
  content: string,
  category: string,
  type: 'text' | 'poll' = 'text',
  pollOptions?: string[]
): Promise<string | null> {
  // Calculate expiration (48h for free threads)
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

  const { data: thread, error } = await supabaseAdmin
    .from('threads')
    .insert({
      creator_id: userId,
      title,
      content,
      type,
      category,
      privacy: 'public',
      is_premium: false,
      is_seed: true,
      expires_at: expiresAt,
    })
    .select('id')
    .single();

  if (error || !thread) {
    console.error('Failed to create seed thread:', error?.message);
    return null;
  }

  // Auto-join creator as participant
  await supabaseAdmin
    .from('thread_participants')
    .insert({ thread_id: thread.id, user_id: userId })
    .then(() => {})
    .catch((err: any) => console.warn('Failed to add creator as participant:', err));

  // If poll, create poll + options
  if (type === 'poll' && pollOptions && pollOptions.length >= 2) {
    const { data: poll, error: pollErr } = await supabaseAdmin
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

    if (poll && !pollErr) {
      const options = pollOptions.map((text, index) => ({
        poll_id: poll.id,
        text,
        order_index: index,
      }));

      await supabaseAdmin.from('poll_options').insert(options);
    }
  }

  await logActivity('thread_created', 'thread', thread.id, userId, { title, category, type });
  return thread.id;
}

export async function createSeedMessage(
  threadId: string,
  userId: string,
  content: string,
  parentMessageId?: string
): Promise<string | null> {
  const { data: message, error } = await supabaseAdmin
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

  if (error || !message) {
    console.error('Failed to create seed message:', error?.message);
    return null;
  }

  // Auto-join user as participant if not already
  await supabaseAdmin
    .from('thread_participants')
    .upsert({ thread_id: threadId, user_id: userId }, { onConflict: 'thread_id,user_id' })
    .then(() => {})
    .catch(() => {});

  await logActivity('message_created', 'message', message.id, userId, { threadId });
  return message.id;
}

// ─── SCHEDULED CONTENT ───────────────────────────────────────

export async function getScheduledContent(options: {
  status?: string;
  batchDate?: string;
  limit?: number;
}) {
  let query = supabaseAdmin
    .from('seed_scheduled_content')
    .select('*')
    .order('scheduled_at', { ascending: true });

  if (options.status) query = query.eq('status', options.status);
  if (options.batchDate) query = query.eq('batch_date', options.batchDate);
  if (options.limit) query = query.limit(options.limit);

  const { data, error } = await query;
  if (error) throw new Error(`Failed to get scheduled content: ${error.message}`);
  return data || [];
}

export async function getScheduledContentDetailed(batchDate: string) {
  const { data, error } = await supabaseAdmin
    .from('seed_scheduled_content')
    .select(`
      *,
      thread:seed_playbook_threads(title, content, category, creator_persona),
      reply:seed_playbook_replies(content, persona_tag),
      user:users(username, anonymous_id)
    `)
    .eq('batch_date', batchDate)
    .order('scheduled_at', { ascending: true });

  if (error) throw new Error(`Failed to get detailed scheduled content: ${error.message}`);
  return data || [];
}

export async function getDueApprovedItems(limit: number = 5) {
  const now = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from('seed_scheduled_content')
    .select('*')
    .eq('status', 'approved')
    .lte('scheduled_at', now)
    .order('scheduled_at', { ascending: true })
    .limit(limit);

  if (error) throw new Error(`Failed to get due items: ${error.message}`);
  return data || [];
}

export async function markItemExecuted(itemId: string, threadId?: string) {
  await supabaseAdmin
    .from('seed_scheduled_content')
    .update({
      status: 'executed',
      executed_at: new Date().toISOString(),
      target_thread_id: threadId || undefined,
    })
    .eq('id', itemId);
}

export async function markItemFailed(itemId: string, errorMessage: string) {
  await supabaseAdmin
    .from('seed_scheduled_content')
    .update({
      status: 'failed',
      error_message: errorMessage,
      executed_at: new Date().toISOString(),
    })
    .eq('id', itemId);
}

export async function approveScheduledBatch(batchDate: string) {
  const { data, error } = await supabaseAdmin
    .from('seed_scheduled_content')
    .update({ status: 'approved', is_approved: true })
    .eq('batch_date', batchDate)
    .eq('status', 'pending')
    .select('id');

  if (error) throw new Error(`Failed to approve batch: ${error.message}`);
  return { approved: data?.length || 0 };
}

// ─── ACTIVITY LOG ────────────────────────────────────────────

export async function logActivity(
  action: string,
  entityType: string,
  entityId: string,
  seedUserId?: string,
  metadata?: Record<string, any>
) {
  await supabaseAdmin
    .from('seed_activity_log')
    .insert({
      action,
      entity_type: entityType,
      entity_id: entityId,
      seed_user_id: seedUserId || null,
      metadata: metadata || {},
    })
    .then(() => {})
    .catch((err: any) => console.warn('Failed to log seed activity:', err));
}

export async function getActivityStats() {
  const { count: totalUsers } = await supabaseAdmin
    .from('users')
    .select('*', { count: 'exact', head: true })
    .eq('is_seed', true);

  const { count: totalThreads } = await supabaseAdmin
    .from('threads')
    .select('*', { count: 'exact', head: true })
    .eq('is_seed', true);

  const { count: totalMessages } = await supabaseAdmin
    .from('messages')
    .select('*', { count: 'exact', head: true })
    .eq('is_seed', true);

  const { count: pendingItems } = await supabaseAdmin
    .from('seed_scheduled_content')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending');

  const { count: approvedItems } = await supabaseAdmin
    .from('seed_scheduled_content')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'approved');

  const { count: executedItems } = await supabaseAdmin
    .from('seed_scheduled_content')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'executed');

  return {
    seedUsers: totalUsers || 0,
    seedThreads: totalThreads || 0,
    seedMessages: totalMessages || 0,
    scheduledPending: pendingItems || 0,
    scheduledApproved: approvedItems || 0,
    scheduledExecuted: executedItems || 0,
  };
}

// ─── CLEANUP ─────────────────────────────────────────────────

export async function cleanupAllSeeds() {
  // Order matters — delete messages first (FK), then threads, then users
  await supabaseAdmin.from('seed_activity_log').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabaseAdmin.from('seed_scheduled_content').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabaseAdmin.from('messages').delete().eq('is_seed', true);
  await supabaseAdmin.from('thread_participants').delete().in('user_id',
    (await getSeedUsers()).map((u: any) => u.id)
  );
  await supabaseAdmin.from('threads').delete().eq('is_seed', true);
  await supabaseAdmin.from('users').delete().eq('is_seed', true);

  // Reset playbook usage flags
  await supabaseAdmin
    .from('seed_playbook_threads')
    .update({ is_used: false, times_used: 0 })
    .neq('id', '00000000-0000-0000-0000-000000000000');

  await logActivity('cleanup', 'system', '00000000-0000-0000-0000-000000000000', undefined, { action: 'full_cleanup' });
}
