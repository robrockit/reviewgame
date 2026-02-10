import { useState, useEffect, useCallback } from 'react';
import type { Question, QuestionGridData } from '@/types/question-bank.types';
import { logger } from '@/lib/logger';

/**
 * Transforms a flat array of questions into a nested grid structure
 * organized by category and point value.
 */
function transformToGrid(questionsArray: Question[]): QuestionGridData {
  const grid: QuestionGridData = {};

  questionsArray.forEach((question) => {
    if (!grid[question.category]) {
      grid[question.category] = {};
    }
    grid[question.category][question.point_value] = question;
  });

  return grid;
}

/**
 * Custom hook for managing questions within a question bank.
 *
 * Provides CRUD operations for questions and transforms them into a grid structure
 * for the Jeopardy-style 7×5 display.
 */
export function useQuestions({ bankId }: { bankId: string }) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [gridData, setGridData] = useState<QuestionGridData>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetches all questions for the current bank.
   */
  const fetchQuestions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/question-banks/${bankId}/questions`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch questions');
      }

      const { data } = await response.json();
      setQuestions(data);
      setGridData(transformToGrid(data));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load questions';
      setError(errorMessage);
      logger.error('Failed to fetch questions', err, {
        operation: 'fetchQuestions',
        bankId,
      });
    } finally {
      setLoading(false);
    }
  }, [bankId]);

  /**
   * Creates a new question in the bank.
   *
   * @param data - Question data
   * @returns Created question or null on error
   */
  const createQuestion = useCallback(async (data: {
    category: string;
    point_value: number;
    question_text: string;
    answer_text: string;
    teacher_notes?: string;
    image_url?: string;
  }): Promise<Question | null> => {
    try {
      const response = await fetch(`/api/question-banks/${bankId}/questions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create question');
      }

      const newQuestion = await response.json();

      // Add to local state using functional updates to avoid stale closures
      setQuestions(prev => [...prev, newQuestion]);
      setGridData(prev => ({
        ...prev,
        [newQuestion.category]: {
          ...prev[newQuestion.category],
          [newQuestion.point_value]: newQuestion,
        },
      }));

      return newQuestion;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create question';
      setError(errorMessage);
      logger.error('Failed to create question', err, {
        operation: 'createQuestion',
        bankId,
      });
      throw err;
    }
  }, [bankId]);

  /**
   * Updates an existing question.
   *
   * @param questionId - ID of the question to update
   * @param data - Fields to update
   * @returns Updated question or null on error
   */
  const updateQuestion = useCallback(async (
    questionId: string,
    data: {
      category?: string;
      point_value?: number;
      question_text?: string;
      answer_text?: string;
      teacher_notes?: string | null;
      image_url?: string | null;
    }
  ): Promise<Question | null> => {
    try {
      const response = await fetch(`/api/questions/${questionId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update question');
      }

      const updatedQuestion = await response.json();

      // Update local state using functional updates to avoid stale closures
      setQuestions(prev => prev.map((q) =>
        q.id === questionId ? updatedQuestion : q
      ));
      setGridData(prev => {
        // Find and remove old position (handles category/point_value changes)
        const newGrid = { ...prev };

        for (const category in newGrid) {
          for (const pointValue in newGrid[category]) {
            if (newGrid[category][Number(pointValue)].id === questionId) {
              const categoryData = { ...newGrid[category] };
              delete categoryData[Number(pointValue)];

              if (Object.keys(categoryData).length === 0) {
                delete newGrid[category];
              } else {
                newGrid[category] = categoryData;
              }
              break;
            }
          }
        }

        // Add updated question to new position
        return {
          ...newGrid,
          [updatedQuestion.category]: {
            ...newGrid[updatedQuestion.category],
            [updatedQuestion.point_value]: updatedQuestion,
          },
        };
      });

      return updatedQuestion;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update question';
      setError(errorMessage);
      logger.error('Failed to update question', err, {
        operation: 'updateQuestion',
        questionId,
      });
      throw err;
    }
  }, []);

  /**
   * Deletes a question.
   *
   * @param questionId - ID of the question to delete
   */
  const deleteQuestion = useCallback(async (questionId: string): Promise<void> => {
    try {
      const response = await fetch(`/api/questions/${questionId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete question');
      }

      // Remove from local state using functional updates to avoid stale closures
      setQuestions(prev => prev.filter((q) => q.id !== questionId));
      setGridData(prev => {
        // Find and remove question from grid
        const newGrid = { ...prev };

        for (const category in newGrid) {
          for (const pointValue in newGrid[category]) {
            if (newGrid[category][Number(pointValue)].id === questionId) {
              const categoryData = { ...newGrid[category] };
              delete categoryData[Number(pointValue)];

              if (Object.keys(categoryData).length === 0) {
                delete newGrid[category];
              } else {
                newGrid[category] = categoryData;
              }
              return newGrid;
            }
          }
        }

        return prev; // Question not found (shouldn't happen)
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete question';
      setError(errorMessage);
      logger.error('Failed to delete question', err, {
        operation: 'deleteQuestion',
        questionId,
      });
      throw err;
    }
  }, []);

  /**
   * Gets all categories currently in the grid.
   */
  const getCategories = useCallback((): string[] => {
    return Object.keys(gridData).sort();
  }, [gridData]);

  // Fetch questions on mount
  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  return {
    questions,
    gridData,
    loading,
    error,
    createQuestion,
    updateQuestion,
    deleteQuestion,
    getCategories,
    refetch: fetchQuestions,
  };
}
