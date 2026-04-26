-- Grouped answer tally for live pub trivia teacher view.
-- Returns one row per distinct answer_text rather than one row per player,
-- avoiding a full table scan and JS-side aggregation as player counts grow.
CREATE OR REPLACE FUNCTION public.get_pub_trivia_answer_tally(
  p_game_id    UUID,
  p_question_id UUID
)
RETURNS TABLE(answer_text TEXT, answer_count BIGINT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT answer_text, COUNT(*)::BIGINT AS answer_count
  FROM   public.pub_trivia_answers
  WHERE  game_id    = p_game_id
    AND  question_id = p_question_id
  GROUP  BY answer_text;
$$;

COMMENT ON FUNCTION public.get_pub_trivia_answer_tally(UUID, UUID) IS
  'Returns grouped answer counts for a single pub trivia question round. '
  'Used in the fire-and-forget tally broadcast after each player submission.';

GRANT EXECUTE ON FUNCTION public.get_pub_trivia_answer_tally(UUID, UUID) TO service_role;
