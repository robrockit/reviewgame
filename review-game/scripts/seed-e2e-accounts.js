#!/usr/bin/env node
/**
 * Seed E2E Test Accounts in Staging Supabase
 *
 * Creates two test accounts required for Playwright E2E tests:
 *   1. Premium teacher  — PREMIUM tier, ACTIVE status
 *   2. Free-tier teacher — FREE tier, ACTIVE status
 *
 * Reads Supabase connection details from .env.staging.
 * Reads account credentials from .env.test (if present) or environment variables.
 *
 * Usage:
 *   node scripts/seed-e2e-accounts.js
 *
 * Idempotent: safe to run multiple times. Existing accounts are updated, not duplicated.
 */

/* eslint-disable @typescript-eslint/no-require-imports -- Node.js script using CommonJS */
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
/* eslint-enable @typescript-eslint/no-require-imports */

// ─── Env file parser ──────────────────────────────────────────────────────────

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const lines = fs.readFileSync(filePath, 'utf8').split('\n');
  const result = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
    result[key] = value;
  }
  return result;
}

const root = path.join(__dirname, '..');
const stagingEnv = parseEnvFile(path.join(root, '.env.staging'));
const testEnv    = parseEnvFile(path.join(root, '.env.test'));

// Merge: process.env > .env.test > .env.staging
const env = { ...stagingEnv, ...testEnv, ...process.env };

// ─── Validate required vars ───────────────────────────────────────────────────

const SUPABASE_URL        = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY    = env.SUPABASE_SERVICE_ROLE_KEY;
const TEACHER_EMAIL         = env.E2E_TEACHER_EMAIL;
const TEACHER_PASSWORD      = env.E2E_TEACHER_PASSWORD;
const FREE_TEACHER_EMAIL    = env.E2E_FREE_TEACHER_EMAIL;
const FREE_TEACHER_PASSWORD = env.E2E_FREE_TEACHER_PASSWORD;
const SIGNOUT_EMAIL         = env.E2E_SIGNOUT_EMAIL;
const SIGNOUT_PASSWORD      = env.E2E_SIGNOUT_PASSWORD;

const missing = [
  ['NEXT_PUBLIC_SUPABASE_URL (from .env.staging)',   SUPABASE_URL],
  ['SUPABASE_SERVICE_ROLE_KEY (from .env.staging)',  SERVICE_ROLE_KEY],
  ['E2E_TEACHER_EMAIL (from .env.test)',             TEACHER_EMAIL],
  ['E2E_TEACHER_PASSWORD (from .env.test)',          TEACHER_PASSWORD],
  ['E2E_FREE_TEACHER_EMAIL (from .env.test)',        FREE_TEACHER_EMAIL],
  ['E2E_FREE_TEACHER_PASSWORD (from .env.test)',     FREE_TEACHER_PASSWORD],
  ['E2E_SIGNOUT_EMAIL (from .env.test)',             SIGNOUT_EMAIL],
  ['E2E_SIGNOUT_PASSWORD (from .env.test)',          SIGNOUT_PASSWORD],
].filter(([, v]) => !v).map(([k]) => k);

if (missing.length > 0) {
  console.error('\nMissing required environment variables:');
  missing.forEach(k => console.error(`  • ${k}`));
  console.error('\nMake sure .env.staging exists and .env.test is populated from .env.test.example\n');
  process.exit(1);
}

// ─── Supabase admin client ───────────────────────────────────────────────────

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ─── Account definitions ─────────────────────────────────────────────────────

const accounts = [
  {
    label:              'Premium teacher',
    email:              TEACHER_EMAIL,
    password:           TEACHER_PASSWORD,
    subscription_tier:   'premium',
    subscription_status: 'ACTIVE',
  },
  {
    label:              'Free-tier teacher',
    email:              FREE_TEACHER_EMAIL,
    password:           FREE_TEACHER_PASSWORD,
    subscription_tier:   'free',
    subscription_status: 'INACTIVE',
  },
  {
    // Dedicated account for the sign-out E2E test. This account's session is
    // intentionally revoked during the test (global signOut). Using a throwaway
    // account keeps the premium and free-tier storageState files unaffected.
    label:              'Sign-out test account',
    email:              SIGNOUT_EMAIL,
    password:           SIGNOUT_PASSWORD,
    subscription_tier:   'free',
    subscription_status: 'INACTIVE',
  },
];

// ─── Main ─────────────────────────────────────────────────────────────────────

async function upsertAccount({ label, email, password, subscription_tier, subscription_status }) {
  console.log(`\n[${label}] ${email}`);

  // Query the profiles table directly by email to avoid fetching all users via listUsers()
  const { data: profile, error: profileLookupError } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  if (profileLookupError) throw profileLookupError;

  let userId;

  if (profile) {
    console.log(`  ↳ User exists (${profile.id}) — updating password`);
    const { error } = await supabase.auth.admin.updateUserById(profile.id, { password });
    if (error) throw error;
    userId = profile.id;
  } else {
    console.log('  ↳ Creating new user...');
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Skip email confirmation for test accounts
    });
    if (error) throw error;
    userId = data.user.id;
    console.log(`  ↳ Created (${userId})`);

    // Small delay to allow the profile trigger to fire
    await new Promise(r => setTimeout(r, 500));
  }

  // Update the profile with the correct subscription tier and status
  const { error: profileError } = await supabase
    .from('profiles')
    .update({
      subscription_tier,
      subscription_status,
      is_active: true,
    })
    .eq('id', userId);

  if (profileError) throw profileError;
  console.log(`  ↳ Profile set: tier=${subscription_tier}, status=${subscription_status}`);
}

async function main() {
  console.log(`\nSeeding E2E test accounts in: ${SUPABASE_URL}`);
  console.log('─'.repeat(60));

  for (const account of accounts) {
    await upsertAccount(account);
  }

  console.log('\n✓ Done. Both accounts are ready for E2E testing.\n');
}

main().catch(err => {
  console.error('\n✗ Seed failed:', err.message || err);
  process.exit(1);
});
