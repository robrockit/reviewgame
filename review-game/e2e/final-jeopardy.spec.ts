/**
 * @fileoverview E2E tests for the Final Jeopardy flow.
 *
 * Covers the three-phase Final Jeopardy workflow driven by the teacher:
 *   1. Wager phase  — teams submit wagers while teacher waits
 *   2. Answering phase — teams write answers to the revealed question
 *   3. Reveal phase — teacher reveals and grades each team's answer
 *
 * Setup: a 1-team game created with Final Jeopardy enabled, one team
 * joined and approved, game started. The teacher then triggers FJ from
 * the board header.
 *
 * Note: Students are stuck on the waiting room (RG-145), so team
 * submission counts will show 0/1 throughout. The phase-advance buttons
 * are not gated on submission count, so the full teacher-side flow is
 * testable without real student interactions.
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

  test('clicking Start Final Jeopardy opens the wager phase modal', async ({
    teacherPage,
    anonymousPage,
  }) => {
    const gameId = await createFJGame(teacherPage);
    await joinGame(anonymousPage, gameId);
    await startGame(teacherPage, gameId);

    await teacherPage.locator('button', { hasText: 'Start Final Jeopardy' }).click();

    // Wager phase shows the waiting copy and the advance button
    await expect(
      teacherPage.locator('text=Teams are placing their wagers...')
    ).toBeVisible({ timeout: 10_000 });

    await expect(
      teacherPage.locator('button', { hasText: 'Advance to Answering' })
    ).toBeVisible();
  });

  test('teacher can advance from wager phase to answering phase', async ({
    teacherPage,
    anonymousPage,
  }) => {
    const gameId = await createFJGame(teacherPage);
    await joinGame(anonymousPage, gameId);
    await startGame(teacherPage, gameId);

    await teacherPage.locator('button', { hasText: 'Start Final Jeopardy' }).click();
    await expect(
      teacherPage.locator('button', { hasText: 'Advance to Answering' })
    ).toBeVisible({ timeout: 10_000 });

    await teacherPage.locator('button', { hasText: 'Advance to Answering' }).click();

    // Answering phase shows the question text and Begin Reveals button
    await expect(
      teacherPage.locator('text=Teams are writing their answers...')
    ).toBeVisible({ timeout: 10_000 });

    await expect(
      teacherPage.locator('button', { hasText: 'Begin Reveals' })
    ).toBeVisible();
  });

  test('teacher can advance from answering phase to reveal phase', async ({
    teacherPage,
    anonymousPage,
  }) => {
    const gameId = await createFJGame(teacherPage);
    await joinGame(anonymousPage, gameId);
    await startGame(teacherPage, gameId);

    await teacherPage.locator('button', { hasText: 'Start Final Jeopardy' }).click();
    await expect(
      teacherPage.locator('button', { hasText: 'Advance to Answering' })
    ).toBeVisible({ timeout: 10_000 });
    await teacherPage.locator('button', { hasText: 'Advance to Answering' }).click();

    await expect(
      teacherPage.locator('button', { hasText: 'Begin Reveals' })
    ).toBeVisible({ timeout: 10_000 });
    await teacherPage.locator('button', { hasText: 'Begin Reveals' }).click();

    // Reveal phase shows "Correct Answer:" and team cards with grade buttons
    await expect(
      teacherPage.locator('text=Correct Answer:')
    ).toBeVisible({ timeout: 10_000 });

    // Each un-revealed team card shows Correct and Incorrect grade buttons
    await expect(teacherPage.locator('button', { hasText: 'Correct' }).first()).toBeVisible();
    await expect(teacherPage.locator('button', { hasText: 'Incorrect' }).first()).toBeVisible();
  });

  test('grading all teams in reveal phase shows the Finish Game button', async ({
    teacherPage,
    anonymousPage,
  }) => {
    const gameId = await createFJGame(teacherPage);
    const teamId = await joinGame(anonymousPage, gameId);
    await startGame(teacherPage, gameId);

    // Start Final Jeopardy — enters wager phase
    await teacherPage.locator('button', { hasText: 'Start Final Jeopardy' }).click();
    await expect(
      teacherPage.locator('button', { hasText: 'Advance to Answering' })
    ).toBeVisible({ timeout: 10_000 });

    // Student submits wager during wager phase (device cookie is carried by anonymousPage)
    await anonymousPage.request.post(`/api/games/${gameId}/final-jeopardy/wager`, {
      data: { teamId, wager: 0 },
    });

    // Advance to answering phase
    await teacherPage.locator('button', { hasText: 'Advance to Answering' }).click();
    await expect(
      teacherPage.locator('button', { hasText: 'Begin Reveals' })
    ).toBeVisible({ timeout: 10_000 });

    // Student submits answer during answering phase
    await anonymousPage.request.post(`/api/games/${gameId}/final-jeopardy/answer`, {
      data: { teamId, answer: 'Russia' },
    });

    // Advance to reveal phase
    await teacherPage.locator('button', { hasText: 'Begin Reveals' }).click();
    await expect(teacherPage.locator('text=Correct Answer:')).toBeVisible({ timeout: 10_000 });

    // Grade the only team as correct — this reveals their card
    await teacherPage.locator('button', { hasText: 'Correct' }).first().click();

    // Once all teams are revealed the Finish Game button appears
    await expect(
      teacherPage.locator('button', { hasText: 'Finish Game' })
    ).toBeVisible({ timeout: 10_000 });
  });
});
