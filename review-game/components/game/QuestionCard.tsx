import React from 'react';
import { Question } from '../../types/game';

interface QuestionCardProps {
  question: Question;
  onSelect: (question: Question) => void;
}

export const QuestionCard: React.FC<QuestionCardProps> = ({ question, onSelect }) => {
  const handleClick = () => {
    onSelect(question);
  };

  // Apply styling for used questions - Daily Doubles hidden until selected
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