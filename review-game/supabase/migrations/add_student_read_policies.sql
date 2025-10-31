-- Migration: Add RLS policies for student access to games
-- Purpose: Allow students (authenticated or anonymous) to view game information when joining
-- This enables the student join page to fetch game details

-- ============================================
-- Games Table - Allow public read access
-- ============================================

-- Policy: Anyone can view games in setup status (for joining)
CREATE POLICY "Anyone can view games in setup status"
ON public.games
FOR SELECT
USING (status = 'setup');

-- Policy: Anyone can view active games (for playing)
CREATE POLICY "Anyone can view active games"
ON public.games
FOR SELECT
USING (status = 'active');

-- ============================================
-- Question Banks Table - Allow public read access
-- ============================================

-- Policy: Anyone can view public question banks
CREATE POLICY "Anyone can view public question banks"
ON public.question_banks
FOR SELECT
USING (is_public = true);

-- Policy: Anyone can view question banks used in games they're viewing
-- This is needed because games join with question_banks
CREATE POLICY "Anyone can view question banks for games"
ON public.question_banks
FOR SELECT
USING (
  id IN (
    SELECT bank_id
    FROM public.games
    WHERE status IN ('setup', 'active', 'completed')
  )
);

-- Add comment for documentation
COMMENT ON POLICY "Anyone can view games in setup status" ON public.games IS
  'Allows students to view game information when joining via the student join page. Only games in setup status are visible for joining.';

COMMENT ON POLICY "Anyone can view active games" ON public.games IS
  'Allows students to view game information during active gameplay.';

COMMENT ON POLICY "Anyone can view public question banks" ON public.question_banks IS
  'Allows anyone to view public question banks for browsing available content.';

COMMENT ON POLICY "Anyone can view question banks for games" ON public.question_banks IS
  'Allows students to view question bank information for games they are joining or playing.';
