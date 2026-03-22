/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Seed Orchestrator — Daily schedule generation & processing
 *
 * - prepareDailySchedule(): Called by cron, generates all items for a day
 * - processScheduledQueue(): Called by page-load trigger, executes due items
 */

import { supabaseAdmin } from '@/lib/core/supabase/admin-client';
import * as seedService from './seed-service';

/**
 * Initialize the entire seed system (one-time setup)
 */
export async function initializeSeedSystem() {
  // 1. Create seed users
  const userResult = await seedService.createSeedUsers();

  // 2. Load playbook into DB
  const playbookResult = await seedService.loadPlaybookIntoDB();

  // 3. Activate seeding
  await seedService.updateSeedConfig({ is_active: true });

  return {
    users: userResult,
    playbook: playbookResult,
    status: 'initialized',
  };
}

/**
 * Prepare the daily schedule — picks threads from playbook,
 * assigns personas, calculates timestamps for threads + all replies.
 *
 * immediate=true: skips duplicate-date check, starts threads from now
 * (used by auto-generation when existing threads are expiring)
 */
export async function prepareDailySchedule(targetDate?: string, immediate = false): Promise<{
  threadsScheduled: number;
  repliesScheduled: number;
  batchDate: string;
}> {
  const config = await seedService.getSeedConfig();
  const userMap = await seedService.getSeedUserMap();

  if (Object.keys(userMap).length === 0) {
    throw new Error('No seed users found. Run initialize first.');
  }

  // immediate batches use a timestamp-based ID so they never clash with date-based ones
  const now = new Date();
  const batchDate = immediate
    ? `${now.toISOString().split('T')[0]}-${now.getHours()}${now.getMinutes().toString().padStart(2, '0')}`
    : targetDate
      ? new Date(targetDate).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0];

  const date = new Date(batchDate.split('-').slice(0, 3).join('-'));

  // Check if already scheduled (skip for immediate — always allow)
  if (!immediate) {
    const existing = await seedService.getScheduledContent({ batchDate });
    if (existing.length > 0) {
      return { threadsScheduled: 0, repliesScheduled: 0, batchDate };
    }
  }

  // Pick unused threads with a ~60% relationship/personal, ~40% other split.
  // e.g. threads_per_day=5 → 3 priority + 2 other.
  const PRIORITY_CATEGORIES = ['relationships', 'personal'];
  const prioritySlots = Math.round(config.threads_per_day * 0.6); // 3 of 5
  const otherSlots = config.threads_per_day - prioritySlots;       // 2 of 5

  const { data: priorityThreads } = await supabaseAdmin
    .from('seed_playbook_threads')
    .select('*')
    .eq('is_used', false)
    .in('category', PRIORITY_CATEGORIES)
    .order('created_at', { ascending: true })
    .limit(prioritySlots);

  const { data: otherThreads } = await supabaseAdmin
    .from('seed_playbook_threads')
    .select('*')
    .eq('is_used', false)
    .not('category', 'in', `(${PRIORITY_CATEGORIES.join(',')})`)
    .order('created_at', { ascending: true })
    .limit(otherSlots);

  // Interleave: priority, other, priority, other, priority — feels more natural than a block
  let availableThreads: any[] = [];
  const pList = priorityThreads || [];
  const oList = otherThreads || [];
  const maxLen = Math.max(pList.length, oList.length);
  for (let i = 0; i < maxLen; i++) {
    if (i < pList.length) availableThreads.push(pList[i]);
    if (i < oList.length) availableThreads.push(oList[i]);
  }
  availableThreads = availableThreads.slice(0, config.threads_per_day);

  // Fallback: if either pool is exhausted, fill remaining from whatever is available
  if (availableThreads.length < config.threads_per_day) {
    const usedIds = new Set(availableThreads.map((t: any) => t.id));
    const { data: fallback } = await supabaseAdmin
      .from('seed_playbook_threads')
      .select('*')
      .eq('is_used', false)
      .order('created_at', { ascending: true })
      .limit(config.threads_per_day);
    for (const t of (fallback || [])) {
      if (!usedIds.has(t.id)) availableThreads.push(t);
      if (availableThreads.length >= config.threads_per_day) break;
    }
  }

  if (availableThreads.length === 0) {
    // Reset all threads to unused if we've exhausted the playbook
    await supabaseAdmin
      .from('seed_playbook_threads')
      .update({ is_used: false })
      .neq('id', '00000000-0000-0000-0000-000000000000');

    return { threadsScheduled: 0, repliesScheduled: 0, batchDate };
  }

  // Fetch all replies for the selected threads in one explicit query —
  // more reliable than the join above which can silently return empty arrays.
  const threadIds = availableThreads.map((t: any) => t.id);
  const { data: allFetchedReplies } = await supabaseAdmin
    .from('seed_playbook_replies')
    .select('id, thread_playbook_id, persona_tag, content, sequence_order')
    .in('thread_playbook_id', threadIds)
    .order('thread_playbook_id', { ascending: true })
    .order('sequence_order', { ascending: true });

  // Group by thread ID for quick lookup
  const repliesByThreadId: Record<string, any[]> = {};
  for (const reply of (allFetchedReplies || [])) {
    if (!repliesByThreadId[reply.thread_playbook_id]) {
      repliesByThreadId[reply.thread_playbook_id] = [];
    }
    repliesByThreadId[reply.thread_playbook_id].push(reply);
  }

  // ── Global unused reply pool ───────────────────────────────────────────────
  // Collect every playbook_reply_id that has already been scheduled (any status)
  // so we never reuse the same message content in any thread, ever.
  const { data: scheduledReplyRows } = await supabaseAdmin
    .from('seed_scheduled_content')
    .select('playbook_reply_id')
    .not('playbook_reply_id', 'is', null);

  const globallyUsedReplyIds = new Set(
    (scheduledReplyRows || []).map((r: any) => r.playbook_reply_id)
  );

  // Fetch every reply across the entire playbook — gives us the fill pool for Phase 2.
  // We'll add IDs to globallyUsedReplyIds as we assign them in this batch so
  // cross-thread uniqueness is enforced within the same scheduling call too.
  const { data: allPlaybookReplies } = await supabaseAdmin
    .from('seed_playbook_replies')
    .select('id, thread_playbook_id, persona_tag, content')
    .order('thread_playbook_id', { ascending: true })
    .order('sequence_order', { ascending: true });

  // Pool of replies not yet used anywhere — available for Phase 2 fill
  const globalReplyPool: any[] = (allPlaybookReplies || []).filter(
    (r: any) => !globallyUsedReplyIds.has(r.id)
  );

  // If the pool can't fill even one full thread, reset used-reply tracking —
  // same pattern as the thread playbook reset. All 5k+ replies become available
  // again rather than repeating the same few messages inside a single thread.
  const targetPerThread = config.max_participants_per_thread * config.messages_per_user;
  const shouldResetPool = globalReplyPool.length < targetPerThread;
  if (shouldResetPool) {
    globallyUsedReplyIds.clear();
    globalReplyPool.length = 0;
    globalReplyPool.push(...(allPlaybookReplies || []));
  }

  // ── End global pool setup ──────────────────────────────────────────────────

  const scheduledItems: any[] = [];
  let threadsScheduled = 0;
  let repliesScheduled = 0;

  for (let i = 0; i < availableThreads.length; i++) {
    const playbookThread = availableThreads[i];
    // Use the separately-fetched replies (already sorted by sequence_order)
    const replies = repliesByThreadId[playbookThread.id] || [];

    // Calculate thread creation time
    let threadTime: Date;
    if (immediate) {
      // Immediate mode: start 1 min from now, spaced by thread_spacing_minutes
      threadTime = new Date(Date.now() + 60000 + (i * config.thread_spacing_minutes * 60000));
    } else {
      threadTime = new Date(date);
      const threadHour = config.first_thread_hour + (i * config.thread_spacing_minutes / 60);
      threadTime.setHours(Math.floor(threadHour), (threadHour % 1) * 60, 0, 0);
    }

    // Get creator user ID
    const creatorUserId = userMap[playbookThread.creator_persona];
    if (!creatorUserId) {
      console.warn(`No seed user for persona: ${playbookThread.creator_persona}`);
      continue;
    }

    // Schedule thread creation
    scheduledItems.push({
      action: 'create_thread',
      playbook_thread_id: playbookThread.id,
      seed_user_id: creatorUserId,
      scheduled_at: threadTime.toISOString(),
      status: 'pending',
      batch_date: batchDate,
    });
    threadsScheduled++;

    if (replies.length === 0) continue;

    // Target: max_participants_per_thread × messages_per_user (e.g. 10 × 5 = 50)
    const targetReplyCount = config.max_participants_per_thread * config.messages_per_user;

    // Determine the allowed persona set for this thread — capped at max_participants_per_thread.
    // Phase 1 personas come first (they're the "anchored" cast for this thread).
    // Fill remaining slots from the wider user map if the playbook has fewer than the cap.
    const phase1Personas: string[] = [];
    for (const r of replies) {
      if (r.persona_tag && !phase1Personas.includes(r.persona_tag)) {
        phase1Personas.push(r.persona_tag);
        if (phase1Personas.length >= config.max_participants_per_thread) break;
      }
    }
    // Top up to the cap with personas not already in phase1Personas
    const remainingPersonas = Object.keys(userMap).filter(p => !phase1Personas.includes(p));
    const allowedPersonas = [
      ...phase1Personas,
      ...remainingPersonas,
    ].slice(0, config.max_participants_per_thread);

    let slot = 0;

    // Phase 1: schedule the explicit playbook replies in order
    for (const reply of replies) {
      if (slot >= targetReplyCount) break;
      const participantUserId = userMap[reply.persona_tag];
      if (!participantUserId) {
        console.warn(`No seed user for persona tag: ${reply.persona_tag}`);
        continue;
      }

      const replyTime = new Date(
        threadTime.getTime() + (slot + 1) * config.reply_interval_minutes * 60 * 1000
      );

      scheduledItems.push({
        action: 'create_reply',
        playbook_thread_id: playbookThread.id,
        playbook_reply_id: reply.id,
        seed_user_id: participantUserId,
        scheduled_at: replyTime.toISOString(),
        status: 'pending',
        batch_date: batchDate,
      });

      // Mark as globally used so other threads in this batch don't claim it
      globallyUsedReplyIds.add(reply.id);
      const poolIdx = globalReplyPool.findIndex((r: any) => r.id === reply.id);
      if (poolIdx !== -1) globalReplyPool.splice(poolIdx, 1);

      slot++;
      repliesScheduled++;
    }

    // Phase 2: fill remaining slots up to targetReplyCount.
    // Pull from the global unused reply pool — one reply ID used once, ever.
    // Only cycle through allowedPersonas (capped at max_participants_per_thread).
    let extraPersonaIdx = 0;
    while (slot < targetReplyCount) {
      // Snapshot used reply IDs for this thread (rebuilt each iteration to stay accurate)
      const usedInThisThread = new Set(
        scheduledItems
          .filter((s: any) => s.playbook_thread_id === playbookThread.id && s.playbook_reply_id)
          .map((s: any) => s.playbook_reply_id)
      );

      // Pool is always valid here (reset above if it was too small)
      const poolReply: any =
        globalReplyPool.find(
          (r: any) => !usedInThisThread.has(r.id) &&
            r.persona_tag === allowedPersonas[extraPersonaIdx % allowedPersonas.length]
        ) ||
        globalReplyPool.find((r: any) => !usedInThisThread.has(r.id));

      if (!poolReply) break; // Global pool exhausted — stop filling

      const personaTag = allowedPersonas[extraPersonaIdx % allowedPersonas.length];
      const participantUserId = userMap[personaTag];

      if (participantUserId) {
        const replyTime = new Date(
          threadTime.getTime() + (slot + 1) * config.reply_interval_minutes * 60 * 1000
        );

        scheduledItems.push({
          action: 'create_reply',
          playbook_thread_id: playbookThread.id,
          playbook_reply_id: poolReply.id,
          seed_user_id: participantUserId,
          scheduled_at: replyTime.toISOString(),
          status: 'pending',
          batch_date: batchDate,
        });

        // Mark as used so subsequent threads in this batch don't claim it
        globallyUsedReplyIds.add(poolReply.id);
        const idx = globalReplyPool.findIndex((r: any) => r.id === poolReply.id);
        if (idx !== -1) globalReplyPool.splice(idx, 1);

        slot++;
        repliesScheduled++;
      }

      extraPersonaIdx++;
      // Safety valve: if we've cycled through all personas and still can't schedule,
      // bail out to avoid an infinite loop (e.g. all userMap entries are missing).
      if (extraPersonaIdx > allowedPersonas.length * 2 && slot === 0) break;
    }

    // Mark playbook thread as used
    await supabaseAdmin
      .from('seed_playbook_threads')
      .update({ is_used: true, times_used: (playbookThread.times_used || 0) + 1 })
      .eq('id', playbookThread.id);
  }

  // Bulk insert all scheduled items
  if (scheduledItems.length > 0) {
    const { error: insertErr } = await supabaseAdmin
      .from('seed_scheduled_content')
      .insert(scheduledItems);

    if (insertErr) throw new Error(`Failed to schedule content: ${insertErr.message}`);
  }

  // Update last run timestamp
  await seedService.updateSeedConfig({ last_run_at: new Date().toISOString() });
  await seedService.logActivity('daily_schedule', 'system', batchDate, undefined, {
    threadsScheduled,
    repliesScheduled,
    batchDate,
  });

  return { threadsScheduled, repliesScheduled, batchDate };
}

