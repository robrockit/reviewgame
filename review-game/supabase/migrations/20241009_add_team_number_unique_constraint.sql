-- Migration: Add Unique Constraint for Team Numbers
-- Purpose: Prevent race condition where multiple students select same team number
-- Issue: TOCTOU (Time-of-check to Time-of-use) vulnerability
-- Two students could select the same team simultaneously because check happens client-side
-- Created: 2025-10-30

-- Add unique constraint to ensure no two teams can have the same team_number in the same game
-- This prevents the race condition at the database level
ALTER TABLE public.teams
ADD CONSTRAINT unique_game_team_number
UNIQUE (game_id, team_number);

-- Add comment for documentation
COMMENT ON CONSTRAINT unique_game_team_number ON public.teams IS
  'Ensures each team number is unique within a game. Prevents race condition where multiple students join as the same team simultaneously.';

-- Note: When this constraint is violated, the client will receive error code '23505' (unique_violation)
-- The client-side code should handle this gracefully by showing "Team already taken" message
