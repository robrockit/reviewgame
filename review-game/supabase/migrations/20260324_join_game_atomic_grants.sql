-- Migration: Grants for join_game_atomic function
-- Description: Grants anon/authenticated execute permissions for join_game_atomic
-- Created: 2026-03-24
-- Related: RG-125
-- Students are anonymous (not authenticated), so grant execute to both roles
GRANT EXECUTE ON FUNCTION join_game_atomic TO anon, authenticated;