/**
 * Smart auto-generation — checks if the feed needs fresh content and
 * generates + approves a new batch automatically.
 *
 * Triggers when ALL active seed threads are expiring within 2 hours
 * (or none exist). Skips if there are still unexecuted approved items.
 */
export async function checkAndGenerateIfNeeded(): Promise<{
  generated: boolean;
  reason: string;
}> {
  const config = await seedService.getSeedConfig();
  if (!config.is_active) return { generated: false, reason: 'inactive' };

  const nowIso = new Date().toISOString();
  const twoHoursFromNow = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

  // Count active seed threads
  const { count: activeCount } = await supabaseAdmin
    .from('threads')
    .select('*', { count: 'exact', head: true })
    .eq('is_seed', true)
    .gt('expires_at', nowIso);

  // Count active seed threads expiring within 2 hours
  const { count: expiringCount } = await supabaseAdmin
    .from('threads')
    .select('*', { count: 'exact', head: true })
    .eq('is_seed', true)
    .gt('expires_at', nowIso)
    .lte('expires_at', twoHoursFromNow);

  const noActiveThreads = !activeCount || activeCount === 0;
  const allExpiringSoon = activeCount !== null && activeCount > 0 && expiringCount === activeCount;

  // Also allow generation when active threads exist but all their scheduled replies
  // have already been executed — meaning threads are "content-complete" and the
  // feed is stale even though the threads haven't expired yet.
  const { count: pendingRepliesCount } = await supabaseAdmin
    .from('seed_scheduled_content')
    .select('*', { count: 'exact', head: true })
    .eq('action', 'create_reply')
    .eq('status', 'approved');

  const allRepliesExhausted = !pendingRepliesCount || pendingRepliesCount === 0;

  // If threads are healthy and there's still reply content to post, skip generation.
  // We intentionally check thread expiry status FIRST — if threads are expiring
  // soon (or absent), we must generate even if there are queued items for those
  // dying threads.
  if (!noActiveThreads && !allExpiringSoon && !allRepliesExhausted) {
    // Threads are healthy; only skip if there are also queued approved items.
    const fortyEightHoursFromNow = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    const { count: queuedCount } = await supabaseAdmin
      .from('seed_scheduled_content')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'approved')
      .lte('scheduled_at', fortyEightHoursFromNow);

    if (queuedCount && queuedCount > 0) {
      return { generated: false, reason: 'queue not empty' };
    }

    return { generated: false, reason: 'threads still active' };
  }

  // Generate with immediate timing (threads start ~1 min from now)
  const result = await prepareDailySchedule(undefined, true);

  if (result.threadsScheduled === 0) {
    return { generated: false, reason: 'no playbook content available' };
  }

  // Auto-approve so the queue processor can execute them right away
  await seedService.approveScheduledBatch(result.batchDate);

  await seedService.logActivity('auto_generate', 'system', result.batchDate, undefined, {
    trigger: noActiveThreads ? 'no_active_threads' : 'threads_expiring_soon',
    threadsScheduled: result.threadsScheduled,
    repliesScheduled: result.repliesScheduled,
  });

  return {
    generated: true,
    reason: `${result.threadsScheduled} threads + ${result.repliesScheduled} replies auto-generated`,
  };
}

