-- Migration: Restore Restrictive RLS Policy for Profiles
-- Purpose: Secure profiles table with proper RLS now that admin ops use service role
-- Created: 2025-11-19
-- Issue: RLS policies were causing circular dependencies for admin checks
-- Solution: Use service role key for admin operations, restore restrictive RLS

-- ==============================================================================
-- RESTORE RESTRICTIVE RLS POLICY
-- ==============================================================================

-- Enable RLS on profiles if not already enabled
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies
DROP POLICY IF EXISTS "Read own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can read all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can read own profile or admins read all" ON profiles;
DROP POLICY IF EXISTS "Users read own profile, admins read all" ON profiles;
DROP POLICY IF EXISTS "Authenticated users can read profiles" ON profiles;
DROP POLICY IF EXISTS "Allow all reads for now" ON profiles;

-- Create simple, secure policy: users can only read their own profile
-- Admin operations will use the service role key which bypasses RLS
CREATE POLICY "Users can read own profile"
ON profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Keep the existing update policy
-- (Already exists: "Update own profile")

-- ==============================================================================
-- MIGRATION COMPLETE
-- ==============================================================================

-- This migration:
-- 1. Re-enables RLS on profiles table
-- 2. Creates a restrictive policy allowing users to only read their own profile
-- 3. Admin operations will bypass RLS by using the service role key
--
-- Security Model:
-- - Regular users: Can only read their own profile (via anon key + RLS)
-- - Admin users: Use service role key which bypasses RLS (after auth verification)
-- - All admin operations must verify authentication before using service client
--
-- Next Steps:
-- 1. Verify SUPABASE_SERVICE_ROLE_KEY is set in environment variables
-- 2. Test admin portal shows all users (should work via service key)
-- 3. Test regular users can only see their own profile
