-- Atomic score increment for pub trivia players (individual answer scoring)
-- Uses a single UPDATE … RETURNING to avoid the read-modify-write race that exists
-- when two concurrent requests both read score=X and both write score=X+delta.
-- Called from the service role in the answer API route, which already verifies
-- deviceId and playerId ownership, so no auth.uid() check is needed here.
CREATE OR REPLACE FUNCTION public.increment_pub_trivia_score(
  p_player_id UUID,
  p_points_earned INTEGER
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_score INTEGER;
BEGIN
  UPDATE teams
  SET score = COALESCE(score, 0) + p_points_earned,
      updated_at = now()
  WHERE id = p_player_id
  RETURNING score INTO v_new_score;

  RETURN COALESCE(v_new_score, 0);
END;
$$;

COMMENT ON FUNCTION public.increment_pub_trivia_score(UUID, INTEGER) IS
  'Atomically increments a pub trivia player score and returns the new total. '
  'Eliminates the read-modify-write race condition present in application-level score updates.';

GRANT EXECUTE ON FUNCTION public.increment_pub_trivia_score(UUID, INTEGER) TO service_role;
