/**
 * UI Constants
 * Centralized constants for UI strings, labels, and messages
 */

/**
 * Buzz queue status labels and messages
 */
export const BUZZ_QUEUE_LABELS = {
  ANSWERING: 'ANSWERING',
  PROCESSING: 'Processing...',
  WAITING_FOR_BUZZES: 'Waiting for buzzes...',
  NO_TEAMS_BUZZED: 'No teams have buzzed in yet...',
  PROCESSING_ANSWER: 'Processing answer...',
  CLEAR_QUEUE: 'Clear Queue',
  CLEARING: 'Clearing...',
} as const;

/**
 * Button text constants
 */
export const BUTTON_TEXT = {
  CORRECT: '✓ Correct',
  INCORRECT: '✗ Incorrect',
  CLOSE: 'Close',
  PROCESSING: 'Processing...',
} as const;

/**
 * Question modal messages
 */
export const QUESTION_MODAL_MESSAGES = {
  WAITING_FOR_BUZZES: 'Waiting for buzzes...',
  PROCESSING_ANSWER: 'Processing answer...',
  NO_TEAMS_IN_QUEUE: 'No teams have buzzed in yet...',
} as const;
