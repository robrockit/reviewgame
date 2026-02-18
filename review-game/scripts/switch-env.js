#!/usr/bin/env node
/**
 * Environment Switcher Script
 *
 * Easily toggle between development and staging environments
 * by copying the appropriate .env file to .env.local
 *
 * Usage:
 *   npm run env:dev      - Switch to development environment
 *   npm run env:staging  - Switch to staging environment
 *   npm run env:status   - Check current environment
 *   npm run env:restore  - Restore a backed-up environment
 */

/* eslint-disable @typescript-eslint/no-require-imports -- Node.js script using CommonJS */
const fs = require('fs');
const path = require('path');
/* eslint-enable @typescript-eslint/no-require-imports */

const ENV_FILES = {
  dev: '.env.local.backup',
  staging: '.env.staging',
};

// Explicit allowlist — used to validate env names before path construction or backup
const KNOWN_ENVS = Object.keys(ENV_FILES);

const ACTIVE_ENV_FILE = '.env.local';

// rootDir is always relative to this script's location, not the working directory
const rootDir = path.resolve(__dirname, '..');

function getCurrentEnv() {
  const envLocalPath = path.join(rootDir, ACTIVE_ENV_FILE);

  if (!fs.existsSync(envLocalPath)) {
    return 'none';
  }

  // Read the full file — .env files are small and cheap to read entirely
  const content = fs.readFileSync(envLocalPath, 'utf8');
  const lines = content.split('\n');

  // Check for explicit environment marker (preferred — add as first line of each env file)
  const envMarker = lines.find(line => line.startsWith('# ENVIRONMENT='));
  if (envMarker) {
    const env = envMarker.split('=')[1]?.trim();
    if (env === 'development' || env === 'dev') return 'dev';
    if (env === 'staging') return 'staging';
  }

  // Fallback: inspect Supabase URL
  const supabaseUrlLine = lines.find(line => line.startsWith('NEXT_PUBLIC_SUPABASE_URL='));
  if (supabaseUrlLine) {
    const url = supabaseUrlLine.split('=').slice(1).join('=').trim();
    if (url.includes('staging')) return 'staging';
    if (url.includes('localhost') || url.includes('127.0.0.1') || url.startsWith('http://')) {
      return 'dev';
    }
  }

  return 'unknown';
}

function showStatus() {
  const current = getCurrentEnv();

  console.log('\n📊 Environment Status\n');

  if (current === 'none') {
    console.log('Current: ⚪ No .env.local found');
    console.log('\n  Run `npm run env:dev` to get started.');
  } else if (current === 'dev') {
    console.log('Current: 🟢 Development');
  } else if (current === 'staging') {
    console.log('Current: 🟡 Staging');
  } else {
    console.log('Current: ❓ Unknown (add "# ENVIRONMENT=dev" or "# ENVIRONMENT=staging" to .env.local)');
  }

  console.log('\nAvailable environments:');
  KNOWN_ENVS.forEach(env => {
    console.log(`  • ${env.padEnd(8)} - ${env === 'dev' ? 'Development' : 'Staging'} environment (${ENV_FILES[env]})`);
  });

  console.log('\nCommands:');
  console.log('  npm run env:dev      - Switch to development');
  console.log('  npm run env:staging  - Switch to staging');
  console.log('  npm run env:restore  - Restore a backed-up environment\n');
}

function switchEnvironment(env) {
  if (!KNOWN_ENVS.includes(env)) {
    console.error(`\n❌ Unknown environment: ${env}`);
    console.log(`\nAvailable: ${KNOWN_ENVS.join(', ')}\n`);
    process.exit(1);
  }

  const sourceFile = ENV_FILES[env];
  const sourcePath = path.join(rootDir, sourceFile);
  const targetPath = path.join(rootDir, ACTIVE_ENV_FILE);

  if (!fs.existsSync(sourcePath)) {
    console.error(`\n❌ Source file not found: ${sourceFile}`);
    console.log(`\nPlease create ${sourceFile} with your ${env} environment variables.\n`);
    process.exit(1);
  }

  try {
    // Only back up if .env.local exists and is a known environment (dev or staging).
    // Skipping backup for 'unknown'/'none' prevents writing misleading .env.local.unknown.backup
    // files that would then block future backups via the !existsSync guard.
    if (fs.existsSync(targetPath)) {
      const currentEnv = getCurrentEnv();
      if (KNOWN_ENVS.includes(currentEnv)) {
        const backupPath = path.join(rootDir, `.env.local.${currentEnv}.backup`);
        if (!fs.existsSync(backupPath)) {
          fs.copyFileSync(targetPath, backupPath);
          console.log(`✅ Backed up current ${currentEnv} environment to .env.local.${currentEnv}.backup`);
        }
      } else {
        console.log(`⚠️  Current environment is '${currentEnv}' — skipping backup (add # ENVIRONMENT= marker to enable)`);
      }
    }

    fs.copyFileSync(sourcePath, targetPath);

    const label = env === 'dev' ? '🟢 Development' : '🟡 Staging';
    console.log(`\n✅ Switched to ${label} environment`);
    console.log(`\nActive file: ${ACTIVE_ENV_FILE}`);
    console.log(`Source: ${sourceFile}\n`);
    console.log('⚠️  Restart your dev server for changes to take effect.\n');
  } catch (error) {
    console.error(`\n❌ Error switching environment: ${error?.message || String(error)}\n`);
    process.exit(1);
  }
}

function restoreEnvironment() {
  console.log('\n🔄 Restore Environment\n');

  const available = KNOWN_ENVS
    .map(env => ({ env, backupPath: path.join(rootDir, `.env.local.${env}.backup`) }))
    .filter(({ backupPath }) => fs.existsSync(backupPath));

  if (available.length === 0) {
    console.log('❌ No backup files found.');
    console.log('\nExpected one of:');
    KNOWN_ENVS.forEach(env => console.log(`  .env.local.${env}.backup`));
    process.exit(1);
  }

  if (available.length === 1) {
    // Only one backup — restore it automatically
    const { env } = available[0];
    switchEnvironment(env);
    return;
  }

  // Multiple backups — list them so the user can choose
  console.log('Multiple backups found. Run the appropriate command to restore:\n');
  available.forEach(({ env }) => {
    console.log(`  npm run env:${env}   (restores from .env.local.${env}.backup)`);
  });
  console.log('');
}

// Main
const command = process.argv[2];

if (!command) {
  showStatus();
  process.exit(0);
}

// Derive valid env commands from ENV_FILES so the switch never goes stale
if (command === 'status') {
  showStatus();
} else if (command === 'restore') {
  restoreEnvironment();
} else if (KNOWN_ENVS.includes(command)) {
  switchEnvironment(command);
} else {
  console.error(`\n❌ Unknown command: ${command}`);
  console.log('\nUsage:');
  console.log('  npm run env:dev      - Switch to development');
  console.log('  npm run env:staging  - Switch to staging');
  console.log('  npm run env:status   - Show current environment');
  console.log('  npm run env:restore  - Restore a backed-up environment\n');
  process.exit(1);
}
