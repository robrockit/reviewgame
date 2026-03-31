-- Migration: Revoke anon execute on claim_team function (security fix)
-- Description: The claim API route now uses the service role client for the RPC
--              call, so no anon grant is needed. Granting anon execute would allow
--              anyone with the public anon key to call this function directly and
--              claim any team by guessing a team UUID.
--              REVOKE is a no-op if the grant was never applied.
-- Created: 2026-03-30

REVOKE EXECUTE ON FUNCTION public.claim_team(uuid, uuid, uuid) FROM anon;
