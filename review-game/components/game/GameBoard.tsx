"use client";
import React from 'react';
import { useGameStore } from '../../lib/stores/gameStore';
import { QuestionCard } from './QuestionCard';
import { Question } from '../../types/game';

interface GameBoardProps {
  onQuestionSelect?: (question: Question) => void;
}

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

  // Function to handle question selection
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