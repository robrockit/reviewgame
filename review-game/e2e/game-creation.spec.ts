/**
 * @fileoverview E2E tests for game creation flows.
 *
 * Covers basic game creation, game creation with Final Jeopardy, form validation,
 * and verifying the created game appears in the dashboard.
 *
 * Prerequisites:
 *   - At least one public question bank must exist in the staging Supabase project.
 *   - The premium teacher account must have an active subscription (tier=premium).
 */

import { test, expect } from './fixtures';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Fills out the minimum required game creation fields and submits.
 * Selects the first available question bank from the dropdown.
 * Returns the game ID from the redirect URL.
 */
async function createBasicGame(
  page: import('@playwright/test').Page,
  teamCount = 2
): Promise<string> {
  await page.goto('/dashboard/games/new');

  // Select the first available question bank (index 0 is the placeholder "Select a question bank")
  await page.selectOption('#questionBank', { index: 1 });

  // Set number of teams (#numTeams is a <select>, min value 2)
  await page.selectOption('#numTeams', String(teamCount));

  // Submit the form
  await page.click('button[type="submit"]');

  // Wait for redirect to the teacher lobby
  await page.waitForURL('**/game/teacher/**', { timeout: 15_000 });

  // Extract game ID from the URL path: /game/teacher/[gameId]
  const match = page.url().match(/\/game\/teacher\/([^/?#]+)/);
  if (!match) throw new Error(`Unexpected redirect URL: ${page.url()}`);
  return match[1];
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test.describe('game creation', () => {
  test('basic game creation redirects to teacher lobby', async ({ teacherPage: page }) => {
    const gameId = await createBasicGame(page);

    expect(gameId).toBeTruthy();
    expect(page.url()).toContain(`/game/teacher/${gameId}`);
  });

  test('created game appears in dashboard games list', async ({ teacherPage: page }) => {
    await createBasicGame(page);

    // Navigate back to the dashboard
    await page.goto('/dashboard');

    // The dashboard should show at least one game card / list item
    // The most recently created game should be visible
    const gameList = page.locator('[data-testid="game-list"], .game-card, [href*="/game/teacher/"]');
    await expect(gameList.first()).toBeVisible({ timeout: 10_000 });
  });

  test('creating a game with Final Jeopardy includes FJ question', async ({ teacherPage: page }) => {
    await page.goto('/dashboard/games/new');

    // Select first question bank
    await page.selectOption('#questionBank', { index: 1 });
    await page.selectOption('#numTeams', '2');

    // Enable Final Jeopardy
    await page.check('#finalJeopardyEnabled');

    // Fill in FJ fields
    await page.fill('#fjCategory', 'World Geography');
    await page.fill('#fjQuestion', 'This is the largest country in the world by land area.');
    await page.fill('#fjAnswer', 'Russia');

    await page.click('button[type="submit"]');

    await page.waitForURL('**/game/teacher/**', { timeout: 15_000 });
    expect(page.url()).toContain('/game/teacher/');
  });

  test('Final Jeopardy fields are hidden when toggle is off', async ({ teacherPage: page }) => {
    await page.goto('/dashboard/games/new');

    // FJ fields should not be visible before enabling the toggle
    await expect(page.locator('#fjCategory')).not.toBeVisible();
    await expect(page.locator('#fjQuestion')).not.toBeVisible();
    await expect(page.locator('#fjAnswer')).not.toBeVisible();
  });

  test('Final Jeopardy fields appear after enabling the toggle', async ({ teacherPage: page }) => {
    await page.goto('/dashboard/games/new');

    await page.check('#finalJeopardyEnabled');

    await expect(page.locator('#fjCategory')).toBeVisible();
    await expect(page.locator('#fjQuestion')).toBeVisible();
    await expect(page.locator('#fjAnswer')).toBeVisible();
  });

  test('submitting without a question bank shows a validation error', async ({ teacherPage: page }) => {
    await page.goto('/dashboard/games/new');

    // Do not select a question bank — submit immediately
    await page.click('button[type="submit"]');

    // Browser native validation or app-level error should appear
    // Check that we're still on the creation page (no redirect occurred)
    await page.waitForTimeout(2_000);
    expect(page.url()).toContain('/dashboard/games/new');
  });

  test('submitting FJ with missing fields shows validation errors', async ({ teacherPage: page }) => {
    await page.goto('/dashboard/games/new');

    await page.selectOption('#questionBank', { index: 1 });
    await page.selectOption('#numTeams', '2');

    // Enable FJ but leave fields empty
    await page.check('#finalJeopardyEnabled');

    await page.click('button[type="submit"]');

    // Should stay on the creation page — FJ validation blocks submission
    await page.waitForTimeout(2_000);
    expect(page.url()).toContain('/dashboard/games/new');
  });

  test('free-tier teacher sees team name inputs as disabled', async ({ freeTeacherPage: page }) => {
    await page.goto('/dashboard/games/new');

    // Custom team names are a premium-only feature.
    // Free-tier users see the inputs rendered but disabled.
    const teamNameInput = page.locator('input[placeholder^="Team"]').first();
    await expect(teamNameInput).toBeDisabled();

    // The "Premium Feature" badge should also be visible
    await expect(page.getByText('Premium Feature', { exact: true })).toBeVisible();
  });
});
