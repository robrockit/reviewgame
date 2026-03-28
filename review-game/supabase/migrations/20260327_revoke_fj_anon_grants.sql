-- Migration: Revoke anon execute on FJ wager/answer functions (security fix)
-- Description: Reverts an earlier incorrect approach of granting anon execute.
--              The wager/answer API routes now use the service role client for the RPC
--              call, so no anon grant is needed. Granting anon execute would allow
--              anyone with the public anon key to call these functions directly and
--              overwrite any team's wager/answer by guessing a team UUID.
--              REVOKE is a no-op if the grant was never applied.
-- Created: 2026-03-27

REVOKE EXECUTE ON FUNCTION submit_final_jeopardy_wager FROM anon;
REVOKE EXECUTE ON FUNCTION submit_final_jeopardy_answer FROM anon;
