-- Migration: Create pub_trivia_answers table
-- Description: Records one row per (game_id, player_id, question_id). Written by the
--              question/answer API route when a player submits their MC choice.
--              Used for: time-based scoring, duplicate-submission prevention, and
--              post-round results broadcast.
-- Date: 2026-04-27

CREATE TABLE IF NOT EXISTS public.pub_trivia_answers (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id           UUID        NOT NULL REFERENCES public.games(id)     ON DELETE CASCADE,
  player_id         UUID        NOT NULL REFERENCES public.teams(id)     ON DELETE CASCADE,
  question_id       UUID        NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  answer_text       TEXT        NOT NULL,
  is_correct        BOOLEAN     NOT NULL DEFAULT FALSE,
  points_earned     INTEGER     NOT NULL DEFAULT 0,
  -- Wall-clock time when the answer was received. The API route computes elapsed
  -- milliseconds from games.current_question_started_at to map to a point bracket.
  answered_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Prevents a player from submitting twice for the same question in the same game.
  -- The API route relies on this constraint to return a 409 on duplicate submission
  -- rather than upsert silently.
  CONSTRAINT uq_pub_trivia_answers_player_question
    UNIQUE (game_id, player_id, question_id)
);

-- Used by question/end route to fetch all answers for a question in one query
CREATE INDEX IF NOT EXISTS idx_pub_trivia_answers_game_question
  ON public.pub_trivia_answers(game_id, question_id);

-- Used by player view to show a player's own result after round ends
CREATE INDEX IF NOT EXISTS idx_pub_trivia_answers_player
  ON public.pub_trivia_answers(player_id);

-- RLS enabled; table is written exclusively via server-side API routes
-- using the service role key, which bypasses RLS. Direct client writes are blocked.
ALTER TABLE public.pub_trivia_answers ENABLE ROW LEVEL SECURITY;

-- Allow authenticated players to read their own answer rows (for post-round display).
-- Players are identified by the teams row they claimed via device_id.
CREATE POLICY "pub_trivia_answers_player_read_own"
  ON public.pub_trivia_answers
  FOR SELECT
  TO anon, authenticated
  USING (
    player_id IN (
      SELECT t.id
      FROM   public.teams t
      WHERE  t.game_id  = pub_trivia_answers.game_id
        AND  t.device_id = current_setting('request.headers', true)::json->>'x-device-id'
    )
  );

COMMENT ON TABLE public.pub_trivia_answers IS
  'One row per (game_id, player_id, question_id). Written by server API on answer submission. UNIQUE constraint blocks double-submission. Cleared when game ends via CASCADE.';
