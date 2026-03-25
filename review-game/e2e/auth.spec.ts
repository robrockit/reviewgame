/**
 * @fileoverview E2E tests for authentication flows.
 *
 * Covers login, logout, error states, and redirect behaviour.
 * Uses fresh browser contexts (not pre-authenticated fixtures) so the login
 * flow itself is exercised rather than bypassed via stored session state.
 */

import { test, expect } from './fixtures';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Fill and submit the login form. */
async function login(
  page: import('@playwright/test').Page,
  email: string,
  password: string
) {
  await page.fill('#email', email);
  await page.fill('#password', password);
  await page.click('button[type="submit"]');
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test.describe('authentication', () => {
  test('valid credentials redirect to dashboard', async ({ anonymousPage: page }) => {
    await page.goto('/login');

    await login(page, process.env.E2E_TEACHER_EMAIL!, process.env.E2E_TEACHER_PASSWORD!);

    await page.waitForURL('**/dashboard**', { timeout: 15_000 });
    expect(page.url()).toContain('/dashboard');
  });

  test('invalid credentials show an error message', async ({ anonymousPage: page }) => {
    await page.goto('/login');

    await login(page, 'notauser@example.com', 'wrongpassword123');

    // Wait for the error paragraph to appear (no navigation occurs)
    const error = page.locator('p.text-red-500');
    await expect(error).toBeVisible({ timeout: 10_000 });
    await expect(error).not.toBeEmpty();

    // Should still be on the login page
    expect(page.url()).toContain('/login');
  });

  test('loading state disables the form during submission', async ({ anonymousPage: page }) => {
    await page.goto('/login');

    await page.fill('#email', process.env.E2E_TEACHER_EMAIL!);
    await page.fill('#password', process.env.E2E_TEACHER_PASSWORD!);

    // Click submit and immediately check for the loading state
    const submitButton = page.locator('button[type="submit"]');
    await submitButton.click();

    // Button text changes to 'Logging in...' while in-flight
    await expect(submitButton).toHaveText('Logging in...', { timeout: 3_000 });
  });

  test('sign out redirects away from dashboard', async ({ anonymousPage: page }) => {
    // Log in with a fresh context so sign-out doesn't revoke the shared
    // storageState used by teacherPage in all other tests.
    await page.goto('/login');
    await login(page, process.env.E2E_TEACHER_EMAIL!, process.env.E2E_TEACHER_PASSWORD!);
    await page.waitForURL('**/dashboard**', { timeout: 15_000 });

    // The dashboard has a direct "Sign Out" button (no dropdown)
    await page.getByRole('button', { name: 'Sign Out' }).click();

    // handleSignOut calls router.push('/') — the marketing homepage
    await page.waitForURL('**/', { timeout: 10_000 });
    expect(page.url()).not.toContain('/dashboard');
  });

  test('login page shows signup link', async ({ anonymousPage: page }) => {
    await page.goto('/login');

    const signupLink = page.getByRole('link', { name: 'Sign up' });
    await expect(signupLink).toBeVisible();
    await expect(signupLink).toHaveAttribute('href', '/signup');
  });

  test('login with redirectTo param honours the redirect', async ({ anonymousPage: page }) => {
    await page.goto('/login?redirectTo=/dashboard/games/new');

    await login(page, process.env.E2E_TEACHER_EMAIL!, process.env.E2E_TEACHER_PASSWORD!);

    await page.waitForURL('**/dashboard/games/new**', { timeout: 15_000 });
    expect(page.url()).toContain('/dashboard/games/new');
  });
});
