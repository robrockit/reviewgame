/**
 * @fileoverview E2E tests for the game join flow.
 *
 * Covers the student-side join experience: accessing the join page,
 * joining a game, capacity enforcement, invalid game handling, and
 * the rejoin flow for returning devices.
 *
 * Students are fully anonymous — no auth account is needed. Each fresh
 * browser context has its own empty localStorage, making it an independent
 * "device" from the app's perspective.
 *
 * Prerequisites:
 *   - At least one public question bank must exist in the staging Supabase project.
 *   - The premium teacher account must have an active subscription.
 */

import { test, expect } from './fixtures';
import type { Page, BrowserContext } from '@playwright/test';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Creates a basic game as the teacher and returns the game ID.
 * Navigates the teacher page to /dashboard/games/new and submits.
 */
async function createGame(
  page: Page,
  numTeams = 2
): Promise<string> {
  await page.goto('/dashboard/games/new');

  // Select first available question bank
  await page.selectOption('#questionBank', { index: 1 });

  await page.selectOption('#numTeams', String(numTeams));
  await page.click('button[type="submit"]');

  // Wait for redirect to teacher lobby: /game/teacher/[gameId]
  await page.waitForURL('**/game/teacher/**', { timeout: 15_000 });

  const match = page.url().match(/\/game\/teacher\/([^/?#]+)/);
  if (!match) throw new Error(`Unexpected redirect URL: ${page.url()}`);
  return match[1];
}

/**
 * Joins a game from the given page/context and returns the team ID
 * extracted from the waiting-room redirect URL.
 */
async function joinGame(page: Page, gameId: string): Promise<string> {
  await page.goto(`/game/team/join/${gameId}`);

  // Wait for page validation to finish (button transitions from "Checking..." to "🎮 Join Game")
  const joinButton = page.locator('button', { hasText: '🎮 Join Game' });
  await expect(joinButton).toBeVisible({ timeout: 10_000 });
  await expect(joinButton).toBeEnabled();

  await joinButton.click();

  // Wait for redirect to waiting room
  await page.waitForURL('**/game/team/waiting/**', { timeout: 15_000 });

  const match = page.url().match(/\/game\/team\/waiting\/([^/?#]+)/);
  if (!match) throw new Error(`Unexpected redirect URL: ${page.url()}`);
  return match[1];
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test.describe('game join flow', () => {
  test('join page loads with valid game', async ({ teacherPage, anonymousPage }) => {
    const gameId = await createGame(teacherPage);

    await anonymousPage.goto(`/game/team/join/${gameId}`);

    // The page heading should be present once validation completes
    await expect(anonymousPage.locator('h1', { hasText: 'Join Game' })).toBeVisible({
      timeout: 10_000,
    });

    // Join button should appear after the "Checking..." validation phase
    await expect(
      anonymousPage.locator('button', { hasText: '🎮 Join Game' })
    ).toBeVisible({ timeout: 10_000 });
  });

  test('clicking join redirects to the waiting room', async ({ teacherPage, anonymousPage }) => {
    const gameId = await createGame(teacherPage);
    const teamId = await joinGame(anonymousPage, gameId);

    expect(teamId).toBeTruthy();
    expect(anonymousPage.url()).toContain(`/game/team/waiting/${teamId}`);
  });

  test('returning device rejoins without creating a duplicate team', async ({
    teacherPage,
    anonymousPage,
  }) => {
    const gameId = await createGame(teacherPage);

    // First join
    const teamId = await joinGame(anonymousPage, gameId);

    // Navigate back to the join page with the same browser context
    // (same localStorage → same deviceId)
    await anonymousPage.goto(`/game/team/join/${gameId}`);

    // Clicking join again should redirect back to the same waiting room
    const joinButton = anonymousPage.locator('button', { hasText: '🎮 Join Game' });
    await expect(joinButton).toBeVisible({ timeout: 10_000 });
    await joinButton.click();

    await anonymousPage.waitForURL('**/game/team/waiting/**', { timeout: 15_000 });

    // Should be the same team, not a new one
    const rematch = anonymousPage.url().match(/\/game\/team\/waiting\/([^/?#]+)/);
    expect(rematch?.[1]).toBe(teamId);
  });

  test('joining a full game shows a capacity error', async ({
    teacherPage,
    anonymousPage,
    browser,
  }) => {
    // Create a 2-team game (minimum allowed by the select) so we can fill both
    // slots and then test that a third device sees the capacity error.
    const gameId = await createGame(teacherPage, 2);

    // First anonymous device fills slot 1
    await joinGame(anonymousPage, gameId);

    // Second device fills slot 2 (fresh context = new deviceId)
    let secondContext: BrowserContext | null = null;
    let thirdContext: BrowserContext | null = null;
    try {
      secondContext = await browser.newContext();
      const secondPage = await secondContext.newPage();
      await joinGame(secondPage, gameId);

      // Third device tries to join — game is now full
      thirdContext = await browser.newContext();
      const thirdPage = await thirdContext.newPage();

      await thirdPage.goto(`/game/team/join/${gameId}`);

      // The page-load validation detects the game is full and shows an error.
      const errorText = thirdPage.locator('p.text-red-700');
      await expect(errorText).toBeVisible({ timeout: 10_000 });
      await expect(errorText).toContainText(/full/i);

      // Join button should be disabled (error state disables it)
      const joinButton = thirdPage.locator('button', { hasText: '🎮 Join Game' });
      await expect(joinButton).toBeDisabled();
    } finally {
      await secondContext?.close();
      await thirdContext?.close();
    }
  });

  test('navigating to an invalid game ID shows an error', async ({ anonymousPage }) => {
    await anonymousPage.goto('/game/team/join/00000000-0000-0000-0000-000000000000');

    // Game not found error should appear after validation
    const errorText = anonymousPage.locator('p.text-red-700');
    await expect(errorText).toBeVisible({ timeout: 10_000 });
    await expect(errorText).toContainText(/not found/i);
  });
});
