/**
 * Utility functions for buzz queue position display
 */

/**
 * Get the proper ordinal suffix for a number
 * @param n - The number to get the suffix for
 * @returns The number with proper ordinal suffix (e.g., "1st", "2nd", "21st", "22nd")
 */
export const getOrdinalSuffix = (n: number): string => {
  const lastDigit = n % 10;
  const lastTwoDigits = n % 100;

  // Handle special cases: 11th, 12th, 13th
  if (lastTwoDigits >= 11 && lastTwoDigits <= 13) {
    return `${n}th`;
  }

  // Handle regular cases
  switch (lastDigit) {
    case 1: return `${n}st`;
    case 2: return `${n}nd`;
    case 3: return `${n}rd`;
    default: return `${n}th`;
  }
};

/**
 * Position display configuration for a given position index
 */
export interface PositionDisplay {
  emoji: string;
  text: string;
  color: string;
}

/**
 * Get position display information (emoji, text, color) for a given position
 * @param position - 0-based position index in the queue
 * @returns Position display configuration
 */
export const getPositionDisplay = (position: number): PositionDisplay => {
  const positionNumber = position + 1; // Convert to 1-based

  switch (position) {
    case 0:
      return {
        emoji: '🥇',
        text: '1st',
        color: 'text-yellow-500'
      };
    case 1:
      return {
        emoji: '🥈',
        text: '2nd',
        color: 'text-gray-400'
      };
    case 2:
      return {
        emoji: '🥉',
        text: '3rd',
        color: 'text-orange-500'
      };
    default:
      return {
        emoji: '🏅',
        text: getOrdinalSuffix(positionNumber),
        color: 'text-blue-400'
      };
  }
};
