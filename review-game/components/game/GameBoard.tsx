/**
 * @fileoverview Game board component displaying categories and questions.
 *
 * This component renders the main Jeopardy-style game board with category headers
 * and question cards arranged in a grid. It handles question selection and marking
 * questions as used.
 *
 * @module components/game/GameBoard
 */

"use client";
import React from 'react';
import { useGameStore } from '../../lib/stores/gameStore';
import { QuestionCard } from './QuestionCard';
import { Question } from '../../types/game';

/**
 * Props for the GameBoard component.
 *
 * @interface GameBoardProps
 * @property {function} [onQuestionSelect] - Optional callback when a question is selected
 */
interface GameBoardProps {
  onQuestionSelect?: (question: Question) => void;
}

/**
 * GameBoard component displaying the Jeopardy-style game board.
 *
 * This component:
 * - Displays categories in a horizontal row
 * - Shows questions in columns under each category
 * - Handles question selection and marks them as used
 * - Broadcasts question selections via the optional callback
 * - Shows a loading state while game data is being fetched
 *
 * The board uses a CSS grid layout with 7 columns (for 7 categories) and
 * automatically sizes rows based on content.
 *
 * @param {GameBoardProps} props - Component props
 * @returns {JSX.Element} The rendered game board
 *
 * @example
 * ```tsx
 * <GameBoard onQuestionSelect={(question) => {
 *   broadcastQuestionSelected(question);
 * }} />
 * ```
 */
export const GameBoard = ({ onQuestionSelect }: GameBoardProps) => {
  const { currentGameData, markQuestionUsed, setCurrentQuestion } = useGameStore();

  // Get categories from store (set by the page component)
  const categories = currentGameData?.categories || [];

  // If no data yet, show loading state
  if (categories.length === 0) {
    return (
      <div className="game-board flex items-center justify-center p-8">
        <div className="text-center">
          <p className="text-gray-400 text-lg">No questions loaded yet...</p>
          <p className="text-gray-500 text-sm mt-2">Fetching game data...</p>
        </div>
      </div>
    );
  }

  /**
   * Handles question selection by marking it as used and broadcasting to clients.
   *
   * @param {Question} question - The question that was selected
   */
  const handleQuestionSelect = (question: Question) => {
    if (!question.isUsed) {
      // Mark the question as used and set it as the current question
      markQuestionUsed(question.id);
      setCurrentQuestion(question);

      // Broadcast the question selection to all connected clients
      if (onQuestionSelect) {
        onQuestionSelect(question);
      }
    }
  };

  return (
    <div className="game-board">
      {/* Use CSS Grid with auto rows to ensure all headers have equal height */}
      <div className="grid grid-cols-7 gap-3 auto-rows-auto">
        {/* Render Category Headers in first row */}
        {categories.map((category) => (
          <div
            key={`header-${category.id}`}
            className="category-header p-4 bg-blue-600 text-white font-bold text-center flex items-center justify-center rounded-lg shadow-lg text-lg break-words"
          >
            {category.name}
          </div>
        ))}

        {/* Render Questions - each column of questions follows */}
        {categories.map((category) => (
          <div key={`questions-${category.id}`} className="flex flex-col gap-3">
            {category.questions.map((question) => (
              <QuestionCard
                key={question.id}
                question={question}
                onSelect={handleQuestionSelect}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};