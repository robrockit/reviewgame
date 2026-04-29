/**
 * @fileoverview Shared E2E test helpers.
 *
 * Common multi-step actions used across spec files. Centralised here so
 * selector changes only need to be fixed in one place.
 */

import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

// ─── Game creation ────────────────────────────────────────────────────────────

/**
 * Creates a basic game as the teacher with the given team count.
 * Selects the first available question bank from the dropdown.
 * Returns the game ID extracted from the redirect URL.
 */
export async function createGame(page: Page, numTeams = 2): Promise<string> {
  await page.goto('/dashboard/games/new');

  // Index 0 is the placeholder "Select a question bank"
  await page.selectOption('#questionBank', { index: 1 });
  await page.selectOption('#numTeams', String(numTeams));
  await page.click('button[type="submit"]');

  await page.waitForURL('**/game/teacher/**', { timeout: 15_000 });

  const match = page.url().match(/\/game\/teacher\/([^/?#]+)/);
  if (!match) throw new Error(`Unexpected redirect URL after game creation: ${page.url()}`);
  return match[1];
}

// ─── Game join ────────────────────────────────────────────────────────────────

/**
 * Joins a game from the given page (typically an anonymous context).
 * Waits for the waiting-room redirect and returns the team ID.
 */
export async function joinGame(page: Page, gameId: string): Promise<string> {
  await page.goto(`/game/team/join/${gameId}`);

  // Button transitions from "Checking…" to "🎮 Join Game" after page validation
  const joinButton = page.locator('button', { hasText: '🎮 Join Game' });
  await expect(joinButton).toBeEnabled({ timeout: 10_000 });
  await joinButton.click();

  await page.waitForURL('**/game/team/waiting/**', { timeout: 15_000 });

  const match = page.url().match(/\/game\/team\/waiting\/([^/?#]+)/);
  if (!match) throw new Error(`Unexpected redirect URL after join: ${page.url()}`);
  return match[1];
}

// ─── Quick Fire game creation ─────────────────────────────────────────────────

/**
 * Creates a Quick Fire (pub trivia) game as the teacher.
 * Selects the Quick Fire game mode and the first available question bank.
 * Returns the game ID extracted from the redirect URL.
 *
 * Prerequisite: the teacher account must have a BASIC+ subscription and the
 * first available question bank must contain at least one question with
 * mc_options populated (Quick Fire start will fail otherwise).
 */
export async function createQuickFireGame(page: Page): Promise<string> {
  await page.goto('/dashboard/games/new');

  // Select Quick Fire game mode (a button, not a <select>)
  await page.locator('button', { hasText: 'Quick Fire' }).click();

  // Index 0 is the placeholder "Select a question bank..."
  await page.selectOption('#questionBank', { index: 1 });

  await page.locator('button', { hasText: 'Create Game' }).click();

  await page.waitForURL('**/game/quick-fire/teacher/**', { timeout: 15_000 });

  const match = page.url().match(/\/game\/quick-fire\/teacher\/([^/?#]+)/);
  if (!match) {
    throw new Error(`Unexpected redirect URL after Quick Fire game creation: ${page.url()}`);
  }
  return match[1];
}

// ─── Quick Fire player join ───────────────────────────────────────────────────

/**
 * Joins a Quick Fire game from the given page (typically an anonymous context).
 * Optionally selects an icon by its label before submitting (e.g. 'Dog', 'Rocket').
 * Waits for the pending-approval screen to confirm the join request was sent.
 */
export async function joinQuickFireGame(
  page: Page,
  gameId: string,
  playerName: string,
  iconLabel?: string,
): Promise<void> {
  await page.goto(`/game/quick-fire/player/${gameId}`);

  await expect(
    page.locator('h1', { hasText: 'Join Quick Fire' }),
  ).toBeVisible({ timeout: 10_000 });

  if (iconLabel) {
    await page.locator(`button[title="${iconLabel}"]`).click();
  }

  await page.fill('input[placeholder="Your name"]', playerName);
  await page.locator('button', { hasText: 'Join Game' }).click();

  await expect(
    page.locator('text=Waiting for teacher approval'),
  ).toBeVisible({ timeout: 10_000 });
}

// ─── Game start ───────────────────────────────────────────────────────────────

/**
 * Clicks "Start Game" and dismisses the TeamCountMismatchModal if it appears.
 *
 * The modal appears when fewer teams have joined than the game's configured
 * team count. It has a "Start Game Anyway" button that bypasses the check.
 */
export async function clickStartGame(page: Page): Promise<void> {
  await page.locator('button', { hasText: 'Start Game' }).click();

  const mismatchButton = page.locator('button', { hasText: 'Start Game Anyway' });
  if (await mismatchButton.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await mismatchButton.click();
  }
}
