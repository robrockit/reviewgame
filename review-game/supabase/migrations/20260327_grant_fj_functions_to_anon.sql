-- Migration: Grant FJ wager/answer functions to anon role
-- Description: Students are unauthenticated (anon role), so grant execute on
--              submit_final_jeopardy_wager and submit_final_jeopardy_answer to anon.
--              Previously only granted to authenticated, causing 403s from student browsers.
-- Created: 2026-03-27
-- Related: FJ E2E test fix

GRANT EXECUTE ON FUNCTION submit_final_jeopardy_wager TO anon;
GRANT EXECUTE ON FUNCTION submit_final_jeopardy_answer TO anon;
