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
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for the look-up patterns used by the SECURITY DEFINER functions
CREATE INDEX IF NOT EXISTS idx_wagers_game_team
  ON public.wagers(game_id, team_id);

CREATE INDEX IF NOT EXISTS idx_wagers_game_type
  ON public.wagers(game_id, wager_type);

-- Enable RLS — the table is only accessed through SECURITY DEFINER functions
-- so no row-level policies are needed; RLS simply blocks direct client access.
ALTER TABLE public.wagers ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.wagers IS
  'Audit trail for Daily Double and Final Jeopardy wagers. Written atomically by SECURITY DEFINER functions; not written directly by clients.';
