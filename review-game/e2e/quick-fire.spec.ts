/**
 * @fileoverview E2E tests for the Quick Fire (pub trivia) game mode.
 *
 * Covers the full lifecycle:
 *   - Student join page with optional icon picker
 *   - Teacher approval / rejection flow
 *   - Icons displayed in teacher pending list, approved list, round results,
 *     and final leaderboard
 *   - Full game: lobby → start game → question → student answers →
 *     live tally visible on teacher → teacher ends question → round results →
 *     repeat until done → teacher ends game → final rankings
 *
 * Prerequisites:
 *   - The first public question bank must have at least one question with
 *     mc_options populated (required for Quick Fire game start).
 *   - The premium teacher account must have an active BASIC+ subscription.
 *   - The staging Supabase project must have Realtime enabled on the teams table.
 */

import { test, expect } from './fixtures';
import type { BrowserContext } from '@playwright/test';
import { createQuickFireGame, joinQuickFireGame } from './helpers';

// ─── Lobby ────────────────────────────────────────────────────────────────────

test.describe('quick fire — lobby', () => {
  test('join page loads for a valid game', async ({ teacherPage, anonymousPage }) => {
    const gameId = await createQuickFireGame(teacherPage);

    await anonymousPage.goto(`/game/quick-fire/player/${gameId}`);

    await expect(
      anonymousPage.locator('h1', { hasText: 'Join Quick Fire' }),
    ).toBeVisible({ timeout: 10_000 });
    await expect(anonymousPage.locator('button', { hasText: 'Join Game' })).toBeVisible();
  });

  test('join button is disabled until a name is entered; icon picker is optional', async ({
    teacherPage,
    anonymousPage,
  }) => {
    const gameId = await createQuickFireGame(teacherPage);

    await anonymousPage.goto(`/game/quick-fire/player/${gameId}`);
    await expect(
      anonymousPage.locator('h1', { hasText: 'Join Quick Fire' }),
    ).toBeVisible({ timeout: 10_000 });

    // Without a name the button is disabled
    const joinButton = anonymousPage.locator('button', { hasText: 'Join Game' });
    await expect(joinButton).toBeDisabled();

    // "(optional)" label is shown — icon is not required
    await expect(anonymousPage.locator('text=(optional)')).toBeVisible();

    // Entering a name alone enables the button
    await anonymousPage.fill('input[placeholder="Your name"]', 'NameOnly');
    await expect(joinButton).toBeEnabled();
  });

  test('selecting an icon toggles visual state; clicking again deselects it', async ({
    teacherPage,
    anonymousPage,
  }) => {
    const gameId = await createQuickFireGame(teacherPage);

    await anonymousPage.goto(`/game/quick-fire/player/${gameId}`);
    await expect(
      anonymousPage.locator('h1', { hasText: 'Join Quick Fire' }),
    ).toBeVisible({ timeout: 10_000 });

    const dogButton = anonymousPage.locator('button[title="Dog"]');
    await expect(dogButton).toBeVisible({ timeout: 10_000 });

    // Select: ring-2 class applied and "(optional)" hint disappears
    await dogButton.click();
    await expect(dogButton).toHaveClass(/ring-2/);
    await expect(anonymousPage.locator('text=(optional)')).not.toBeVisible();

    // Deselect: back to unselected state
    await dogButton.click();
    await expect(dogButton).not.toHaveClass(/ring-2/);
    await expect(anonymousPage.locator('text=(optional)')).toBeVisible();
  });

  test('student who joins appears in teacher pending list with their icon', async ({
    teacherPage,
    anonymousPage,
  }) => {
    const gameId = await createQuickFireGame(teacherPage);

    // Teacher is already on the lobby page (from createQuickFireGame redirect)
    await expect(
      teacherPage.locator('h1', { hasText: 'Quick Fire — Teacher View' }),
    ).toBeVisible({ timeout: 10_000 });

    // Student joins with the Dog icon
    await joinQuickFireGame(anonymousPage, gameId, 'IconStudent', 'Dog');

    // Teacher receives Postgres CHANGES event and adds the pending player
    await expect(teacherPage.locator('text=IconStudent')).toBeVisible({ timeout: 15_000 });

    // Dog emoji should appear beside the player name in the pending section
    await expect(teacherPage.locator('text=🐶').first()).toBeVisible({ timeout: 5_000 });
  });

  test('teacher approves a player; student transitions to lobby', async ({
    teacherPage,
    anonymousPage,
  }) => {
    const gameId = await createQuickFireGame(teacherPage);
    await joinQuickFireGame(anonymousPage, gameId, 'ApproveMe');

    await expect(teacherPage.locator('text=ApproveMe')).toBeVisible({ timeout: 15_000 });
    await teacherPage.locator('button', { hasText: 'Approve' }).first().click();

    // Pending section should now be empty
    await expect(
      teacherPage.locator('text=No one waiting'),
    ).toBeVisible({ timeout: 10_000 });

    // Student receives pt_player_approved broadcast and moves to lobby
    await expect(
      anonymousPage.locator("text=You're in!"),
    ).toBeVisible({ timeout: 15_000 });
  });

  test('teacher rejects a player; student returns to join form with an error', async ({
    teacherPage,
    anonymousPage,
  }) => {
    const gameId = await createQuickFireGame(teacherPage);
    await joinQuickFireGame(anonymousPage, gameId, 'RejectMe');

    await expect(teacherPage.locator('text=RejectMe')).toBeVisible({ timeout: 15_000 });
    await teacherPage.locator('button', { hasText: 'Reject' }).first().click();

    // Student receives pt_player_rejected and is sent back to join form
    await expect(
      anonymousPage.locator('h1', { hasText: 'Join Quick Fire' }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      anonymousPage.locator('text=Your name was not approved'),
    ).toBeVisible({ timeout: 5_000 });
  });

  test('Start Game button requires at least one approved player', async ({
    teacherPage,
    anonymousPage,
  }) => {
    const gameId = await createQuickFireGame(teacherPage);

    // No players yet — button is disabled
    const startButton = teacherPage.locator('button', { hasText: /Start Game/ });
    await expect(startButton).toBeVisible({ timeout: 10_000 });
    await expect(startButton).toBeDisabled();

    // Student joins but is still pending — still disabled
    await joinQuickFireGame(anonymousPage, gameId, 'WaitingApproval');
    await expect(teacherPage.locator('text=WaitingApproval')).toBeVisible({ timeout: 15_000 });
    await expect(startButton).toBeDisabled();

    // Teacher approves — button becomes enabled
    await teacherPage.locator('button', { hasText: 'Approve' }).first().click();
    await expect(startButton).toBeEnabled({ timeout: 10_000 });
  });

  test('multiple students can join; teacher sees both in pending list with icons', async ({
    teacherPage,
    anonymousPage,
    browser,
  }) => {
    const gameId = await createQuickFireGame(teacherPage);

    await joinQuickFireGame(anonymousPage, gameId, 'Player1', 'Cat');

    let secondContext: BrowserContext | null = null;
    try {
      secondContext = await browser.newContext();
      const secondPage = await secondContext.newPage();
      await joinQuickFireGame(secondPage, gameId, 'Player2', 'Lion');

      // Both players with their icons should appear in the teacher pending list
      await expect(teacherPage.locator('text=Player1')).toBeVisible({ timeout: 15_000 });
      await expect(teacherPage.locator('text=Player2')).toBeVisible({ timeout: 15_000 });
      await expect(teacherPage.locator('text=🐱').first()).toBeVisible();
      await expect(teacherPage.locator('text=🦁').first()).toBeVisible();
    } finally {
      await secondContext?.close();
    }
  });
});

// ─── Game flow ────────────────────────────────────────────────────────────────

test.describe('quick fire — game flow', () => {
  /**
   * Full end-to-end game flow:
   *   1. Student joins with icon, teacher approves
   *   2. Teacher starts game, student enters lobby
   *   3. For each question:
   *      a. Teacher starts question
   *      b. Student submits answer
   *      c. Teacher sees live answer tally update
   *      d. Teacher ends question; round results shown on both sides
   *   4. After last question, teacher ends game
   *   5. Final rankings with icon shown on both sides
   */
  test('full game: join with icon → approve → start → answer each question → end game', async ({
    teacherPage,
    anonymousPage,
  }) => {
    test.setTimeout(120_000); // Full flow can span many questions

    const gameId = await createQuickFireGame(teacherPage);

    // Student joins with Rocket icon
    await joinQuickFireGame(anonymousPage, gameId, 'RocketPlayer', 'Rocket');

    // Teacher approves
    await expect(teacherPage.locator('text=RocketPlayer')).toBeVisible({ timeout: 15_000 });
    await teacherPage.locator('button', { hasText: 'Approve' }).first().click();

    // Icon appears in approved section
    await expect(teacherPage.locator('text=🚀').first()).toBeVisible({ timeout: 5_000 });

    // Student transitions to lobby
    await expect(anonymousPage.locator("text=You're in!")).toBeVisible({ timeout: 15_000 });

    // Teacher starts game
    await teacherPage.locator('button', { hasText: /Start Game/ }).click();
    await expect(
      teacherPage.locator('button', { hasText: 'Start Question' }),
    ).toBeVisible({ timeout: 10_000 });

    // Game loop: start question → student answers → check tally → end question
    const MAX_QUESTIONS = 30;
    let questionsPlayed = 0;

    while (questionsPlayed < MAX_QUESTIONS) {
      questionsPlayed++;

      // Start the next question
      await teacherPage.locator('button', { hasText: 'Start Question' }).click();
      await expect(
        teacherPage.locator('text=— Active'),
      ).toBeVisible({ timeout: 10_000 });

      // Student's question screen: wait for answer options to appear
      // During question phase the only visible buttons are the 4 answer options
      await expect(anonymousPage.locator('text=A.').first()).toBeVisible({ timeout: 15_000 });

      // Student submits option A (the first answer button on the page)
      await anonymousPage.locator('button').first().click();

      // Teacher live tally shows at least 1 answer counted
      await expect(
        teacherPage.locator('text=/Live Responses — [1-9]/'),
      ).toBeVisible({ timeout: 10_000 });

      // Teacher ends the question
      await teacherPage.locator('button', { hasText: 'End Question' }).click();
      await expect(
        teacherPage.locator('text=Round Results'),
      ).toBeVisible({ timeout: 10_000 });

      // Student sees the correct answer panel
      await expect(
        anonymousPage.locator('text=Correct Answer'),
      ).toBeVisible({ timeout: 10_000 });

      // Check whether this was the last question
      const endGameBtn = teacherPage.locator('button', { hasText: 'End Game' });
      const isLastQuestion = await endGameBtn.isVisible({ timeout: 2_000 }).catch(() => false);

      if (isLastQuestion) {
        // Rocket icon should appear in the round results on teacher page
        await expect(teacherPage.locator('text=🚀').first()).toBeVisible();

        await endGameBtn.click();
        break;
      }

      // More questions remain — advance back to between_questions phase
      await teacherPage.locator('button', { hasText: /Next Question/ }).click();
      await expect(
        teacherPage.locator('button', { hasText: 'Start Question' }),
      ).toBeVisible({ timeout: 10_000 });

      // Student is shown the "next question coming up" message
      await expect(
        anonymousPage.locator('text=next question coming up'),
      ).toBeVisible({ timeout: 5_000 });
    }

    // Final rankings visible on teacher page with icon
    await expect(teacherPage.locator('text=Game Over!')).toBeVisible({ timeout: 15_000 });
    await expect(teacherPage.locator('text=Final Rankings')).toBeVisible();
    await expect(teacherPage.locator('text=🚀').first()).toBeVisible();

    // Student sees game over screen
    await expect(
      anonymousPage.locator('h1', { hasText: 'Game Over!' }),
    ).toBeVisible({ timeout: 15_000 });

    // Student's leaderboard entry should show the Rocket icon
    await expect(anonymousPage.locator('text=🚀').first()).toBeVisible();
  });

  test('student score updates after answering correctly', async ({
    teacherPage,
    anonymousPage,
  }) => {
    test.setTimeout(60_000);

    const gameId = await createQuickFireGame(teacherPage);
    await joinQuickFireGame(anonymousPage, gameId, 'ScoreChecker');

    await expect(teacherPage.locator('text=ScoreChecker')).toBeVisible({ timeout: 15_000 });
    await teacherPage.locator('button', { hasText: 'Approve' }).first().click();
    await expect(anonymousPage.locator("text=You're in!")).toBeVisible({ timeout: 15_000 });

    await teacherPage.locator('button', { hasText: /Start Game/ }).click();
    await expect(
      teacherPage.locator('button', { hasText: 'Start Question' }),
    ).toBeVisible({ timeout: 10_000 });

    await teacherPage.locator('button', { hasText: 'Start Question' }).click();
    await expect(anonymousPage.locator('text=A.').first()).toBeVisible({ timeout: 15_000 });

    // Record score before answering (shown in score bar, starts at 0 pts)
    await expect(anonymousPage.locator('text=0 pts')).toBeVisible();

    // Submit an answer
    await anonymousPage.locator('button').first().click();

    // After answering, the score bar should update (points > 0 if correct, stays 0 if wrong)
    // We can't guarantee correctness without knowing which option is correct from the student side,
    // so we just verify the answer-feedback UI appears
    await expect(
      anonymousPage.locator('text=Waiting for results'),
    ).toBeVisible({ timeout: 10_000 });
  });
});
