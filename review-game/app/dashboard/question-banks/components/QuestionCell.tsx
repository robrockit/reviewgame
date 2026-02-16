'use client';

import { useState } from 'react';
import { PlusIcon } from '@heroicons/react/24/outline';
import type { Question } from '@/types/question-bank.types';

interface QuestionCellProps {
  category: string;
  pointValue: number;
  question?: Question;
  isEditable: boolean;
  onClick: () => void;
}

/**
 * Individual cell in the question grid.
 *
 * Shows "+ Add" button when empty, or question preview when filled.
 * Supports hover tooltips with full question/answer text.
 */
export default function QuestionCell({
  pointValue,
  question,
  isEditable,
  onClick,
}: QuestionCellProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  if (!question) {
    // Empty cell
    return (
      <button
        onClick={onClick}
        disabled={!isEditable}
        className={`w-full h-32 flex flex-col items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors ${
          isEditable ? 'cursor-pointer' : 'cursor-default'
        }`}
      >
        {isEditable ? (
          <>
            <PlusIcon className="h-8 w-8 mb-2" aria-hidden="true" />
            <span className="text-sm font-medium">Add Question</span>
          </>
        ) : (
          <span className="text-sm">—</span>
        )}
      </button>
    );
  }

  // Filled cell
  return (
    <div className="relative">
      <button
        onClick={onClick}
        disabled={!isEditable}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className={`w-full h-32 flex flex-col items-center justify-center p-4 hover:bg-indigo-50 transition-colors ${
          isEditable ? 'cursor-pointer' : 'cursor-default'
        }`}
      >
        {/* Point Value Badge */}
        <div className="mb-2">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-lg font-bold bg-indigo-100 text-indigo-800">
            ${pointValue}
          </span>
        </div>

        {/* Question Preview */}
        <p className="text-xs text-gray-600 text-center line-clamp-2 max-w-full">
          {question.question_text}
        </p>

        {/* Image Indicator */}
        {question.image_url && (
          <span className="mt-2 text-xs text-purple-600 font-medium">
            📷 Image
          </span>
        )}
      </button>

      {/* Tooltip on Hover */}
      {showTooltip && (
        <div className="absolute z-10 w-80 p-4 bg-gray-900 text-white text-sm rounded-lg shadow-xl top-full left-1/2 transform -translate-x-1/2 mt-2 pointer-events-none">
          <div className="mb-2">
            <span className="font-semibold text-indigo-300">Question:</span>
            <p className="mt-1">{question.question_text}</p>
          </div>
          <div className="mb-2">
            <span className="font-semibold text-green-300">Answer:</span>
            <p className="mt-1">{question.answer_text}</p>
          </div>
          {question.teacher_notes && (
            <div>
              <span className="font-semibold text-yellow-300">Notes:</span>
              <p className="mt-1 text-xs">{question.teacher_notes}</p>
            </div>
          )}
          {question.image_url && (
            <div className="mt-2">
              <span className="font-semibold text-purple-300">Image URL:</span>
              <p className="mt-1 text-xs truncate">{question.image_url}</p>
            </div>
          )}
          {/* Tooltip Arrow */}
          <div className="absolute w-3 h-3 bg-gray-900 transform rotate-45 -top-1.5 left-1/2 -translate-x-1/2"></div>
        </div>
      )}
    </div>
  );
}
