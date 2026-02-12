// Shared type definitions for the game

export interface Question {
  id: string;
  value: number;
  text: string;
  isUsed: boolean;
  isDailyDouble?: boolean;
  categoryName?: string; // Category context for display in modal
}

export interface Category {
  id: string;
  name: string;
  questions: Question[];
}

export interface GameData {
  id: string;
  categories: Category[];
  timerEnabled?: boolean;
  timerSeconds?: number;
  // Add other game properties as needed
}

export interface Team {
  id: string;
  name: string; // Alias for backward compatibility
  team_name: string; // Database column name (same value as name)
  score: number;
  final_jeopardy_wager?: number | null;
  final_jeopardy_answer?: string | null;
  final_jeopardy_submitted_at?: string | null;
  // Add other team properties as needed
}

export interface BuzzEntry {
  teamId: string;
  timestamp: number;
}

// Final Jeopardy types
export type GamePhase =
  | 'regular'
  | 'final_jeopardy_wager'
  | 'final_jeopardy_answer'
  | 'final_jeopardy_reveal';

export interface FinalJeopardyQuestion {
  category: string;
  question: string;
  answer: string;
}

export interface FinalJeopardyTeamStatus {
  teamId: string;
  teamName: string;
  currentScore: number;
  wager: number | null;
  answer: string | null;
  submittedAt: string | null;
  isCorrect: boolean | null;
  revealed: boolean;
}
