-- Migration: Add atomic end_game function
-- Description: Creates a database function to atomically end a game and disconnect all teams
-- Created: 2026-02-01
-- Author: Claude Code

-- Drop function if it already exists
DROP FUNCTION IF EXISTS end_game(uuid);

-- Create atomic function to end a game
-- This ensures both game update and team disconnection happen in a single transaction
CREATE OR REPLACE FUNCTION end_game(p_game_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_game_record RECORD;
  v_teams_updated integer;
BEGIN
  -- Verify the game exists and get current status
  SELECT id, status, teacher_id
  INTO v_game_record
  FROM games
  WHERE id = p_game_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Game not found: %', p_game_id;
  END IF;

  -- Verify the requesting user owns this game (auth.uid() returns current user)
  IF v_game_record.teacher_id != auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized: You do not own this game';
  END IF;

  -- Check if game is already completed
  IF v_game_record.status = 'completed' THEN
    RAISE NOTICE 'Game is already completed';
    -- Return success but indicate it was already completed
    RETURN jsonb_build_object(
      'success', true,
      'already_completed', true,
      'game_id', p_game_id
    );
  END IF;

  -- Update game status to 'completed' and set completion timestamp
  UPDATE games
  SET
    status = 'completed',
    completed_at = now()
  WHERE id = p_game_id;

  -- Disconnect all teams by setting connection_status to null
  UPDATE teams
  SET connection_status = null
  WHERE game_id = p_game_id;

  -- Get count of teams that were updated
  GET DIAGNOSTICS v_teams_updated = ROW_COUNT;

  -- Log the action (optional - if you have audit logging)
  -- INSERT INTO admin_audit_log (admin_user_id, action_type, target_type, target_id, notes)
  -- VALUES (auth.uid(), 'game_ended', 'game', p_game_id, format('Ended game and disconnected %s teams', v_teams_updated));

  -- Return success with details
  RETURN jsonb_build_object(
    'success', true,
    'game_id', p_game_id,
    'teams_disconnected', v_teams_updated,
    'already_completed', false
  );
END;
$$;

-- Add comment describing the function
COMMENT ON FUNCTION end_game(uuid) IS 'Atomically ends a game by marking it as completed and disconnecting all teams. Ensures data integrity by performing both operations in a single transaction. Verifies the requesting user owns the game before allowing the operation.';

-- Grant execute permission to authenticated users
-- RLS will handle authorization check inside the function
GRANT EXECUTE ON FUNCTION end_game(uuid) TO authenticated;
