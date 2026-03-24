-- Migration: Return connection_status on rejoin
-- Description: When join_game_atomic detects an existing team for the device,
--   include connection_status in the return value so the client can route directly
--   to the active game (instead of the waiting room) for already-approved teams.
-- Created: 2026-03-25
-- Related: RG-125
CREATE OR REPLACE FUNCTION join_game_atomic(
  p_game_id  UUID,
  p_device_id TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $body$
DECLARE
  v_num_teams          INT;
  v_status             TEXT;
  v_team_names         JSONB;
  v_current_count      INT;
  v_next_number        INT;
  v_team_name          TEXT;
  v_new_team_id        UUID;
  v_connection_status  TEXT;
BEGIN
  -- Validate device_id to prevent arbitrarily long strings from anonymous callers
  IF p_device_id IS NULL OR length(p_device_id) = 0 OR length(p_device_id) > 255 THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'invalid_request');
  END IF;

  -- Lock the game row to serialize concurrent joins
  SELECT num_teams, status, team_names
  INTO   v_num_teams, v_status, v_team_names
  FROM   games
  WHERE  id = p_game_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'game_not_found');
  END IF;

  IF v_status = 'completed' THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'game_completed');
  END IF;

  -- Idempotency: if this device already has a team in this game, return it.
  -- Include connection_status so the client can route to the active game
  -- directly rather than landing back in the waiting room for approved teams.
  SELECT id, connection_status
  INTO   v_new_team_id, v_connection_status
  FROM   teams
  WHERE  game_id = p_game_id AND device_id = p_device_id;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'success',           true,
      'team_id',           v_new_team_id,
      'rejoined',          true,
      'connection_status', v_connection_status
    );
  END IF;

  -- Count teams already in this game
  SELECT COUNT(*)
  INTO   v_current_count
  FROM   teams
  WHERE  game_id = p_game_id;

  IF v_current_count >= v_num_teams THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'game_full');
  END IF;

  -- Determine next sequential team number
  SELECT COALESCE(MAX(team_number), 0) + 1
  INTO   v_next_number
  FROM   teams
  WHERE  game_id = p_game_id;

  -- Resolve team name from the configured list, or fall back to "Team N"
  IF v_team_names IS NOT NULL AND jsonb_array_length(v_team_names) >= v_next_number THEN
    v_team_name := v_team_names ->> (v_next_number - 1);
  END IF;

  IF v_team_name IS NULL OR v_team_name = '' THEN
    v_team_name := 'Team ' || v_next_number;
  END IF;

  -- Insert the new team record
  INSERT INTO teams (game_id, team_number, team_name, device_id, connection_status, score, last_seen)
  VALUES (p_game_id, v_next_number, v_team_name, p_device_id, 'pending', 0, now())
  RETURNING id INTO v_new_team_id;

  RETURN jsonb_build_object(
    'success',     true,
    'team_id',     v_new_team_id,
    'team_number', v_next_number
  );
END;
$body$;
