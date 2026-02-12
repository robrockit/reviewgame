-- Migration: Revoke Final Jeopardy Function Grants (Security Fix)
-- Description: Removes public execute permissions from Final Jeopardy functions
-- Date: 2026-02-12
-- Related: Security vulnerability - functions should only be callable via API routes

-- =====================================================
-- SECURITY FIX: Revoke Execute Permissions
-- =====================================================

-- Remove execute permissions from authenticated users
-- These functions should ONLY be callable via service role (API routes)
REVOKE EXECUTE ON FUNCTION submit_final_jeopardy_wager FROM authenticated;
REVOKE EXECUTE ON FUNCTION submit_final_jeopardy_answer FROM authenticated;
REVOKE EXECUTE ON FUNCTION start_final_jeopardy FROM authenticated;
REVOKE EXECUTE ON FUNCTION reveal_final_jeopardy_answer FROM authenticated;
REVOKE EXECUTE ON FUNCTION skip_final_jeopardy FROM authenticated;

-- =====================================================
-- Security Rationale
-- =====================================================

COMMENT ON FUNCTION submit_final_jeopardy_wager IS 
  'Atomically validates and submits Final Jeopardy wager. SECURITY: Only callable via service role (API routes enforce authorization). Direct client calls blocked to prevent team impersonation.';

COMMENT ON FUNCTION submit_final_jeopardy_answer IS 
  'Atomically submits Final Jeopardy answer. SECURITY: Only callable via service role (API routes enforce authorization). Direct client calls blocked to prevent team impersonation.';

COMMENT ON FUNCTION start_final_jeopardy IS 
  'Atomically starts Final Jeopardy round. SECURITY: Only callable via service role (API routes verify teacher ownership). Direct client calls blocked for defense-in-depth.';

COMMENT ON FUNCTION reveal_final_jeopardy_answer IS 
  'Atomically reveals Final Jeopardy answer and updates score. SECURITY: Only callable via service role (API routes verify teacher ownership). Direct client calls blocked for defense-in-depth.';

COMMENT ON FUNCTION skip_final_jeopardy IS 
  'Skips Final Jeopardy and cleans up state. SECURITY: Only callable via service role (API routes verify teacher ownership). Direct client calls blocked for defense-in-depth.';

-- =====================================================
-- Verification Query (Run in SQL Editor)
-- =====================================================

-- To verify permissions are revoked, run:
/*
SELECT 
  p.proname as function_name,
  pg_catalog.pg_get_function_identity_arguments(p.oid) as arguments,
  CASE 
    WHEN proacl IS NULL THEN 'No explicit grants (public can execute)'
    ELSE proacl::text 
  END as acl
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname LIKE '%final_jeopardy%'
ORDER BY p.proname;
*/

-- Expected: All functions should have acl showing only owner/superuser access
-- NOT: =X/owner (which means public execute permission)
