/**
 * @fileoverview E2E tests for the Final Jeopardy flow (RG-183).
 *
 * Covers the two-phase Final Jeopardy workflow:
 *   1. Wager phase — teacher reveals question; teams submit wager + answer together
 *   2. Reveal phase — teacher flips each team card individually, then grades
 *
 * Setup: a 1-team game created with Final Jeopardy enabled, one team
 * joined and approved, game started. The teacher then triggers FJ from
 * the board header.
 *
 * Note: Students are stuck on the waiting room (RG-145), so team
 * submission counts will show 0/1 throughout. Phase-advance buttons are
 * not gated on submission count, so the full teacher-side flow is
 * testable without real student interactions (except the grading test,
 * which submits via the API directly).
 *
 * Prerequisites:
 *   - At least one public question bank must exist in the staging Supabase project.
 *   - The premium teacher account must have an active subscription (tier=premium).
 *     Final Jeopardy is a premium-only feature.
 */

import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';
import { joinGame } from './helpers';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Creates a game with Final Jeopardy enabled. Returns the game ID. */
async function createFJGame(page: Page): Promise<string> {
  await page.goto('/dashboard/games/new');

  await page.selectOption('#questionBank', { index: 1 });
  await page.selectOption('#numTeams', '2'); // minimum allowed by the select

  // Enable Final Jeopardy and fill required fields
  await page.check('#finalJeopardyEnabled');
  await page.fill('#fjCategory', 'World Geography');
  await page.fill('#fjQuestion', 'This country spans 11 time zones and borders both Europe and Asia.');
  await page.fill('#fjAnswer', 'Russia');

  await page.click('button[type="submit"]');

  await page.waitForURL('**/game/teacher/**', { timeout: 15_000 });

  const match = page.url().match(/\/game\/teacher\/([^/?#]+)/);
  if (!match) throw new Error(`Unexpected redirect URL: ${page.url()}`);
  return match[1];
}

/**
 * Starts a game: approves the only pending team then clicks Start Game.
 * Assumes the teacher page is already at /game/teacher/[gameId].
 * Navigates to /game/board/[gameId] and waits for it to load.
 */
async function startGame(teacherPage: Page, gameId: string): Promise<void> {
  await teacherPage.reload();

  const approveButton = teacherPage.locator('button', { hasText: 'Approve' });
  await expect(approveButton.first()).toBeVisible({ timeout: 10_000 });
  await approveButton.first().click();

  const startButton = teacherPage.locator('button', { hasText: 'Start Game' });
  await expect(startButton).toBeEnabled({ timeout: 10_000 });
  await startButton.click();

  // The game is created with 2 expected teams but only 1 joins in tests.
  // Dismiss the TeamCountMismatchModal by clicking "Start Game Anyway".
  const mismatchButton = teacherPage.locator('button', { hasText: 'Start Game Anyway' });
  if (await mismatchButton.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await mismatchButton.click();
  }

  await teacherPage.waitForURL(`**/game/board/${gameId}**`, { timeout: 15_000 });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test.describe('Final Jeopardy flow', () => {
  test('Start Final Jeopardy button appears on board for FJ-enabled game', async ({
    teacherPage,
    anonymousPage,
  }) => {
    const gameId = await createFJGame(teacherPage);
    await joinGame(anonymousPage, gameId);
    await startGame(teacherPage, gameId);

    // The FJ button is shown in the board header when FJ question is configured
    const fjButton = teacherPage.locator('button', { hasText: 'Start Final Jeopardy' });
    await expect(fjButton).toBeVisible({ timeout: 10_000 });
    await expect(fjButton).toBeEnabled();
  });

  test('clicking Start Final Jeopardy opens the wager phase modal with Reveal Question button', async ({
    teacherPage,
    anonymousPage,
  }) => {
    const gameId = await createFJGame(teacherPage);
    await joinGame(anonymousPage, gameId);
    await startGame(teacherPage, gameId);

    await teacherPage.locator('button', { hasText: 'Start Final Jeopardy' }).click();

    // Wager phase shows the combined submission copy and the Reveal Question button
    await expect(
      teacherPage.locator('text=Teams are submitting their wager and answer...')
    ).toBeVisible({ timeout: 10_000 });

    // Before teacher reveals: Reveal Question button visible, Begin Reveals not yet
    await expect(
      teacherPage.locator('button', { hasText: 'Reveal Question' })
    ).toBeVisible();

    await expect(
      teacherPage.locator('button', { hasText: 'Begin Reveals' })
    ).not.toBeVisible();
  });

  test('teacher can reveal question during wager phase', async ({
    teacherPage,
    anonymousPage,
  }) => {
    const gameId = await createFJGame(teacherPage);
    await joinGame(anonymousPage, gameId);
    await startGame(teacherPage, gameId);

    await teacherPage.locator('button', { hasText: 'Start Final Jeopardy' }).click();
    await expect(
      teacherPage.locator('button', { hasText: 'Reveal Question' })
    ).toBeVisible({ timeout: 10_000 });

    await teacherPage.locator('button', { hasText: 'Reveal Question' }).click();

    // After reveal: the question text is shown and Reveal Question → Begin Reveals
    await expect(
      teacherPage.locator('text=Question revealed to students')
    ).toBeVisible({ timeout: 10_000 });

    await expect(
      teacherPage.locator('button', { hasText: 'Begin Reveals' })
    ).toBeVisible();

    await expect(
      teacherPage.locator('button', { hasText: 'Reveal Question' })
    ).not.toBeVisible();
  });

  test('teacher can advance directly from wager phase to reveal phase', async ({
    teacherPage,
    anonymousPage,
  }) => {
    const gameId = await createFJGame(teacherPage);
    await joinGame(anonymousPage, gameId);
    await startGame(teacherPage, gameId);

    await teacherPage.locator('button', { hasText: 'Start Final Jeopardy' }).click();
    await expect(
      teacherPage.locator('button', { hasText: 'Reveal Question' })
    ).toBeVisible({ timeout: 10_000 });

    // Reveal question first, then advance directly to reveal phase
    await teacherPage.locator('button', { hasText: 'Reveal Question' }).click();
    await expect(
      teacherPage.locator('button', { hasText: 'Begin Reveals' })
    ).toBeVisible({ timeout: 10_000 });

    await teacherPage.locator('button', { hasText: 'Begin Reveals' }).click();

    // Reveal phase shows "Correct Answer:" — no intermediate answering phase
    await expect(
      teacherPage.locator('text=Correct Answer:')
    ).toBeVisible({ timeout: 10_000 });

    // Each unflipped team card shows "Click to reveal" (not yet graded)
    await expect(teacherPage.locator('text=Click to reveal').first()).toBeVisible();
  });

  test('grading all teams in reveal phase shows the Finish Game button', async ({
    teacherPage,
    anonymousPage,
  }) => {
    const gameId = await createFJGame(teacherPage);
    const teamId = await joinGame(anonymousPage, gameId);
    await startGame(teacherPage, gameId);

    // Read the device_id the anonymous page uses to authenticate API calls.
    // It is stored in localStorage by getDeviceId() during the join flow and
    // must be sent as the X-Device-ID header (not a cookie).
    const deviceId = await anonymousPage.evaluate(
      () => localStorage.getItem('reviewgame_device_id')
    );
    if (!deviceId) throw new Error('device_id not found in anonymousPage localStorage');

    // Start Final Jeopardy — enters wager phase
    await teacherPage.locator('button', { hasText: 'Start Final Jeopardy' }).click();
    await expect(
      teacherPage.locator('button', { hasText: 'Reveal Question' })
    ).toBeVisible({ timeout: 10_000 });

    // Student submits wager AND answer together in one call
    await anonymousPage.request.post(`/api/games/${gameId}/final-jeopardy/submit`, {
      data: { teamId, wager: 0, answer: 'Russia' },
      headers: { 'X-Device-ID': deviceId },
    });

    // Teacher reveals question, then advances to reveal phase
    await teacherPage.locator('button', { hasText: 'Reveal Question' }).click();
    await expect(
      teacherPage.locator('button', { hasText: 'Begin Reveals' })
    ).toBeVisible({ timeout: 10_000 });

    await teacherPage.locator('button', { hasText: 'Begin Reveals' }).click();
    await expect(teacherPage.locator('text=Correct Answer:')).toBeVisible({ timeout: 10_000 });

    // Step 1: click the team card to flip it (reveals wager + answer)
    await teacherPage.locator('[aria-label*="Reveal"]').first().click();

    // Step 2: Correct and Incorrect buttons appear after flip
    await expect(teacherPage.locator('button', { hasText: 'Correct' }).first()).toBeVisible({
      timeout: 5_000,
    });

    // Grade as correct — this is the server-confirmed grade action
    await teacherPage.locator('button', { hasText: 'Correct' }).first().click();

    // Once all teams are graded the Finish Game button appears
    await expect(
      teacherPage.locator('button', { hasText: 'Finish Game' })
    ).toBeVisible({ timeout: 10_000 });
  });
});
