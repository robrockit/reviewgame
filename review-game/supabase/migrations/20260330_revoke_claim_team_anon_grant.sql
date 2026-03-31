-- Migration: Revoke anon execute on claim_team function (security fix)
-- Description: The claim API route now uses the service role client for the RPC
--              call, so no anon grant is needed. Granting anon execute would allow
--              anyone with the public anon key to call this function directly and
--              claim any team by guessing a team UUID.
--              Wrapped in a DO block so this is a no-op if the function does not
--              exist (e.g. environments where the 20260210 migration was not applied).
-- Created: 2026-03-30

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'claim_team'
  ) THEN
    REVOKE EXECUTE ON FUNCTION public.claim_team(uuid, uuid, uuid) FROM anon;
  END IF;
END;
$$;
