/**
 * Question Bank Validation Constants
 *
 * This module defines validation rules and constants for question banks and questions.
 * Used across both client and server to ensure consistent validation.
 *
 * @module question-banks
 */

/**
 * Validation rules for question bank metadata
 */
export const QUESTION_BANK_VALIDATION = {
  /** Minimum length for question bank title */
  TITLE_MIN_LENGTH: 1,
  /** Maximum length for question bank title */
  TITLE_MAX_LENGTH: 200,
  /** Minimum length for subject field */
  SUBJECT_MIN_LENGTH: 1,
  /** Maximum length for subject field */
  SUBJECT_MAX_LENGTH: 100,
  /** Maximum length for description field */
  DESCRIPTION_MAX_LENGTH: 1000,
  /** Valid difficulty levels */
  DIFFICULTIES: ['easy', 'medium', 'hard'] as const,
} as const;

/**
 * Validation rules for individual questions
 */
export const QUESTION_VALIDATION = {
  /** Minimum length for category name */
  CATEGORY_MIN_LENGTH: 1,
  /** Maximum length for category name */
  CATEGORY_MAX_LENGTH: 100,
  /** Minimum length for question text */
  QUESTION_TEXT_MIN_LENGTH: 1,
  /** Maximum length for question text */
  QUESTION_TEXT_MAX_LENGTH: 500,
  /** Minimum length for answer text */
  ANSWER_TEXT_MIN_LENGTH: 1,
  /** Maximum length for answer text */
  ANSWER_TEXT_MAX_LENGTH: 300,
  /** Maximum length for teacher notes */
  TEACHER_NOTES_MAX_LENGTH: 1000,
  /** Valid point values for questions (100-500 in increments of 100) */
  POINT_VALUES: [100, 200, 300, 400, 500] as const,
} as const;

/**
 * Jeopardy-style grid configuration
 * Standard game board: 7 categories × 5 questions per category
 */
export const JEOPARDY_GRID = {
  /** Number of categories in a standard game */
  CATEGORIES: 7,
  /** Number of questions per category */
  QUESTIONS_PER_CATEGORY: 5,
  /** Point values for each row (100, 200, 300, 400, 500) */
  POINT_VALUES: [100, 200, 300, 400, 500] as const,
} as const;

/**
 * URL validation regex
 * Basic URL validation - accepts http/https URLs
 */
export const URL_REGEX = /^https?:\/\/.+/i;
