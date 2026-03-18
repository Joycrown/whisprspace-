/**
 * Daily Seed Cron Job
 *
 * Runs once per day (1 AM) to prepare the next day's content schedule.
 * Validates the CRON_SECRET header for security.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prepareDailySchedule, processScheduledQueue } from '@/lib/seeding/seed-orchestrator';
import { getSeedConfig } from '@/lib/seeding/seed-service';

export async function GET(req: NextRequest) {
  try {
    // Validate cron secret
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if seeding is active
    const config = await getSeedConfig();
    if (!config.is_active) {
      return NextResponse.json({
        success: true,
        message: 'Seeding is not active',
        skipped: true,
      });
    }

    // 1. Process any remaining approved items from today
    const processResult = await processScheduledQueue(20);

    // 2. Prepare tomorrow's schedule
    const scheduleResult = await prepareDailySchedule();

    return NextResponse.json({
      success: true,
      processed: processResult,
      scheduled: scheduleResult,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('[Seed Cron] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
