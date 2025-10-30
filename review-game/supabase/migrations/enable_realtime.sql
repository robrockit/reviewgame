-- Migration: Enable Realtime on tables
-- Purpose: Allow real-time subscriptions to work for live updates
-- Required for teacher dashboard to see teams join in real-time
-- Required for students to see game status changes (setup -> active -> completed)

-- Enable Realtime for the teams table
ALTER TABLE public.teams REPLICA IDENTITY FULL;

-- Enable Realtime for the games table
ALTER TABLE public.games REPLICA IDENTITY FULL;

-- Enable publication for teams table
-- This allows real-time subscriptions to receive INSERT, UPDATE, DELETE events
ALTER PUBLICATION supabase_realtime ADD TABLE public.teams;

-- Enable publication for games table
-- This allows students to see when game starts/ends
ALTER PUBLICATION supabase_realtime ADD TABLE public.games;

-- Add comments for documentation
COMMENT ON TABLE public.teams IS
  'Teams table with realtime enabled. Allows teachers to see teams join instantly and students to see approval updates without refreshing.';

COMMENT ON TABLE public.games IS
  'Games table with realtime enabled. Allows students to see game status changes (setup -> active -> completed) without refreshing.';
