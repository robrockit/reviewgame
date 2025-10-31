-- Migration: Fix CHANNEL_ERROR for anonymous realtime subscriptions
-- Purpose: Allow anonymous students to subscribe to game and team updates
-- Issue: Students getting CHANNEL_ERROR when trying to subscribe to realtime changes

-- The problem is that Supabase Realtime checks RLS policies when establishing subscriptions.
-- Our existing policies work for SELECT queries but may be too restrictive for realtime subscriptions.
-- We need to ensure anonymous users can subscribe to specific games/teams they're part of.

-- For debugging: Check current policies
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
-- FROM pg_policies
-- WHERE tablename IN ('games', 'teams')
-- ORDER BY tablename, policyname;

-- OPTION 1: Ensure RLS policies are permissive enough (should already be working)
-- Let's verify the existing policies are correct

-- If the above doesn't work, we can make the policies more explicit for realtime:

-- Drop and recreate games SELECT policies to be more explicit
DROP POLICY IF EXISTS "Anyone can view games in setup status" ON public.games;
DROP POLICY IF EXISTS "Anyone can view active games" ON public.games;

-- Create a single, broader policy for game viewing
CREATE POLICY "Anyone can view setup or active games"
ON public.games
FOR SELECT
USING (status IN ('setup', 'active'));

-- Ensure teams policy is correct
DROP POLICY IF EXISTS "Anyone can view teams for accessible games" ON public.teams;

CREATE POLICY "Anyone can view teams for active games"
ON public.teams
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.games
    WHERE games.id = teams.game_id
    AND games.status IN ('setup', 'active')
  )
);

-- Verify the changes
COMMENT ON POLICY "Anyone can view setup or active games" ON public.games IS
  'Allows anyone (including anonymous users) to view and subscribe to games in setup or active status. Required for realtime subscriptions.';

COMMENT ON POLICY "Anyone can view teams for active games" ON public.teams IS
  'Allows anyone (including anonymous users) to view and subscribe to teams for games in setup or active status. Required for realtime subscriptions.';

-- Note: Make sure realtime is enabled on both tables:
-- SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
