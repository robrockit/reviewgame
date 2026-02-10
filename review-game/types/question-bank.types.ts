/**
 * Question Bank Type Definitions
 *
 * This module defines types for question banks and questions used throughout the application.
 * Types are derived from the database schema for type safety.
 *
 * @module question-bank.types
 */

import type { Tables } from './database.types';

/**
 * Question bank row from the database
 */
export type QuestionBank = Tables<'question_banks'>;

/**
 * Question row from the database
 */
export type Question = Tables<'questions'>;

/**
 * Difficulty level for question banks
 */
export type Difficulty = 'easy' | 'medium' | 'hard';

/**
 * Question bank list item with additional metadata
 * Used for displaying question banks in lists
 */
export interface QuestionBankListItem {
  id: string;
  title: string;
  subject: string;
  description: string | null;
  difficulty: string | null;
  is_custom: boolean | null;
  is_public: boolean | null;
  owner_id: string | null;
  created_at: string | null;
  updated_at: string | null;
  question_count?: number; // Aggregated count from related questions
}

/**
 * Form data for creating/updating a question
 */
export interface QuestionFormData {
  category: string;
  point_value: number;
  question_text: string;
  answer_text: string;
  teacher_notes?: string;
  image_url?: string;
}

/**
 * Grid structure for organizing questions by category and point value
 * Used for the Jeopardy-style 7×5 grid display
 *
 * Structure:
 * {
 *   "Category 1": {
 *     100: Question,
 *     200: Question,
 *     ...
 *   },
 *   "Category 2": { ... },
 *   ...
 * }
 */
export interface QuestionGridData {
  [category: string]: {
    [pointValue: number]: Question;
  };
}

/**
 * API response for question bank list
 */
export interface QuestionBankListResponse {
  data: QuestionBankListItem[];
}

/**
 * API response for question list
 */
export interface QuestionListResponse {
  data: Question[];
}
