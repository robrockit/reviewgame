-- Migration: Atomic join_game function
-- Description: Replaces client-side read-max-then-insert with a single atomic transaction
--   that locks the game row, enforces capacity, assigns team number, and inserts the team.
--   Eliminates the TOCTOU race condition where concurrent students could claim the same slot.
-- Created: 2026-03-23
-- Related: RG-125

-- Atomically joins a student device to a game as a new team.
-- Acquires a row-level lock on the game record so concurrent invocations are serialized.
-- Within the same transaction it:
--   1. Validates p_device_id length (max 255 chars)
--   2. Validates the game exists and is joinable
--   3. Counts existing teams and enforces the num_teams capacity
--   4. Assigns the next sequential team_number (MAX(team_number) + 1)
--   5. Resolves the team name from games.team_names[team_number - 1],
--      falling back to "Team N" when the array is absent or too short
--   6. Inserts the team record with connection_status = 'pending'
--
-- Known limitation: team_number uses MAX + 1, not COUNT + 1.
-- If a teacher deletes a pending team, a gap forms in team_numbers.
-- The next joiner receives MAX + 1 which may exceed the team_names array
-- length, causing the "Team N" fallback name. This is the safer failure
-- mode - COUNT + 1 risks a unique constraint violation when the
-- incremented value collides with an existing row after a deletion.
--
-- Returns JSONB:
--   Success: { "success": true, "team_id": "<uuid>", "team_number": <int> }
--   Failure: { "success": false, "error_code": "invalid_request" | "game_not_found" | "game_completed" | "game_full" }
--
-- Parameters:
--   p_game_id   - UUID of the game to join
--   p_device_id - Browser-generated device identifier for deduplication (max 255 chars)
CREATE OR REPLACE FUNCTION join_game_atomic(
  p_game_id  UUID,
  p_device_id TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $body$
DECLARE
  v_num_teams     INT;
  v_status        TEXT;
  v_team_names    JSONB;
  v_current_count INT;
  v_next_number   INT;
  v_team_name     TEXT;
  v_new_team_id   UUID;
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

