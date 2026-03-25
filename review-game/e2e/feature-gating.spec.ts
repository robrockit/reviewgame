/**
 * @fileoverview E2E tests for subscription-tier feature gating.
 *
 * Verifies that premium-only features are correctly restricted for free-tier
 * users and accessible to premium users. Tests are paired where it makes
 * sense — one assertion for a free-tier teacher and a matching one for the
 * premium teacher.
 *
 * Currently gated features:
 *   - Custom team names (BASIC / PREMIUM only — inputs are disabled for FREE)
 *   - Game creation limits (FREE tier capped at 3 games)
 *
 * Features NOT currently gated by tier in the UI (available to all):
 *   - Final Jeopardy toggle (no tier check on #finalJeopardyEnabled)
 *   - Timer settings
 *
 * Prerequisites:
 *   - The premium teacher account must have subscription_tier='premium' and
 *     subscription_status='ACTIVE'.
 *   - The free-tier teacher account must have subscription_tier='free'.
 *   - Both accounts must exist in the staging Supabase project (run
 *     `npm run test:e2e:seed` to create them).
 */

import { test, expect } from './fixtures';

// ─── Tests ────────────────────────────────────────────────────────────────────

test.describe('feature gating — game creation form', () => {
  test('free-tier teacher: team name inputs are disabled', async ({ freeTeacherPage: page }) => {
    await page.goto('/dashboard/games/new');

    // Custom team names are premium-only. All team name inputs must be disabled.
    const teamNameInputs = page.locator('input[placeholder^="Team"]');
    await expect(teamNameInputs.first()).toBeVisible({ timeout: 10_000 });

    const count = await teamNameInputs.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      await expect(teamNameInputs.nth(i)).toBeDisabled();
    }
  });

  test('free-tier teacher: "Premium Feature" badge is visible on team names', async ({
    freeTeacherPage: page,
  }) => {
    await page.goto('/dashboard/games/new');

    const badge = page.getByText('Premium Feature', { exact: true });
    await expect(badge).toBeVisible({ timeout: 10_000 });
  });

  test('premium teacher: team name inputs are enabled', async ({ teacherPage: page }) => {
    await page.goto('/dashboard/games/new');

    const teamNameInputs = page.locator('input[placeholder^="Team"]');
    await expect(teamNameInputs.first()).toBeVisible({ timeout: 10_000 });

    // Premium users can edit team names — inputs must be enabled
    const count = await teamNameInputs.count();
    for (let i = 0; i < count; i++) {
      await expect(teamNameInputs.nth(i)).toBeEnabled();
    }
  });

  test('premium teacher: "Premium Feature" badge is not shown', async ({
    teacherPage: page,
  }) => {
    await page.goto('/dashboard/games/new');

    // Wait for the page to finish loading profile data
    await page.waitForSelector('select#questionBank', { timeout: 10_000 });

    // The "Premium Feature" locked badge should not appear for paid users
    await expect(page.getByText('Premium Feature', { exact: true })).not.toBeVisible();
  });

  test('Final Jeopardy toggle is accessible to free-tier teachers', async ({
    freeTeacherPage: page,
  }) => {
    await page.goto('/dashboard/games/new');

    // FJ is not currently gated by subscription tier in the UI.
    // The toggle should be present and enabled for all users.
    const fjToggle = page.locator('#finalJeopardyEnabled');
    await expect(fjToggle).toBeVisible({ timeout: 10_000 });
    await expect(fjToggle).toBeEnabled();
  });

  test('Final Jeopardy toggle is accessible to premium teachers', async ({
    teacherPage: page,
  }) => {
    await page.goto('/dashboard/games/new');

    const fjToggle = page.locator('#finalJeopardyEnabled');
    await expect(fjToggle).toBeVisible({ timeout: 10_000 });
    await expect(fjToggle).toBeEnabled();
  });
});

test.describe('feature gating — dashboard access', () => {
  test('free-tier teacher can access the dashboard', async ({ freeTeacherPage: page }) => {
    await page.goto('/dashboard');

    // Dashboard should load without redirecting to an upgrade or error page
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });
  });

  test('premium teacher can access the dashboard', async ({ teacherPage: page }) => {
    await page.goto('/dashboard');

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });
  });

  test('unauthenticated user is redirected away from the dashboard', async ({
    anonymousPage: page,
  }) => {
    await page.goto('/dashboard');

    // Should redirect to login (middleware enforces auth on /dashboard)
    await page.waitForURL(/\/(login|auth)/, { timeout: 10_000 });
    expect(page.url()).toMatch(/\/(login|auth)/);
  });
});
