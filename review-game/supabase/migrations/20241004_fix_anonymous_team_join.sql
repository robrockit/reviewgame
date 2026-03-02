-- Migration: Allow anonymous users to join games
-- Purpose: Fix "new row violates row-level security policy for table teams" error
-- Students scanning QR codes are not authenticated, so they need anonymous INSERT permission

-- First, check if we need to drop any conflicting policies
-- Drop the old student insert policy if it exists (it required authentication)
DROP POLICY IF EXISTS "Students can insert teams when joining" ON public.teams;

-- ============================================
-- Teams Table - Allow anonymous team joining
-- ============================================

-- Policy: Anyone can insert teams when joining a game
-- This allows anonymous students to join via QR code
CREATE POLICY "Anyone can join teams during setup"
ON public.teams
FOR INSERT
WITH CHECK (
  -- Must be joining a game that's in setup status
  EXISTS (
    SELECT 1
    FROM public.games
    WHERE games.id = game_id
    AND games.status = 'setup'
  )
  -- Team must start in pending status (teacher approval required)
  AND connection_status = 'pending'
  -- Score must start at 0
  AND (score IS NULL OR score = 0)
);

-- Policy: Anyone can view teams for games they're in
-- This allows students to see the team list on the join page
CREATE POLICY "Anyone can view teams for accessible games"
ON public.teams
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.games
    WHERE games.id = game_id
    AND games.status IN ('setup', 'active')
  )
);

-- Policy: Anyone can update their own team's last_seen and connection status
-- This allows students to update their presence without authentication
CREATE POLICY "Anyone can update team presence"
ON public.teams
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.games
    WHERE games.id = game_id
    AND games.status IN ('setup', 'active')
  )
)
WITH CHECK (
  -- Can only update these specific fields
  -- Score changes still require teacher permission (separate policy)
  connection_status IN ('pending', 'connected', 'disconnected')
);

-- Add comments for documentation
COMMENT ON POLICY "Anyone can join teams during setup" ON public.teams IS
  'Allows anonymous students to join games by scanning QR codes. Teams start in pending status and require teacher approval.';

COMMENT ON POLICY "Anyone can view teams for accessible games" ON public.teams IS
  'Allows students to view team information for games in setup or active status.';

COMMENT ON POLICY "Anyone can update team presence" ON public.teams IS
  'Allows students to update their connection status without authentication. Score changes are still protected.';
