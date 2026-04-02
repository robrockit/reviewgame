-- Migration: Create wagers audit table
-- Description: The submit_final_jeopardy_wager / submit_final_jeopardy_answer /
--              reveal_final_jeopardy_answer / skip_final_jeopardy functions all
--              INSERT/UPDATE/DELETE from a `wagers` table that was never created.
--              This migration creates that table so the FJ flow can complete.
-- Date: 2026-04-01

CREATE TABLE IF NOT EXISTS public.wagers (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id           UUID        NOT NULL REFERENCES public.games(id)  ON DELETE CASCADE,
  team_id           UUID        NOT NULL REFERENCES public.teams(id)  ON DELETE CASCADE,
  question_id       UUID        REFERENCES public.questions(id)       ON DELETE SET NULL,
  wager_amount      INTEGER     NOT NULL DEFAULT 0,
  wager_type        TEXT        NOT NULL CHECK (wager_type IN ('daily_double', 'final_jeopardy')),
  question_category TEXT,
  question_value    INTEGER     NOT NULL DEFAULT 0,
  answer_text       TEXT,
  is_correct        BOOLEAN,
  revealed          BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- One canonical row per team per game per wager type.
  -- The SECURITY DEFINER functions INSERT once (wager submission) then UPDATE the
  -- same row (answer submission, reveal). Without this constraint a retry or race
  -- could silently insert a duplicate, causing the subsequent UPDATE to hit only
  -- the first row and leave a stale second one.
  CONSTRAINT uq_wagers_game_team_type UNIQUE (game_id, team_id, wager_type)
);

-- The UNIQUE constraint above creates an implicit index on (game_id, team_id, wager_type),
-- covering two-column (game_id, team_id) look-ups as a leading-prefix match.
-- Only keep the index for the (game_id, wager_type) pattern used by skip_final_jeopardy.
CREATE INDEX IF NOT EXISTS idx_wagers_game_type
  ON public.wagers(game_id, wager_type);

-- Trigger function to keep updated_at current on every UPDATE.
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER wagers_set_updated_at
  BEFORE UPDATE ON public.wagers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Enable RLS — the table is only accessed through SECURITY DEFINER functions
-- so no row-level policies are needed; RLS simply blocks direct client access.
ALTER TABLE public.wagers ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.wagers IS
  'One canonical row per (game_id, team_id, wager_type). Written atomically by SECURITY DEFINER functions; not written directly by clients. INSERT on wager submission, UPDATE on answer submission and reveal.';
