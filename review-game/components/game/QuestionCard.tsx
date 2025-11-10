/**
 * @fileoverview Question card component for the game board.
 *
 * This component represents an individual question cell on the game board,
 * displaying the point value and handling selection. Daily Double questions
 * are visually hidden until selected to maintain suspense.
 *
 * @module components/game/QuestionCard
 */

import React from 'react';
import { Question } from '../../types/game';

/**
 * Props for the QuestionCard component.
 *
 * @interface QuestionCardProps
 * @property {Question} question - The question data to display
 * @property {function} onSelect - Callback function when the question is selected
 */
interface QuestionCardProps {
  question: Question;
  onSelect: (question: Question) => void;
}

/**
 * QuestionCard component representing a single question on the game board.
 *
 * This component:
 * - Displays the point value of the question
 * - Changes appearance when the question has been used
 * - Prevents selection of already-used questions
 * - Hides Daily Double status until the question is selected
 * - Provides hover effects for available questions
 *
 * Used questions appear grayed out and non-interactive.
 * Available questions show a blue background with hover effects.
 *
 * @param {QuestionCardProps} props - Component props
 * @returns {JSX.Element} The rendered question card
 *
 * @example
 * ```tsx
 * <QuestionCard
 *   question={question}
 *   onSelect={(q) => handleQuestionSelect(q)}
 * />
 * ```
 */
export const QuestionCard: React.FC<QuestionCardProps> = ({ question, onSelect }) => {
  /**
   * Handles click events on the question card.
   * Calls the onSelect callback with the question data.
   */
  const handleClick = () => {
    onSelect(question);
  };

  /**
   * Determines the CSS classes for the card based on its state.
   * Used questions get a grayed-out appearance, while available questions
   * show interactive styling.
   *
   * @returns {string} Tailwind CSS classes for the card
   */
  const getCardClasses = () => {
    const baseClasses = 'question-card p-4 font-bold flex items-center justify-center transition-all duration-300 ease-in-out rounded shadow-md text-white min-h-[80px]';

    if (question.isUsed) {
      return `${baseClasses} bg-gray-500 cursor-not-allowed opacity-70`;
    }

    // Daily Doubles look like regular questions until selected
    return `${baseClasses} bg-blue-600 hover:bg-blue-700 cursor-pointer`;
  };

  return (
    <div className={`${getCardClasses()} relative`} onClick={handleClick}>
      <div className="card-content">
        <div className="question-value text-2xl">{question.value}</div>
        {/* Daily Double indicators removed - revealed only when question is selected */}
      </div>
    </div>
  );
};