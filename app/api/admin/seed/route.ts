/**
 * Admin Seed API — Manage content seeding system
 *
 * GET  — Get seed status, config, stats
 * POST — Actions: initialize, prepare-daily, approve-day, cleanup
 * PATCH — Update seed config
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/core/supabase/admin-client';
import { resolveUserFromRequest } from '@/lib/security/request-auth';
import * as seedService from '@/lib/seeding/seed-service';
import * as seedOrchestrator from '@/lib/seeding/seed-orchestrator';

/**
 * Verify the caller is an admin
 */
async function verifyAdmin(req: NextRequest): Promise<boolean> {
  const user = await resolveUserFromRequest(req);
  if (!user) return false;

  // Check admin status
  const { data: adminData } = await supabaseAdmin
    .from('admin_users')
    .select('role')
    .eq('user_id', user.id)
    .single();

  if (adminData) return true;

  const { data: userData } = await supabaseAdmin
    .from('users')
    .select('is_admin')
    .eq('id', user.id)
    .single();

  return userData?.is_admin === true;
}

// ─── GET: Status & Stats ─────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const isAdmin = await verifyAdmin(req);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const dateQuery = searchParams.get('date');

    if (dateQuery) {
      const detailedSchedule = await seedService.getScheduledContentDetailed(dateQuery);
      return NextResponse.json({ success: true, data: detailedSchedule });
    }

    // ?view=batch-summary — per-thread reply counts for the latest batch
    const viewQuery = searchParams.get('view');
    if (viewQuery === 'batch-summary') {
      // Get the most recent batch
      const { data: latestBatch } = await supabaseAdmin
        .from('seed_scheduled_content')
        .select('batch_date')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      const batchDate = latestBatch?.batch_date;
      if (!batchDate) {
        return NextResponse.json({ success: true, data: { batchDate: null, threads: [] } });
      }

      const { data: items } = await supabaseAdmin
        .from('seed_scheduled_content')
        .select('action, status, playbook_thread_id, scheduled_at')
        .eq('batch_date', batchDate)
        .order('scheduled_at', { ascending: true });

      // Group by playbook_thread_id
      const threadMap: Record<string, { threadItem: any; replyCount: number; statuses: Record<string, number> }> = {};
      for (const item of (items || [])) {
        if (!threadMap[item.playbook_thread_id]) {
          threadMap[item.playbook_thread_id] = { threadItem: null, replyCount: 0, statuses: {} };
        }
        if (item.action === 'create_thread') {
          threadMap[item.playbook_thread_id].threadItem = item;
        } else {
          threadMap[item.playbook_thread_id].replyCount++;
        }
        threadMap[item.playbook_thread_id].statuses[item.status] =
          (threadMap[item.playbook_thread_id].statuses[item.status] || 0) + 1;
      }

      const threads = Object.entries(threadMap).map(([pbThreadId, data]) => ({
        playbookThreadId: pbThreadId,
        threadStatus: data.threadItem?.status,
        threadScheduledAt: data.threadItem?.scheduled_at,
        replyCount: data.replyCount,
        statuses: data.statuses,
      }));

      return NextResponse.json({
        success: true,
        data: {
          batchDate,
          totalItems: items?.length || 0,
          threads,
        },
      });
    }

    const status = await seedOrchestrator.getSeedingStatus();
    return NextResponse.json({ success: true, data: status });
  } catch (err: any) {
    console.error('[Seed API] GET error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ─── POST: Actions ───────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const isAdmin = await verifyAdmin(req);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { action, date } = body;

    switch (action) {
      case 'initialize': {
        const result = await seedOrchestrator.initializeSeedSystem();
        return NextResponse.json({ success: true, data: result });
      }

      case 'prepare-daily': {
        const result = await seedOrchestrator.prepareDailySchedule(date);
        return NextResponse.json({ success: true, data: result });
      }

      case 'approve-day': {
        if (!date) {
          return NextResponse.json({ error: 'Date is required for approve-day' }, { status: 400 });
        }
        const result = await seedService.approveScheduledBatch(date);
        return NextResponse.json({ success: true, data: result });
      }

      case 'reschedule-now': {
        if (!date) {
          return NextResponse.json({ error: 'Date is required for reschedule-now' }, { status: 400 });
        }
        // Fetch all pending/approved items for this batch
        const { data: items, error: fetchErr } = await supabaseAdmin
          .from('seed_scheduled_content')
          .select('id, action, scheduled_at')
          .eq('batch_date', date)
          .in('status', ['pending', 'approved'])
          .order('scheduled_at', { ascending: true });

        if (fetchErr) throw new Error(fetchErr.message);
        if (!items || items.length === 0) {
          return NextResponse.json({ success: true, data: { rescheduled: 0 } });
        }

        // Get spacing config
        const config = await seedService.getSeedConfig();
        const now = Date.now();

        // Rebuild timestamps: threads first (in original order), replies follow
        const threads = items.filter((i: { id: string; action: string; scheduled_at: string }) => i.action === 'create_thread');
        const replies = items.filter((i: { id: string; action: string; scheduled_at: string }) => i.action === 'create_reply');

        // Space threads from 1 min from now
        const threadUpdates = threads.map((item: { id: string; action: string; scheduled_at: string }, idx: number) => ({
          id: item.id,
          scheduled_at: new Date(now + 60000 + idx * config.thread_spacing_minutes * 60000).toISOString(),
        }));

        // Replies keep their relative offset from their thread's original time
        const firstOriginalThreadTime = threads.length > 0 ? new Date(threads[0].scheduled_at).getTime() : 0;
        const replyUpdates = replies.map((item: { id: string; action: string; scheduled_at: string }) => {
          const originalOffset = new Date(item.scheduled_at).getTime() - firstOriginalThreadTime;
          return {
            id: item.id,
            scheduled_at: new Date(now + 60000 + originalOffset).toISOString(),
          };
        });

        const allUpdates = [...threadUpdates, ...replyUpdates];
        for (const u of allUpdates) {
          await supabaseAdmin
            .from('seed_scheduled_content')
            .update({ scheduled_at: u.scheduled_at })
            .eq('id', u.id);
        }

        return NextResponse.json({ success: true, data: { rescheduled: allUpdates.length } });
      }

      case 'process-queue': {
        const result = await seedOrchestrator.processScheduledQueue(10);
        return NextResponse.json({ success: true, data: result });
      }

      case 'pause': {
        await seedService.updateSeedConfig({ is_active: false });
        return NextResponse.json({ success: true, message: 'Seeding paused' });
      }

      case 'resume': {
        await seedService.updateSeedConfig({ is_active: true });
        return NextResponse.json({ success: true, message: 'Seeding resumed' });
      }

      case 'cleanup': {
        await seedService.cleanupAllSeeds();
        return NextResponse.json({ success: true, message: 'All seed data cleaned up' });
      }

      case 'remove-and-replace': {
        const { playbookThreadId, batchDate } = body;
        if (!playbookThreadId || !batchDate) {
          return NextResponse.json({ error: 'playbookThreadId and batchDate are required' }, { status: 400 });
        }
        const result = await seedOrchestrator.removeAndReplaceScheduledThread(playbookThreadId, batchDate);
        return NextResponse.json({ success: true, data: result });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}. Valid: initialize, prepare-daily, approve-day, process-queue, pause, resume, cleanup, remove-and-replace` },
          { status: 400 }
        );
    }
  } catch (err: any) {
    console.error('[Seed API] POST error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ─── PATCH: Update Config ────────────────────────────────────

export async function PATCH(req: NextRequest) {
  try {
    const isAdmin = await verifyAdmin(req);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { config } = body;

    if (!config || typeof config !== 'object') {
      return NextResponse.json({ error: 'Config object is required' }, { status: 400 });
    }

    // Whitelist allowed config fields
    const allowed = [
      'is_active', 'threads_per_day', 'thread_spacing_minutes',
      'max_participants_per_thread', 'messages_per_user',
      'reply_interval_minutes', 'first_thread_hour',
    ];

    const updates: Record<string, any> = {};
    for (const key of allowed) {
      if (key in config) updates[key] = config[key];
    }

    const result = await seedService.updateSeedConfig(updates);
    return NextResponse.json({ success: true, data: result });
  } catch (err: any) {
    console.error('[Seed API] PATCH error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
