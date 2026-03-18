/**
 * Seed Trigger API — Lightweight endpoint called by the feed page
 * to process any due scheduled seed content.
 *
 * This is the "page-load trigger" — fires in the background
 * when users visit the feed, processing due seed items.
 */

import { NextResponse } from 'next/server';
import { processScheduledQueue } from '@/lib/seeding/seed-orchestrator';
import { supabaseAdmin } from '@/lib/core/supabase/admin-client';

// In-memory throttle (per server instance)
let lastTriggerTime = 0;
const THROTTLE_MS = 5 * 60 * 1000; // 5 minutes

export async function GET() {
  try {
    const now = Date.now();

    // Throttle
    if (now - lastTriggerTime < THROTTLE_MS) {
      return NextResponse.json({ skipped: true, reason: 'throttled' });
    }
    lastTriggerTime = now;

    // Quick check: is seeding active?
    const { data: config } = await supabaseAdmin
      .from('seed_config')
      .select('is_active')
      .eq('id', 1)
      .single();

    if (!config?.is_active) {
      return NextResponse.json({ skipped: true, reason: 'inactive' });
    }

    // Process up to 5 due items
    const result = await processScheduledQueue(5);

    return NextResponse.json({ success: true, ...result });
  } catch (err: any) {
    // Never return errors to prevent any debug info leakage
    console.error('[SeedTrigger] Error:', err);
    return NextResponse.json({ skipped: true });
  }
}
