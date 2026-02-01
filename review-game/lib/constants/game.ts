/**
 * Game Constants
 * Centralized constants for game configuration and gameplay
 */

/**
 * Standard Jeopardy-style game board configuration
 */
export const GAME_BOARD = {
  /**
   * Total number of questions on a standard 5x5 game board
   * Used for daily double position validation and board generation
   */
  TOTAL_QUESTIONS: 25,

  /**
   * Number of rows on the game board (categories)
   */
  ROWS: 5,

  /**
   * Number of columns on the game board (difficulty levels)
   */
  COLUMNS: 5,

  /**
   * Number of daily double questions in a game
   */
  DAILY_DOUBLE_COUNT: 2,
} as const;

/**
 * Game timer configuration
 */
export const GAME_TIMER = {
  /**
   * Default timer duration in seconds
   */
  DEFAULT_SECONDS: 30,

  /**
   * Minimum timer duration in seconds
   */
  MIN_SECONDS: 5,

  /**
   * Maximum timer duration in seconds
   */
  MAX_SECONDS: 120,
} as const;
