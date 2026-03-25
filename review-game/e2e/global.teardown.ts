/**
 * @fileoverview Global Playwright teardown — runs once after all E2E tests.
 *
 * Deletes all games owned by the E2E test accounts so that staging stays
 * clean across repeated CI runs. Safe to skip if the env vars are absent
 * (e.g. local runs without a service role key).
 */

import { createClient } from '@supabase/supabase-js';
import type { FullConfig } from '@playwright/test';

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Playwright requires the signature
export default async function globalTeardown(_config: FullConfig): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY;
  const teacherEmail = process.env.E2E_TEACHER_EMAIL;
  const freeTeacherEmail = process.env.E2E_FREE_TEACHER_EMAIL;

  if (!supabaseUrl || !serviceRoleKey || !teacherEmail || !freeTeacherEmail) {
    console.log('[global teardown] Skipping — service role key or account emails not set');
    return;
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Resolve teacher user IDs from the profiles table
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id')
    .in('email', [teacherEmail, freeTeacherEmail]);

  if (profilesError) {
    console.warn('[global teardown] Could not fetch test account profiles:', profilesError.message);
    return;
  }

  if (!profiles || profiles.length === 0) {
    console.log('[global teardown] No test account profiles found — nothing to clean up');
    return;
  }

  const teacherIds = profiles.map((p) => p.id);

  const { error: deleteError, count } = await supabase
    .from('games')
    .delete({ count: 'exact' })
    .in('teacher_id', teacherIds);

  if (deleteError) {
    console.warn('[global teardown] Failed to delete test games:', deleteError.message);
  } else {
    console.log(`[global teardown] Deleted ${count ?? 0} test game(s)`);
  }
}
