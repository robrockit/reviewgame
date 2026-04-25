/**
 * @fileoverview E2E tests for the Question Banks dashboard page.
 *
 * Covers:
 *   - Feature gating: free-tier teachers see the upgrade banner and cannot
 *     create or duplicate banks.
 *   - Duplicate flow: premium teachers can duplicate a bank and see the new
 *     "Copy of …" entry appear in the list.
 *
 * Prerequisites:
 *   - At least one public question bank must exist in the staging Supabase
 *     project so the premium teacher has a card to interact with.
 *   - The premium teacher account must have subscription_tier='PREMIUM' or
 *     'BASIC' and subscription_status='ACTIVE'.
 *   - The free-tier teacher account must have subscription_tier='FREE'.
 *   - Both accounts must exist in the staging project (run
 *     `npm run test:e2e:seed` to create them).
 *
 * Note on staging state: the duplicate test creates a "Copy of …" bank on
 * each run. This is intentional — the staging environment is periodically
 * reset and tests do not perform teardown (matching the pattern of the
 * existing game-creation spec).
 */

import { test, expect } from './fixtures';

// ─── Feature gating ───────────────────────────────────────────────────────────

test.describe('question banks — feature gating', () => {
  test('free-tier teacher: upgrade banner is visible', async ({ freeTeacherPage: page }) => {
    await page.goto('/dashboard/question-banks');

    // The yellow upgrade banner renders whenever canCreate is false (FREE tier),
    // regardless of how many banks the teacher has visible.
    const banner = page.locator('div.bg-yellow-50');
    await expect(banner).toBeVisible({ timeout: 10_000 });
  });

  test('free-tier teacher: "Create Question Bank" button is disabled', async ({
    freeTeacherPage: page,
  }) => {
    await page.goto('/dashboard/question-banks');

    const createButton = page.getByRole('button', { name: /create question bank/i });
    await expect(createButton).toBeVisible({ timeout: 10_000 });
    await expect(createButton).toBeDisabled();
  });

  test('premium teacher: upgrade banner is not shown', async ({ teacherPage: page }) => {
    await page.goto('/dashboard/question-banks');

    // Wait for the page to finish loading profile data before asserting absence.
    // Using the Create button as the load signal — it only renders once profile
    // data has resolved.
    const createButton = page.getByRole('button', { name: /create question bank/i });
    await expect(createButton).toBeVisible({ timeout: 10_000 });

    await expect(page.locator('div.bg-yellow-50')).not.toBeVisible();
  });

  test('premium teacher: "Create Question Bank" button is enabled', async ({
    teacherPage: page,
  }) => {
    await page.goto('/dashboard/question-banks');

    const createButton = page.getByRole('button', { name: /create question bank/i });
    await expect(createButton).toBeEnabled({ timeout: 10_000 });
  });
});

// ─── Duplicate flow ───────────────────────────────────────────────────────────

test.describe('question banks — duplicate', () => {
  test('premium teacher: duplicating a bank shows success toast and adds the copy', async ({
    teacherPage: page,
  }) => {
    await page.goto('/dashboard/question-banks');

    // Wait for the first bank card menu button to appear (confirms banks have loaded).
    const firstMenuButton = page.getByRole('button', { name: 'Open options' }).first();
    await expect(firstMenuButton).toBeVisible({ timeout: 10_000 });

    // Capture the title of the bank we are about to duplicate so we can assert
    // on "Copy of <title>" appearing afterwards.
    const firstBankTitle = await page
      .locator('a.text-lg.font-semibold')
      .first()
      .textContent();

    // Open the dropdown menu for the first bank card.
    await firstMenuButton.click();

    // Click "Duplicate" in the dropdown.
    await page.getByRole('button', { name: 'Duplicate' }).click();

    // The RPC call is async — wait up to 15 s for the success toast.
    await expect(
      page.getByText('Question bank duplicated successfully')
    ).toBeVisible({ timeout: 15_000 });

    // The new bank should be added to the list in the same page session
    // (the hook optimistically updates local state).
    await expect(
      page.getByText(`Copy of ${firstBankTitle}`)
    ).toBeVisible({ timeout: 5_000 });
  });
});
