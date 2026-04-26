-- Migration: Add game_type and pub trivia runtime columns to games table
-- Description: Adds game_type discriminator ('jeopardy' | 'pub_trivia'), randomized
--              question order storage, current question tracking, and question-start
--              timestamp for server-side time-based scoring.
-- Date: 2026-04-25

ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS game_type TEXT NOT NULL DEFAULT 'jeopardy'
    CONSTRAINT games_game_type_check CHECK (game_type IN ('jeopardy', 'pub_trivia'));

-- 0-based index into pub_trivia_question_order for the currently active question.
-- Incremented by the question/end API route when advancing to the next round.
ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS current_question_index INTEGER NOT NULL DEFAULT 0;

-- Randomized array of question IDs set when a pub trivia game starts.
-- Stored as JSONB string array, e.g. ["uuid1","uuid2",...].
ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS pub_trivia_question_order JSONB;

-- UTC timestamp set by the question/start API route. Used by question/answer to
-- compute elapsed time and map to a point bracket.
ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS current_question_started_at TIMESTAMPTZ;

-- Partial index: only pub_trivia games need game_type filtering
CREATE INDEX IF NOT EXISTS idx_games_game_type
  ON public.games(game_type)
  WHERE game_type = 'pub_trivia';

COMMENT ON COLUMN public.games.game_type IS
  'Discriminator: jeopardy (default) or pub_trivia. Controls which game routes and UI are used.';
COMMENT ON COLUMN public.games.current_question_index IS
  'Index of the active question in pub_trivia_question_order. 0-based. Only meaningful for pub_trivia games.';
COMMENT ON COLUMN public.games.pub_trivia_question_order IS
  'Randomised array of question IDs for pub trivia. Set atomically when game starts. NULL for jeopardy games.';
COMMENT ON COLUMN public.games.current_question_started_at IS
  'Timestamp when the current pub trivia question round began. Cleared between rounds.';
