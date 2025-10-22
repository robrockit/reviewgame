// Shared type definitions for the game

export interface Question {
  id: string;
  value: number;
  text: string;
  isUsed: boolean;
  isDailyDouble?: boolean;
}

export interface Category {
  id: string;
  name: string;
  questions: Question[];
}

export interface GameData {
  id: string;
  categories: Category[];
  // Add other game properties as needed
}

export interface Team {
  id: string;
  name: string;
  score: number;
  // Add other team properties as needed
}

export interface BuzzEntry {
  teamId: string;
  timestamp: number;
}
