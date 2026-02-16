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

const fs = require('fs');
const path = require('path');

const ENV_FILES = {
  dev: '.env.local.backup',
  staging: '.env.staging',
};

const ACTIVE_ENV_FILE = '.env.local';

function getCurrentEnv() {
  const envLocalPath = path.join(process.cwd(), ACTIVE_ENV_FILE);

  if (!fs.existsSync(envLocalPath)) {
    return 'none';
  }

  // Read first few lines to check for environment marker
  const content = fs.readFileSync(envLocalPath, 'utf8');
  const lines = content.split('\n').slice(0, 10);

  // Check for Supabase URL to determine environment
  const supabaseUrl = lines.find(line => line.startsWith('NEXT_PUBLIC_SUPABASE_URL='));

  if (supabaseUrl) {
    if (supabaseUrl.includes('staging')) {
      return 'staging';
    } else {
      return 'dev';
    }
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

  const sourcePath = path.join(process.cwd(), sourceFile);
  const targetPath = path.join(process.cwd(), ACTIVE_ENV_FILE);

  if (!fs.existsSync(sourcePath)) {
    console.error(`\n❌ Source file not found: ${sourceFile}`);
    console.log(`\nPlease create ${sourceFile} with your ${env} environment variables.\n`);
    process.exit(1);
  }

  try {
    // Backup current .env.local if it exists and isn't already a backup
    if (fs.existsSync(targetPath) && env !== 'dev') {
      const backupPath = path.join(process.cwd(), '.env.local.backup');
      if (!fs.existsSync(backupPath)) {
        fs.copyFileSync(targetPath, backupPath);
        console.log(`✅ Backed up current environment to .env.local.backup`);
      }
    }

    // Copy the selected environment file to .env.local
    fs.copyFileSync(sourcePath, targetPath);

    console.log(`\n✅ Switched to ${env === 'dev' ? '🟢 Development' : '🟡 Staging'} environment`);
    console.log(`\nActive file: ${ACTIVE_ENV_FILE}`);
    console.log(`Source: ${sourceFile}\n`);
    console.log('⚠️  Restart your dev server for changes to take effect.\n');
  } catch (error) {
    console.error(`\n❌ Error switching environment: ${error.message}\n`);
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