/**
 * Process the scheduled queue — executes approved items whose time has come.
 * Called by page-load trigger. Processes up to `limit` items per call.
 */
export async function processScheduledQueue(limit: number = 5): Promise<{
  processed: number;
  errors: number;
}> {
  const config = await seedService.getSeedConfig();
  if (!config.is_active) return { processed: 0, errors: 0 };

  const dueItems = await seedService.getDueApprovedItems(limit);
  if (dueItems.length === 0) return { processed: 0, errors: 0 };

  let processed = 0;
  let errors = 0;

  // Keep track of created thread IDs so replies know where to go
  const threadMap: Record<string, string> = {};

  for (const item of dueItems) {
    // Atomically claim this item by flipping approved → skipped as a lock.
    // 'skipped' is immediately overwritten to 'executed' or 'failed' below.
    // This prevents double-execution if two trigger calls run concurrently.
    const { data: claimed } = await supabaseAdmin
      .from('seed_scheduled_content')
      .update({ status: 'skipped' })
      .eq('id', item.id)
      .eq('status', 'approved') // only succeeds if still approved
      .select('id')
      .single();

    if (!claimed) continue; // Another concurrent call already claimed it

    try {
      if (item.action === 'create_thread') {
        // Fetch playbook data
        const { data: pbThread } = await supabaseAdmin
          .from('seed_playbook_threads')
          .select('*')
          .eq('id', item.playbook_thread_id)
          .single();

        if (!pbThread) {
          await seedService.markItemFailed(item.id, 'Playbook thread not found');
          errors++;
          continue;
        }

        const threadId = await seedService.createSeedThread(
          item.seed_user_id,
          pbThread.title,
          pbThread.content,
          pbThread.category,
          pbThread.type,
          pbThread.poll_options
        );

        if (threadId) {
          threadMap[item.playbook_thread_id] = threadId;
          await seedService.markItemExecuted(item.id, threadId);
          processed++;
        } else {
          await seedService.markItemFailed(item.id, 'Thread creation returned null');
          errors++;
        }

      } else if (item.action === 'create_reply') {
        // Get the real thread ID
        let targetThreadId = item.target_thread_id;

        if (!targetThreadId) {
          // Look up from previously created threads in this batch
          targetThreadId = threadMap[item.playbook_thread_id];
        }

        if (!targetThreadId) {
          // Look up from executed schedule items — filter by batch_date to avoid
          // duplicate rows when the same playbook thread is reused across days
          const { data: executedThread } = await supabaseAdmin
            .from('seed_scheduled_content')
            .select('target_thread_id')
            .eq('playbook_thread_id', item.playbook_thread_id)
            .eq('action', 'create_thread')
            .eq('status', 'executed')
            .eq('batch_date', item.batch_date)
            .maybeSingle();

          targetThreadId = executedThread?.target_thread_id;
        }

        if (!targetThreadId) {
          await seedService.markItemFailed(item.id, 'Target thread not found — thread may not be created yet');
          errors++;
          continue;
        }

        // Fetch reply content from playbook
        const { data: pbReply } = await supabaseAdmin
          .from('seed_playbook_replies')
          .select('*')
          .eq('id', item.playbook_reply_id)
          .single();

        if (!pbReply) {
          await seedService.markItemFailed(item.id, 'Playbook reply not found');
          errors++;
          continue;
        }

        const messageId = await seedService.createSeedMessage(
          targetThreadId,
          item.seed_user_id,
          pbReply.content,
          item.parent_message_id || undefined
        );

        if (messageId) {
          await seedService.markItemExecuted(item.id, targetThreadId);
          processed++;
        } else {
          await seedService.markItemFailed(item.id, 'Message creation returned null');
          errors++;
        }
      }
    } catch (err: any) {
      console.error(`Error processing scheduled item ${item.id}:`, err);
      await seedService.markItemFailed(item.id, err.message || 'Unknown error');
      errors++;
    }
  }

  return { processed, errors };
}

