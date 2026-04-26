-- Add optional player icon (emoji) column for pub trivia individual identity
ALTER TABLE teams ADD COLUMN IF NOT EXISTS player_icon text;
