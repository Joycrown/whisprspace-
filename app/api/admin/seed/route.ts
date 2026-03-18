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

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}. Valid: initialize, prepare-daily, approve-day, process-queue, pause, resume, cleanup` },
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
