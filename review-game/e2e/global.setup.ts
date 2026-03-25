/**
 * @fileoverview Global Playwright setup — runs once before all E2E tests.
 *
 * Authenticates the premium teacher and free-tier teacher accounts and saves
 * browser storage state to JSON files. Tests load these files instead of
 * logging in on every run, keeping individual tests fast while exercising
 * real auth on each CI run.
 */

import { chromium, FullConfig } from '@playwright/test';
import { STORAGE_STATE_TEACHER, STORAGE_STATE_FREE_TEACHER } from '../playwright.config';
import path from 'path';
import fs from 'fs';

async function loginAndSave(
  baseURL: string,
  email: string,
  password: string,
  storageStatePath: string
): Promise<void> {
  fs.mkdirSync(path.dirname(storageStatePath), { recursive: true });

  const browser = await chromium.launch();
  try {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(`${baseURL}/login`);
    await page.fill('#email', email);
    await page.fill('#password', password);
    await page.click('button[type="submit"]');

    // Wait for redirect to dashboard — if credentials are wrong this times out with a
    // cryptic message, so assert the URL explicitly to surface auth failures clearly.
    await page.waitForURL('**/dashboard**', { timeout: 15_000 });
    if (!page.url().includes('/dashboard')) {
      throw new Error(
        `Login failed for ${email}: expected redirect to /dashboard but landed on ${page.url()}.\n` +
        'Check that the account exists and the password is correct in .env.test.'
      );
    }

    await context.storageState({ path: storageStatePath });
  } finally {
    // Always close the browser even if waitForURL or storageState throws,
    // so we don't leak Chromium processes on auth failures or CI retries.
    await browser.close();
  }
}

export default async function globalSetup(config: FullConfig): Promise<void> {
  const baseURL = config.projects[0].use.baseURL;
  if (!baseURL) {
    throw new Error(
      'E2E_BASE_URL is not set.\n' +
      'Add it to .env.test: E2E_BASE_URL=http://localhost:3000 for local runs\n' +
      'or E2E_BASE_URL=https://your-staging-url for CI.'
    );
  }

  // Premium teacher account — required
  const teacherEmail = process.env.E2E_TEACHER_EMAIL;
  const teacherPassword = process.env.E2E_TEACHER_PASSWORD;

  if (!teacherEmail || !teacherPassword) {
    throw new Error(
      'E2E_TEACHER_EMAIL and E2E_TEACHER_PASSWORD must be set.\n' +
      'Copy .env.test.example to .env.test and fill in credentials.'
    );
  }

  console.log(`[global setup] Authenticating premium teacher: ${teacherEmail}`);
  await loginAndSave(baseURL, teacherEmail, teacherPassword, STORAGE_STATE_TEACHER);
  console.log('[global setup] Premium teacher auth saved');

  // Free-tier teacher account — required for feature gating tests
  const freeTeacherEmail = process.env.E2E_FREE_TEACHER_EMAIL;
  const freeTeacherPassword = process.env.E2E_FREE_TEACHER_PASSWORD;

  if (!freeTeacherEmail || !freeTeacherPassword) {
    throw new Error(
      'E2E_FREE_TEACHER_EMAIL and E2E_FREE_TEACHER_PASSWORD must be set.\n' +
      'Copy .env.test.example to .env.test and fill in credentials.'
    );
  }

  console.log(`[global setup] Authenticating free-tier teacher: ${freeTeacherEmail}`);
  await loginAndSave(baseURL, freeTeacherEmail, freeTeacherPassword, STORAGE_STATE_FREE_TEACHER);
  console.log('[global setup] Free-tier teacher auth saved');
}
