-- Migration: Initial Database Schema
-- Purpose: Create base tables and schema for Review Game application
-- Created: 2024-10-01 (predates all other migrations)
--
-- This migration creates the foundational database structure that other
-- migrations will build upon.

-- ==============================================================================
-- PROFILES TABLE (Base User Information)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  stripe_customer_id TEXT UNIQUE,
  subscription_status TEXT DEFAULT 'free' CHECK (subscription_status IN ('free', 'TRIAL', 'ACTIVE', 'INACTIVE', 'CANCELLED')),
  subscription_tier TEXT CHECK (subscription_tier IN ('free', 'basic', 'premium')),
  games_created_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can read their own profile
CREATE POLICY "Users can view own profile"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

-- RLS Policy: Users can update their own profile (limited fields)
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id);

-- Comments for documentation
COMMENT ON TABLE public.profiles IS 'User profile information linked to auth.users';
COMMENT ON COLUMN public.profiles.id IS 'UUID from auth.users table';
COMMENT ON COLUMN public.profiles.email IS 'User email address from Supabase Auth';
COMMENT ON COLUMN public.profiles.stripe_customer_id IS 'Stripe customer ID for billing';
COMMENT ON COLUMN public.profiles.subscription_status IS 'Current subscription status';
COMMENT ON COLUMN public.profiles.subscription_tier IS 'Subscription plan tier';
COMMENT ON COLUMN public.profiles.games_created_count IS 'Total number of games created by user';

-- ==============================================================================
-- QUESTION BANKS TABLE
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.question_banks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  subject TEXT,
  is_public BOOLEAN DEFAULT FALSE,
  is_custom BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.question_banks ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view public banks or their own custom banks
CREATE POLICY "Users can view public or own banks"
  ON public.question_banks
  FOR SELECT
  USING (is_public = true OR owner_id = auth.uid());

-- RLS Policy: Users can create their own banks
CREATE POLICY "Users can create own banks"
  ON public.question_banks
  FOR INSERT
  WITH CHECK (owner_id = auth.uid());

-- RLS Policy: Users can update their own banks
CREATE POLICY "Users can update own banks"
  ON public.question_banks
  FOR UPDATE
  USING (owner_id = auth.uid());

-- RLS Policy: Users can delete their own banks
CREATE POLICY "Users can delete own banks"
  ON public.question_banks
  FOR DELETE
  USING (owner_id = auth.uid());

COMMENT ON TABLE public.question_banks IS 'Collections of questions for games';

-- ==============================================================================
-- QUESTIONS TABLE
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_id UUID REFERENCES public.question_banks(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  question_text TEXT NOT NULL,
  answer_text TEXT NOT NULL,
  point_value INTEGER NOT NULL CHECK (point_value IN (100, 200, 300, 400, 500)),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view questions from public banks or their own banks
CREATE POLICY "Users can view questions from accessible banks"
  ON public.questions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.question_banks
      WHERE question_banks.id = questions.bank_id
      AND (question_banks.is_public = true OR question_banks.owner_id = auth.uid())
    )
  );

-- RLS Policy: Users can create questions in their own banks
CREATE POLICY "Users can create questions in own banks"
  ON public.questions
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.question_banks
      WHERE question_banks.id = questions.bank_id
      AND question_banks.owner_id = auth.uid()
    )
  );

-- RLS Policy: Users can update questions in their own banks
CREATE POLICY "Users can update questions in own banks"
  ON public.questions
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.question_banks
      WHERE question_banks.id = questions.bank_id
      AND question_banks.owner_id = auth.uid()
    )
  );

-- RLS Policy: Users can delete questions in their own banks
CREATE POLICY "Users can delete questions in own banks"
  ON public.questions
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.question_banks
      WHERE question_banks.id = questions.bank_id
      AND question_banks.owner_id = auth.uid()
    )
  );

COMMENT ON TABLE public.questions IS 'Individual questions within question banks';

-- ==============================================================================
-- GAMES TABLE
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  bank_id UUID REFERENCES public.question_banks(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'setup' CHECK (status IN ('setup', 'in_progress', 'active', 'completed')),
  num_teams INTEGER NOT NULL,
  team_names JSONB,
  selected_questions TEXT[],
  daily_double_positions JSONB,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Teachers can view their own games
CREATE POLICY "Teachers can view own games"
  ON public.games
  FOR SELECT
  USING (teacher_id = auth.uid());

-- RLS Policy: Teachers can create games
CREATE POLICY "Teachers can create games"
  ON public.games
  FOR INSERT
  WITH CHECK (teacher_id = auth.uid());

-- RLS Policy: Teachers can update their own games
CREATE POLICY "Teachers can update own games"
  ON public.games
  FOR UPDATE
  USING (teacher_id = auth.uid());

-- RLS Policy: Teachers can delete their own games
CREATE POLICY "Teachers can delete own games"
  ON public.games
  FOR DELETE
  USING (teacher_id = auth.uid());

COMMENT ON TABLE public.games IS 'Game instances created by teachers';

-- ==============================================================================
-- TEAMS TABLE
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID REFERENCES public.games(id) ON DELETE CASCADE,
  team_number INTEGER NOT NULL,
  team_name TEXT,
  score INTEGER DEFAULT 0,
  connection_status TEXT CHECK (connection_status IN ('pending', 'connected', 'disconnected')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Anyone can view teams (for game display)
CREATE POLICY "Anyone can view teams"
  ON public.teams
  FOR SELECT
  USING (true);

-- RLS Policy: Teachers can manage teams in their games
CREATE POLICY "Teachers can manage teams in own games"
  ON public.teams
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.games
      WHERE games.id = teams.game_id
      AND games.teacher_id = auth.uid()
    )
  );

COMMENT ON TABLE public.teams IS 'Teams participating in games';

-- ==============================================================================
-- INDEXES FOR PERFORMANCE
-- ==============================================================================

CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer ON public.profiles(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_question_banks_owner ON public.question_banks(owner_id);
CREATE INDEX IF NOT EXISTS idx_questions_bank ON public.questions(bank_id);
CREATE INDEX IF NOT EXISTS idx_games_teacher ON public.games(teacher_id);
CREATE INDEX IF NOT EXISTS idx_teams_game ON public.teams(game_id);

-- ==============================================================================
-- ENABLE REALTIME
-- ==============================================================================

-- Enable realtime for tables that need live updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.teams;
ALTER PUBLICATION supabase_realtime ADD TABLE public.games;
