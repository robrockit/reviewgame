-- Migration: Add Device ID Authentication for Teams
-- Purpose: Enable secure device-based team authentication to prevent impersonation
-- Date: 2026-02-10

-- Add device_id column (UUID type for consistency with other IDs)
ALTER TABLE public.teams
ADD COLUMN IF NOT EXISTS device_id UUID NULL;

-- Create index for faster device_id lookups
CREATE INDEX IF NOT EXISTS idx_teams_device_id
ON public.teams(device_id)
WHERE device_id IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.teams.device_id IS
  'UUID of the device that has claimed this team. Used to prevent team impersonation. One device per team within a game, but a device can control teams in different games.';

-- Create atomic team claiming function with row-level locking
CREATE OR REPLACE FUNCTION public.claim_team(
  p_team_id UUID,
  p_game_id UUID,
  p_device_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_device_id UUID;
  v_team_name TEXT;
  v_team_number INTEGER;
BEGIN
  -- Lock the row for update to prevent race conditions
  SELECT device_id, team_name, team_number
  INTO v_current_device_id, v_team_name, v_team_number
  FROM teams
  WHERE id = p_team_id AND game_id = p_game_id
  FOR UPDATE;

  -- If team not found, return error
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'TEAM_NOT_FOUND',
      'message', 'Team does not exist or does not belong to this game'
    );
  END IF;

  -- If team already claimed by a different device, return error
  IF v_current_device_id IS NOT NULL AND v_current_device_id != p_device_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'TEAM_ALREADY_CLAIMED',
      'message', 'This team is already being controlled by another device'
    );
  END IF;

  -- If team already claimed by this device, return success (idempotent)
  IF v_current_device_id = p_device_id THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_claimed', true,
      'team_name', v_team_name,
      'team_number', v_team_number
    );
  END IF;

  -- Claim the team (device_id is null at this point)
  UPDATE teams
  SET device_id = p_device_id
  WHERE id = p_team_id;

  RETURN jsonb_build_object(
    'success', true,
    'already_claimed', false,
    'team_name', v_team_name,
    'team_number', v_team_number
  );
END;
$$;

-- Grant execute permission to authenticated users (API uses authenticated role)
GRANT EXECUTE ON FUNCTION public.claim_team(UUID, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_team(UUID, UUID, UUID) TO anon;

-- Add comment for documentation
COMMENT ON FUNCTION public.claim_team(UUID, UUID, UUID) IS
  'Atomically claims a team for a device. Uses row-level locking (FOR UPDATE) to prevent race conditions. Returns success/error and team info.';
