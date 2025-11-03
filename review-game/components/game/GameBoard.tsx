"use client";
import React from 'react';
import { useGameStore } from '../../lib/stores/gameStore';
import { QuestionCard } from './QuestionCard';
import { Question } from '../../types/game';

export const GameBoard = () => {
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
    }
  };

  return (
    <div className="game-board">
      <div className="grid grid-cols-7 gap-3">
        {/* Render Categories - each category is a column */}
        {categories.map((category) => (
          <div key={category.id} className="flex flex-col gap-3">
            {/* Category Header */}
            <div className="category-header p-4 bg-blue-600 text-white font-bold text-center flex items-center justify-center min-h-[80px] rounded-lg shadow-lg text-lg">
              {category.name}
            </div>
            {/* Render Questions for this Category */}
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