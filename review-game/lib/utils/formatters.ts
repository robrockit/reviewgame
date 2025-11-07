/**
 * Format utilities for consistent string formatting across the application
 */

/**
 * Convert a number to its ordinal representation
 * @param n - The number to convert (0-indexed or 1-indexed based on usage)
 * @returns The number with its ordinal suffix (e.g., "1st", "2nd", "3rd", "4th")
 *
 * @example
 * getOrdinal(1) // "1st"
 * getOrdinal(2) // "2nd"
 * getOrdinal(3) // "3rd"
 * getOrdinal(4) // "4th"
 * getOrdinal(21) // "21st"
 * getOrdinal(42) // "42nd"
 */
export const getOrdinal = (n: number): string => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};
