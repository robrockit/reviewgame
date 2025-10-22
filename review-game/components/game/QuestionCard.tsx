import React from 'react';

// Define the structure for a question, matching GameBoard's definition
interface Question {
  id: string;
  value: number;
  text: string;
  isUsed: boolean;
  isDailyDouble?: boolean; // For teacher view
}

interface QuestionCardProps {
  question: Question;
  onSelect: (question: Question) => void;
}

export const QuestionCard: React.FC<QuestionCardProps> = ({ question, onSelect }) => {
  const handleClick = () => {
    onSelect(question);
  };

  // Apply styling for used questions and Daily Doubles
  const cardClasses = `
    question-card
    p-4
    bg-blue-600
    text-white
    font-bold
    flex
    items-center
    justify-center
    cursor-pointer
    transition-all
    duration-300
    ease-in-out
    rounded
    shadow-md
    hover:bg-blue-700
    ${question.isUsed ? 'bg-gray-500 cursor-not-allowed opacity-70' : ''}
    ${question.isDailyDouble ? 'bg-green-600 hover:bg-green-700' : ''}
  `;

  return (
    <div className={cardClasses} onClick={handleClick}>
      <div className="card-content">
        <div className="question-value">{question.value}</div>
        {/* Optionally display Daily Double indicator */}
        {question.isDailyDouble && (
          <div className="daily-double-indicator absolute top-1 right-1 text-xs bg-yellow-400 text-black px-1 rounded">
            DD
          </div>
        )}
      </div>
    </div>
  );
};