/**
 * @fileoverview E2E tests for the core teacher-driven game flow.
 *
 * Covers the lifecycle from team join through game board interaction:
 *   - Pending teams visible in the teacher lobby
 *   - Teacher approves a team
 *   - Start Game button becomes available after all teams are approved
 *   - Game start redirects the teacher to the game board
 *   - Game board renders question categories and cards
 *   - Clicking a question card opens the question modal
 *   - Question modal can be closed
 *
 * Note: Tests create a 2-team game (the select minimum) but only join one
 * team for speed. When starting with fewer teams than expected, the
 * TeamCountMismatchModal appears — helpers dismiss it via "Start Game Anyway".
 *
 * Scoring tests (Correct / Incorrect buttons) require a student to buzz in,
 * which involves coordinating two live browser windows. Those flows are
 * covered separately in a multi-page integration scenario.
 *
 * Prerequisites:
 *   - At least one public question bank must exist in the staging Supabase project.
 *   - The premium teacher account must have an active subscription.
 */

import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Creates a new game as the teacher with the given team count.
 * Returns the game ID extracted from the redirect URL.
 */
async function createGame(page: Page, numTeams = 2): Promise<string> {
  await page.goto('/dashboard/games/new');

  await page.selectOption('#questionBank', { index: 1 });
  await page.selectOption('#numTeams', String(numTeams));
  await page.click('button[type="submit"]');

  await page.waitForURL('**/game/teacher/**', { timeout: 15_000 });

  const match = page.url().match(/\/game\/teacher\/([^/?#]+)/);
  if (!match) throw new Error(`Unexpected redirect URL: ${page.url()}`);
  return match[1];
}

/**
 * Joins a game from the given page (anonymous context).
 * Waits for the waiting room redirect and returns the team ID.
 */
async function joinGame(page: Page, gameId: string): Promise<string> {
  await page.goto(`/game/team/join/${gameId}`);

  const joinButton = page.locator('button', { hasText: '🎮 Join Game' });
  await expect(joinButton).toBeEnabled({ timeout: 10_000 });
  await joinButton.click();

  await page.waitForURL('**/game/team/waiting/**', { timeout: 15_000 });

  const match = page.url().match(/\/game\/team\/waiting\/([^/?#]+)/);
  if (!match) throw new Error(`Unexpected redirect URL: ${page.url()}`);
  return match[1];
}

/**
 * Clicks "Start Game" and dismisses the TeamCountMismatchModal if it appears
 * (shown when fewer teams joined than the game's expected count).
 */
async function clickStartGame(page: Page): Promise<void> {
  await page.locator('button', { hasText: 'Start Game' }).click();
  const mismatchButton = page.locator('button', { hasText: 'Start Game Anyway' });
  if (await mismatchButton.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await mismatchButton.click();
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test.describe('game flow', () => {
  test('pending team appears in teacher lobby after joining', async ({
    teacherPage,
    anonymousPage,
  }) => {
    const gameId = await createGame(teacherPage);

    // Student joins — teacher lobby is already open at /game/teacher/[gameId]
    await joinGame(anonymousPage, gameId);

    // Teacher refreshes lobby to pick up the new team
    await teacherPage.reload();

    // A pending team card should now be visible
    const pendingBadge = teacherPage.locator('text=Pending');
    await expect(pendingBadge.first()).toBeVisible({ timeout: 10_000 });
  });

  test('teacher can approve a pending team', async ({ teacherPage, anonymousPage }) => {
    const gameId = await createGame(teacherPage);
    await joinGame(anonymousPage, gameId);

    await teacherPage.reload();

    // Click the Approve button for the pending team
    const approveButton = teacherPage.locator('button', { hasText: 'Approve' });
    await expect(approveButton.first()).toBeVisible({ timeout: 10_000 });
    await approveButton.first().click();

    // The status badge should update to "Approved"
    const approvedBadge = teacherPage.locator('text=Approved');
    await expect(approvedBadge.first()).toBeVisible({ timeout: 10_000 });
  });

  test('Start Game button is enabled after all teams are approved', async ({
    teacherPage,
    anonymousPage,
  }) => {
    const gameId = await createGame(teacherPage);
    await joinGame(anonymousPage, gameId);

    await teacherPage.reload();

    // Approve the only pending team
    const approveButton = teacherPage.locator('button', { hasText: 'Approve' });
    await approveButton.first().click();

    // After approval the Start Game button should be active (no pending teams remain)
    const startGameButton = teacherPage.locator('button', { hasText: 'Start Game' });
    await expect(startGameButton).toBeVisible({ timeout: 10_000 });
    await expect(startGameButton).toBeEnabled();
  });

  test('starting the game redirects teacher to the game board', async ({
    teacherPage,
    anonymousPage,
  }) => {
    const gameId = await createGame(teacherPage);
    await joinGame(anonymousPage, gameId);

    await teacherPage.reload();

    const approveButton = teacherPage.locator('button', { hasText: 'Approve' });
    await approveButton.first().click();

    const startGameButton = teacherPage.locator('button', { hasText: 'Start Game' });
    await expect(startGameButton).toBeEnabled({ timeout: 10_000 });
    await clickStartGame(teacherPage);

    await teacherPage.waitForURL(`**/game/board/${gameId}**`, { timeout: 15_000 });
    expect(teacherPage.url()).toContain(`/game/board/${gameId}`);
  });

  test('game board displays question category headers', async ({
    teacherPage,
    anonymousPage,
  }) => {
    const gameId = await createGame(teacherPage);
    await joinGame(anonymousPage, gameId);

    await teacherPage.reload();
    await teacherPage.locator('button', { hasText: 'Approve' }).first().click();
    await clickStartGame(teacherPage);
    await teacherPage.waitForURL(`**/game/board/${gameId}**`, { timeout: 15_000 });

    // The board renders category headers with the .category-header class
    const categoryHeaders = teacherPage.locator('.category-header');
    await expect(categoryHeaders.first()).toBeVisible({ timeout: 10_000 });

    // A full bank has at least one category
    const count = await categoryHeaders.count();
    expect(count).toBeGreaterThan(0);
  });

  test('clicking a question card opens the question modal', async ({
    teacherPage,
    anonymousPage,
  }) => {
    const gameId = await createGame(teacherPage);
    await joinGame(anonymousPage, gameId);

    await teacherPage.reload();
    await teacherPage.locator('button', { hasText: 'Approve' }).first().click();
    await clickStartGame(teacherPage);
    await teacherPage.waitForURL(`**/game/board/${gameId}**`, { timeout: 15_000 });

    // Question cards are divs with bg-blue-600 but NOT the category-header class.
    // Click the first available (non-used) question card.
    const questionCard = teacherPage.locator(
      '.bg-blue-600:not(.category-header)'
    );
    await expect(questionCard.first()).toBeVisible({ timeout: 10_000 });
    await questionCard.first().click();

    // The question modal exposes a scoring controls group
    const scoringControls = teacherPage.locator('[aria-label="Question scoring controls"]');
    await expect(scoringControls).toBeVisible({ timeout: 10_000 });

    // All three action buttons should be present
    await expect(teacherPage.locator('button', { hasText: '✓ Correct' })).toBeVisible();
    await expect(teacherPage.locator('button', { hasText: '✗ Incorrect' })).toBeVisible();
    await expect(teacherPage.locator('button', { hasText: 'Close' })).toBeVisible();
  });

  test('closing the question modal returns to the game board', async ({
    teacherPage,
    anonymousPage,
  }) => {
    const gameId = await createGame(teacherPage);
    await joinGame(anonymousPage, gameId);

    await teacherPage.reload();
    await teacherPage.locator('button', { hasText: 'Approve' }).first().click();
    await clickStartGame(teacherPage);
    await teacherPage.waitForURL(`**/game/board/${gameId}**`, { timeout: 15_000 });

    const questionCard = teacherPage.locator('.bg-blue-600:not(.category-header)');
    await questionCard.first().click();

    // Wait for the modal to open, then close it
    const scoringControls = teacherPage.locator('[aria-label="Question scoring controls"]');
    await expect(scoringControls).toBeVisible({ timeout: 10_000 });

    await teacherPage.locator('button', { hasText: 'Close' }).click();

    // Modal should be gone; board is still visible
    await expect(scoringControls).not.toBeVisible({ timeout: 5_000 });
    await expect(teacherPage.locator('.category-header').first()).toBeVisible();
  });
});
