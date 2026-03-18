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
 * assigns personas, calculates timestamps for threads + all replies
 */
export async function prepareDailySchedule(targetDate?: string): Promise<{
  threadsScheduled: number;
  repliesScheduled: number;
  batchDate: string;
}> {
  const config = await seedService.getSeedConfig();
  const userMap = await seedService.getSeedUserMap();

  if (Object.keys(userMap).length === 0) {
    throw new Error('No seed users found. Run initialize first.');
  }

  // Target date (defaults to tomorrow)
  const date = targetDate
    ? new Date(targetDate)
    : new Date(Date.now() + 24 * 60 * 60 * 1000);
  const batchDate = date.toISOString().split('T')[0];

  // Check if already scheduled
  const existing = await seedService.getScheduledContent({ batchDate });
  if (existing.length > 0) {
    return { threadsScheduled: 0, repliesScheduled: 0, batchDate };
  }

  // Pick unused threads from playbook
  const { data: availableThreads, error } = await supabaseAdmin
    .from('seed_playbook_threads')
    .select('*, seed_playbook_replies(*)')
    .eq('is_used', false)
    .order('created_at', { ascending: true })
    .limit(config.threads_per_day);

  if (error) throw new Error(`Failed to fetch playbook threads: ${error.message}`);
  if (!availableThreads || availableThreads.length === 0) {
    // Reset all threads to unused if we've exhausted the playbook
    await supabaseAdmin
      .from('seed_playbook_threads')
      .update({ is_used: false })
      .neq('id', '00000000-0000-0000-0000-000000000000');

    return { threadsScheduled: 0, repliesScheduled: 0, batchDate };
  }

  const scheduledItems: any[] = [];
  let threadsScheduled = 0;
  let repliesScheduled = 0;

  for (let i = 0; i < availableThreads.length; i++) {
    const playbookThread = availableThreads[i];
    const replies = (playbookThread.seed_playbook_replies || [])
      .sort((a: any, b: any) => a.sequence_order - b.sequence_order);

    // Calculate thread creation time
    let threadTime = new Date(date);
    if (process.env.NODE_ENV === 'development') {
      // Fast-track testing in dev/local: threads every 5 mins, starting 1 min from now
      threadTime = new Date(Date.now() + 60000 + (i * 5 * 60000));
    } else {
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

    // Each playbook reply has a persona_tag specifying exactly who sends it.
    // Use that directly instead of round-robining content across random participants.
    for (let slot = 0; slot < replies.length; slot++) {
      const reply = replies[slot];
      const participantUserId = userMap[reply.persona_tag];
      if (!participantUserId) {
        console.warn(`No seed user for persona tag: ${reply.persona_tag}`);
        continue;
      }

      let replyTime;
      if (process.env.NODE_ENV === 'development') {
        replyTime = new Date(threadTime.getTime() + (slot + 1) * 60000);
      } else {
        replyTime = new Date(threadTime.getTime() + (slot + 1) * config.reply_interval_minutes * 60 * 1000);
      }

      scheduledItems.push({
        action: 'create_reply',
        playbook_thread_id: playbookThread.id,
        playbook_reply_id: reply.id,
        seed_user_id: participantUserId,
        scheduled_at: replyTime.toISOString(),
        status: 'pending',
        batch_date: batchDate,
      });

      repliesScheduled++;
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