/**
 * Get comprehensive status for admin dashboard
 */
export async function getSeedingStatus() {
  const config = await seedService.getSeedConfig();
  const stats = await seedService.getActivityStats();
  const playbookStats = await seedService.getPlaybookStats();

  // Get today's and tomorrow's schedule
  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const todaySchedule = await seedService.getScheduledContent({ batchDate: today });
  const tomorrowSchedule = await seedService.getScheduledContent({ batchDate: tomorrow });

  return {
    config,
    stats,
    playbook: playbookStats,
    schedule: {
      today: {
        date: today,
        total: todaySchedule.length,
        pending: todaySchedule.filter((i: any) => i.status === 'pending').length,
        approved: todaySchedule.filter((i: any) => i.status === 'approved').length,
        executed: todaySchedule.filter((i: any) => i.status === 'executed').length,
        failed: todaySchedule.filter((i: any) => i.status === 'failed').length,
      },
      tomorrow: {
        date: tomorrow,
        total: tomorrowSchedule.length,
        pending: tomorrowSchedule.filter((i: any) => i.status === 'pending').length,
        approved: tomorrowSchedule.filter((i: any) => i.status === 'approved').length,
        executed: tomorrowSchedule.filter((i: any) => i.status === 'executed').length,
        failed: tomorrowSchedule.filter((i: any) => i.status === 'failed').length,
      },
    },
  };
}
