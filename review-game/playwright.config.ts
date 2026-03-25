import { defineConfig, devices } from '@playwright/test';
import path from 'path';
import dotenv from 'dotenv';

// Load E2E credentials from .env.test (gitignored) before Playwright runs global setup
dotenv.config({ path: path.join(__dirname, '.env.test') });

/**
 * E2E test configuration for the Review Game app.
 * Targets the staging Supabase environment (kvygljdyzdhltngqvrii).
 *
 * Required environment variables (set in .env.test, which is gitignored):
 *   E2E_BASE_URL              - Base URL of the app under test
 *   E2E_TEACHER_EMAIL         - Teacher account email
 *   E2E_TEACHER_PASSWORD      - Teacher account password
 *   E2E_STUDENT_EMAIL         - Student account email (optional, for multi-user tests)
 *   E2E_STUDENT_PASSWORD      - Student account password (optional)
 */

export const STORAGE_STATE_TEACHER = path.join(__dirname, 'e2e/.auth/teacher.json');
export const STORAGE_STATE_FREE_TEACHER = path.join(__dirname, 'e2e/.auth/free-teacher.json');

export default defineConfig({
  testDir: './e2e',

  // Global setup: authenticates users once and saves session files
  globalSetup: './e2e/global.setup.ts',

  timeout: 30_000,
  expect: { timeout: 5_000 },

  // Retry failed tests in CI for transient network flakiness
  retries: process.env.CI ? 2 : 0,

  // Run tests in parallel in CI; sequential locally for easier debugging
  workers: process.env.CI ? 2 : 1,

  reporter: [
    ['list'],
    ['html', { open: 'never' }],
  ],

  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',

    // Capture trace on first retry so CI failures are debuggable
    trace: 'on-first-retry',

    // Screenshot on failure
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
