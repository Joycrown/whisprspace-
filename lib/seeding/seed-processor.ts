/**
 * Seed Processor — Lightweight page-load trigger
 *
 * Called from the main feed server component to process
 * due scheduled items. Designed to be fast and non-blocking.
 */

import { supabaseAdmin } from '@/lib/core/supabase/admin-client';
import { processScheduledQueue } from './seed-orchestrator';

// Throttle: only check every 5 minutes
let lastCheckTime = 0;
const CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Lightweight check — call this from page load.
 * Returns immediately if checked recently.
 */
export async function triggerSeedProcessing(): Promise<void> {
  const now = Date.now();

  // Throttle: skip if checked recently
  if (now - lastCheckTime < CHECK_INTERVAL_MS) return;
  lastCheckTime = now;

  try {
    // Quick check: is seeding active?
    const { data: config } = await supabaseAdmin
      .from('seed_config')
      .select('is_active')
      .eq('id', 1)
      .single();

    if (!config?.is_active) return;

    // Quick check: are there any due items?
    const { count } = await supabaseAdmin
      .from('seed_scheduled_content')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'approved')
      .lte('scheduled_at', new Date().toISOString());

    if (!count || count === 0) return;

    // Process up to 5 items (fire-and-forget to not block page load)
    processScheduledQueue(5).catch((err) => {
      console.error('[SeedProcessor] Error processing queue:', err);
    });
  } catch (err) {
    // Silently fail — seed processing should never break the app
    console.error('[SeedProcessor] Trigger check failed:', err);
  }
}
