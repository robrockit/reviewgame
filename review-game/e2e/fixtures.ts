/**
 * @fileoverview Shared Playwright fixtures for Review Game E2E tests.
 *
 * Provides pre-authenticated browser contexts so individual test files don't
 * need to handle login boilerplate. Import `test` and `expect` from this file
 * instead of '@playwright/test' in all E2E specs.
 *
 * Accounts required (set in .env.test):
 *   - Premium teacher  (E2E_TEACHER_EMAIL / E2E_TEACHER_PASSWORD)
 *   - Free-tier teacher (E2E_FREE_TEACHER_EMAIL / E2E_FREE_TEACHER_PASSWORD)
 *
 * Students join games anonymously via device_id — no auth account needed.
 *
 * Usage:
 * ```ts
 * import { test, expect } from '../fixtures';
 *
 * test('teacher can see the board', async ({ teacherPage }) => {
 *   await teacherPage.goto('/dashboard');
 * });
 *
 * test('student join flow', async ({ teacherPage, anonymousPage }) => {
 *   // teacherPage creates the game; anonymousPage joins as a student
 * });
 * ```
 */

import { test as base, expect, type Page, type BrowserContext } from '@playwright/test';
import { STORAGE_STATE_TEACHER, STORAGE_STATE_FREE_TEACHER } from '../playwright.config';

interface ReviewGameFixtures {
  /** Authenticated browser context for the premium teacher account */
  teacherContext: BrowserContext;
  /** Page authenticated as the premium teacher */
  teacherPage: Page;
  /** Authenticated browser context for the free-tier teacher account */
  freeTeacherContext: BrowserContext;
  /** Page authenticated as the free-tier teacher */
  freeTeacherPage: Page;
  /** Unauthenticated browser context — used for student join flows */
  anonymousContext: BrowserContext;
  /** Unauthenticated page — navigates to join URLs without any session */
  anonymousPage: Page;
}

export const test = base.extend<ReviewGameFixtures>({
  teacherContext: async ({ browser }, use) => {
    const context = await browser.newContext({ storageState: STORAGE_STATE_TEACHER });
    await use(context);
    await context.close();
  },

  teacherPage: async ({ teacherContext }, use) => {
    const page = await teacherContext.newPage();
    await use(page);
    await page.close();
  },

  freeTeacherContext: async ({ browser }, use) => {
    const context = await browser.newContext({ storageState: STORAGE_STATE_FREE_TEACHER });
    await use(context);
    await context.close();
  },

  freeTeacherPage: async ({ freeTeacherContext }, use) => {
    const page = await freeTeacherContext.newPage();
    await use(page);
    await page.close();
  },

  anonymousContext: async ({ browser }, use) => {
    // Fresh context with no session — simulates a student device
    const context = await browser.newContext();
    await use(context);
    await context.close();
  },

  anonymousPage: async ({ anonymousContext }, use) => {
    const page = await anonymousContext.newPage();
    await use(page);
    await page.close();
  },
});

export { expect };
