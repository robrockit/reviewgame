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
 */

/* eslint-disable @typescript-eslint/no-require-imports -- Node.js script using CommonJS */
const fs = require('fs');
const path = require('path');
/* eslint-enable @typescript-eslint/no-require-imports */

const ENV_FILES = {
  dev: '.env.local.backup',
  staging: '.env.staging',
};

const ACTIVE_ENV_FILE = '.env.local';

function getCurrentEnv() {
  const rootDir = path.resolve(__dirname, '..');
  const envLocalPath = path.join(rootDir, ACTIVE_ENV_FILE);

  if (!fs.existsSync(envLocalPath)) {
    return 'none';
  }

  // Read first few lines to check for environment marker
  const content = fs.readFileSync(envLocalPath, 'utf8');
  const lines = content.split('\n').slice(0, 10);

  // Check for explicit environment marker (more reliable than URL inspection)
  const envMarker = lines.find(line => line.startsWith('# ENVIRONMENT='));
  if (envMarker) {
    const env = envMarker.split('=')[1]?.trim();
    if (env === 'development' || env === 'dev') return 'dev';
    if (env === 'staging') return 'staging';
  }

  // Fallback: Check for Supabase URL to determine environment
  const supabaseUrlLine = lines.find(line => line.startsWith('NEXT_PUBLIC_SUPABASE_URL='));
  if (supabaseUrlLine) {
    const url = supabaseUrlLine.split('=').slice(1).join('=').trim();
    if (url.includes('staging')) {
      return 'staging';
    } else if (url.includes('localhost') || url.includes('127.0.0.1') || url.startsWith('http://')) {
      return 'dev';
    }
    // URL is present but doesn't match known patterns — don't assume dev
    return 'unknown';
  }

  return 'unknown';
}

function showStatus() {
  const current = getCurrentEnv();
  console.log('\n📊 Environment Status\n');
  console.log(`Current: ${current === 'dev' ? '🟢 Development' : current === 'staging' ? '🟡 Staging' : '❓ Unknown'}`);
  console.log('\nAvailable environments:');
  console.log('  • dev      - Development environment (.env.local.backup)');
  console.log('  • staging  - Staging environment (.env.staging)');
  console.log('\nSwitch with:');
  console.log('  npm run env:dev');
  console.log('  npm run env:staging\n');
}

function switchEnvironment(env) {
  const sourceFile = ENV_FILES[env];

  if (!sourceFile) {
    console.error(`\n❌ Unknown environment: ${env}`);
    console.log('\nAvailable: dev, staging\n');
    process.exit(1);
  }

  // Use __dirname for robust path resolution regardless of where script is run from
  const rootDir = path.resolve(__dirname, '..');
  const sourcePath = path.join(rootDir, sourceFile);
  const targetPath = path.join(rootDir, ACTIVE_ENV_FILE);

  if (!fs.existsSync(sourcePath)) {
    console.error(`\n❌ Source file not found: ${sourceFile}`);
    console.log(`\nPlease create ${sourceFile} with your ${env} environment variables.\n`);
    process.exit(1);
  }

  try {
    // Backup current .env.local if it exists (always backup to prevent data loss)
    if (fs.existsSync(targetPath)) {
      const currentEnv = getCurrentEnv();
      const backupPath = path.join(rootDir, `.env.local.${currentEnv}.backup`);

      // Only create backup if one doesn't already exist for this environment
      if (!fs.existsSync(backupPath)) {
        fs.copyFileSync(targetPath, backupPath);
        console.log(`✅ Backed up current ${currentEnv} environment to .env.local.${currentEnv}.backup`);
      }
    }

    // Copy the selected environment file to .env.local
    fs.copyFileSync(sourcePath, targetPath);

    console.log(`\n✅ Switched to ${env === 'dev' ? '🟢 Development' : '🟡 Staging'} environment`);
    console.log(`\nActive file: ${ACTIVE_ENV_FILE}`);
    console.log(`Source: ${sourceFile}\n`);
    console.log('⚠️  Restart your dev server for changes to take effect.\n');
  } catch (error) {
    console.error(`\n❌ Error switching environment: ${error?.message || String(error)}\n`);
    process.exit(1);
  }
}

// Main
const command = process.argv[2];

if (!command) {
  showStatus();
  process.exit(0);
}

switch (command) {
  case 'status':
    showStatus();
    break;
  case 'dev':
  case 'staging':
    switchEnvironment(command);
    break;
  default:
    console.error(`\n❌ Unknown command: ${command}`);
    console.log('\nUsage:');
    console.log('  npm run env:dev      - Switch to development');
    console.log('  npm run env:staging  - Switch to staging');
    console.log('  npm run env:status   - Show current environment\n');
    process.exit(1);
}
