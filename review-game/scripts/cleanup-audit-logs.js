#!/usr/bin/env node

/**
 * @fileoverview Script to cleanup audit logs older than 7 years
 *
 * This script calls the Supabase cleanup_old_audit_logs() function
 * to maintain compliance with the 7-year retention policy.
 *
 * Usage:
 *   node scripts/cleanup-audit-logs.js
 *
 * Environment Variables:
 *   SUPABASE_URL - Your Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY - Service role key (has admin permissions)
 *
 * @module scripts/cleanup-audit-logs
 */

/**
 * Note: This script uses CommonJS (require) instead of ESM (import)
 * to avoid build/bundling issues when run directly by GitHub Actions.
 * This is intentional - the script needs to execute as a standalone
 * Node.js script without TypeScript compilation.
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createClient } = require('@supabase/supabase-js');

// Validate environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Error: Missing required environment variables');
  console.error('   Required: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// Create Supabase client with service role key (bypasses RLS)
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

/**
 * Main execution function
 */
async function main() {
  console.log('🧹 Starting audit log cleanup...');
  console.log(`⏰ Timestamp: ${new Date().toISOString()}`);

  try {
    // Call the cleanup function via RPC
    const { data, error } = await supabase.rpc('cleanup_old_audit_logs');

    if (error) {
      console.error('❌ Cleanup failed:', error);
      throw error;
    }

    const deletedCount = data || 0;

    console.log(`✅ Cleanup completed successfully`);
    console.log(`📊 Records deleted: ${deletedCount}`);

    if (deletedCount === 0) {
      console.log('ℹ️  No records older than 7 years found');
    } else {
      console.log(`🗑️  Deleted ${deletedCount} audit log entries older than 7 years`);
    }

    // Exit with success
    process.exit(0);
  } catch (error) {
    console.error('❌ Fatal error during cleanup:', error);

    // Log additional details for debugging
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }

    // Exit with failure
    process.exit(1);
  }
}

// Run the script
main();
