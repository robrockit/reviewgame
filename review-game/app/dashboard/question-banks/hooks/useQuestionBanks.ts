import { useState, useEffect, useCallback } from 'react';
import type { QuestionBankListItem } from '@/types/question-bank.types';
import { logger } from '@/lib/logger';

/**
 * Custom hook for managing question banks.
 *
 * Provides CRUD operations and state management for question banks.
 * Handles loading states, errors, and automatic refetching.
 */
export function useQuestionBanks() {
  const [banks, setBanks] = useState<QuestionBankListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetches all question banks accessible by the current user.
   * Includes public banks and user's own custom banks.
   */
  const fetchBanks = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/question-banks');

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch question banks');
      }

      const { data } = await response.json();
      setBanks(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load question banks';
      setError(errorMessage);
      logger.error('Failed to fetch question banks', err, {
        operation: 'fetchQuestionBanks',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Creates a new custom question bank.
   *
   * @param data - Bank metadata (title, subject, description, difficulty)
   * @returns Created bank or null on error
   */
  const createBank = useCallback(async (data: {
    title: string;
    subject: string;
    description?: string;
    difficulty?: 'easy' | 'medium' | 'hard';
  }): Promise<QuestionBankListItem | null> => {
    try {
      const response = await fetch('/api/question-banks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create question bank');
      }

      const newBank = await response.json();

      // Add to local state
      setBanks((prev) => [...prev, newBank]);

      return newBank;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create question bank';
      setError(errorMessage);
      logger.error('Failed to create question bank', err, {
        operation: 'createQuestionBank',
      });
      throw err;
    }
  }, []);

  /**
   * Updates an existing question bank's metadata.
   *
   * @param bankId - ID of the bank to update
   * @param data - Fields to update
   * @returns Updated bank or null on error
   */
  const updateBank = useCallback(async (
    bankId: string,
    data: {
      title?: string;
      subject?: string;
      description?: string | null;
      difficulty?: 'easy' | 'medium' | 'hard' | null;
    }
  ): Promise<QuestionBankListItem | null> => {
    try {
      const response = await fetch(`/api/question-banks/${bankId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update question bank');
      }

      const updatedBank = await response.json();

      // Update local state
      setBanks((prev) =>
        prev.map((bank) => (bank.id === bankId ? updatedBank : bank))
      );

      return updatedBank;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update question bank';
      setError(errorMessage);
      logger.error('Failed to update question bank', err, {
        operation: 'updateQuestionBank',
        bankId,
      });
      throw err;
    }
  }, []);

  /**
   * Deletes a question bank and all its questions.
   *
   * @param bankId - ID of the bank to delete
   */
  const deleteBank = useCallback(async (bankId: string): Promise<void> => {
    try {
      const response = await fetch(`/api/question-banks/${bankId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete question bank');
      }

      // Remove from local state
      setBanks((prev) => prev.filter((bank) => bank.id !== bankId));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete question bank';
      setError(errorMessage);
      logger.error('Failed to delete question bank', err, {
        operation: 'deleteQuestionBank',
        bankId,
      });
      throw err;
    }
  }, []);

  /**
   * Duplicates a question bank with all its questions.
   *
   * @param bankId - ID of the bank to duplicate
   * @returns Newly created bank or null on error
   */
  const duplicateBank = useCallback(async (bankId: string): Promise<QuestionBankListItem | null> => {
    try {
      const response = await fetch(`/api/question-banks/${bankId}/duplicate`, {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to duplicate question bank');
      }

      const newBank = await response.json();

      // Add to local state
      setBanks((prev) => [...prev, newBank]);

      return newBank;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to duplicate question bank';
      setError(errorMessage);
      logger.error('Failed to duplicate question bank', err, {
        operation: 'duplicateQuestionBank',
        bankId,
      });
      throw err;
    }
  }, []);

  // Fetch banks on mount
  useEffect(() => {
    fetchBanks();
  }, [fetchBanks]);

  return {
    banks,
    loading,
    error,
    createBank,
    updateBank,
    deleteBank,
    duplicateBank,
    refetch: fetchBanks,
  };
}
