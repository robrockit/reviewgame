'use client';

import type { QuestionGridData } from '@/types/question-bank.types';
import { JEOPARDY_GRID } from '@/lib/constants/question-banks';
import QuestionCell from './QuestionCell';

interface QuestionGridProps {
  gridData: QuestionGridData;
  categories: string[];
  isEditable: boolean;
  onCellClick: (category: string, pointValue: number) => void;
}

/**
 * Jeopardy-style 7×5 question grid.
 *
 * Displays questions organized by category (columns) and point value (rows).
 * Supports editing mode for owners.
 */
export default function QuestionGrid({
  gridData,
  categories,
  isEditable,
  onCellClick,
}: QuestionGridProps) {
  // Ensure we have exactly 7 categories (fill with empty strings if needed)
  const displayCategories = [...categories];
  while (displayCategories.length < JEOPARDY_GRID.CATEGORIES) {
    displayCategories.push(`Category ${displayCategories.length + 1}`);
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-collapse bg-white shadow-lg rounded-lg overflow-hidden">
        <thead>
          <tr className="bg-indigo-700">
            {displayCategories.slice(0, JEOPARDY_GRID.CATEGORIES).map((category, index) => (
              <th
                key={index}
                className="px-4 py-4 text-left text-sm font-semibold text-white uppercase tracking-wider border-r border-indigo-600 last:border-r-0"
              >
                {category}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {JEOPARDY_GRID.POINT_VALUES.map((pointValue) => (
            <tr key={pointValue}>
              {displayCategories.slice(0, JEOPARDY_GRID.CATEGORIES).map((category, categoryIndex) => {
                const question = gridData[category]?.[pointValue];

                return (
                  <td
                    key={categoryIndex}
                    className="border-r border-gray-200 last:border-r-0 p-0"
                  >
                    <QuestionCell
                      category={category}
                      pointValue={pointValue}
                      question={question}
                      isEditable={isEditable}
                      onClick={() => onCellClick(category, pointValue)}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Grid Info */}
      <div className="mt-4 text-sm text-gray-600">
        <p>
          Grid: {JEOPARDY_GRID.CATEGORIES} categories × {JEOPARDY_GRID.QUESTIONS_PER_CATEGORY} questions = {JEOPARDY_GRID.CATEGORIES * JEOPARDY_GRID.QUESTIONS_PER_CATEGORY} total slots
        </p>
        <p className="mt-1">
          Questions filled: {Object.values(gridData).reduce((total, category) => total + Object.keys(category).length, 0)} / {JEOPARDY_GRID.CATEGORIES * JEOPARDY_GRID.QUESTIONS_PER_CATEGORY}
        </p>
      </div>
    </div>
  );
}
