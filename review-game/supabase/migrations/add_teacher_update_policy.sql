-- Migration: Add Teacher UPDATE Policy for Games Table
-- Purpose: Allow teachers to update their own games (start game, change status, etc.)
-- Issue: Teachers couldn't start games without this policy
-- Created: 2025-10-30

-- This policy was missing from initial migrations and was causing teachers
-- to be unable to start games (update status from 'setup' to 'active')

-- Add UPDATE policy for teachers to modify their own games
CREATE POLICY "Teachers can update their own games"
ON public.games
FOR UPDATE
USING (teacher_id = auth.uid())
WITH CHECK (teacher_id = auth.uid());

-- Add comment for documentation
COMMENT ON POLICY "Teachers can update their own games" ON public.games IS
  'Allows authenticated teachers to update games they own. Required for starting games, updating status, and modifying game settings.';

-- Note: This policy requires authentication (auth.uid())
-- Anonymous users cannot update games, only teachers who own the game
