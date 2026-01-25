'use client';

import { useState, useEffect, useCallback } from 'react';
import type {
  GameListItem,
  GameListResponse,
  GameFilters,
  PaginationData,
} from '@/types/game.types';
import { logger } from '@/lib/logger';

interface UseGamesReturn {
  games: GameListItem[];
  loading: boolean;
  error: string | null;
  pagination: PaginationData | null;
  filters: GameFilters;
  updateFilters: (newFilters: Partial<GameFilters>) => void;
  deleteGame: (gameId: string) => Promise<void>;
  duplicateGame: (gameId: string) => Promise<void>;
  refetch: () => Promise<void>;
}

const DEFAULT_FILTERS: GameFilters = {
  search: '',
  status: 'all',
  sort: 'created_at',
  order: 'desc',
  page: 1,
};

export function useGames(): UseGamesReturn {
  const [games, setGames] = useState<GameListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<PaginationData | null>(null);
  const [filters, setFilters] = useState<GameFilters>(DEFAULT_FILTERS);

  const fetchGames = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: filters.page.toString(),
        limit: '12',
        search: filters.search,
        status: filters.status,
        sort: filters.sort,
        order: filters.order,
      });

      const response = await fetch(`/api/games?${params.toString()}`);

      if (!response.ok) {
        throw new Error('Failed to fetch games');
      }

      const data: GameListResponse = await response.json();
      setGames(data.data);
      setPagination(data.pagination);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      logger.error('Failed to fetch games', err, {
        operation: 'fetchGames',
        filters,
      });
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchGames();
  }, [fetchGames]);

  const updateFilters = useCallback((newFilters: Partial<GameFilters>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  }, []);

  const deleteGame = useCallback(async (gameId: string) => {
    try {
      const response = await fetch(`/api/games/${gameId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete game');
      }

      logger.info('Game deleted successfully', {
        operation: 'deleteGame',
        gameId,
      });

      // Refresh the games list
      await fetchGames();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete game';
      logger.error('Failed to delete game', err, {
        operation: 'deleteGame',
        gameId,
      });
      throw new Error(errorMessage);
    }
  }, [fetchGames]);

  const duplicateGame = useCallback(async (gameId: string) => {
    try {
      const response = await fetch(`/api/games/${gameId}/duplicate`, {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to duplicate game');
      }

      const data = await response.json();

      logger.info('Game duplicated successfully', {
        operation: 'duplicateGame',
        originalGameId: gameId,
        newGameId: data.game_id,
      });

      // Refresh the games list
      await fetchGames();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to duplicate game';
      logger.error('Failed to duplicate game', err, {
        operation: 'duplicateGame',
        gameId,
      });
      throw new Error(errorMessage);
    }
  }, [fetchGames]);

  const refetch = useCallback(async () => {
    await fetchGames();
  }, [fetchGames]);

  return {
    games,
    loading,
    error,
    pagination,
    filters,
    updateFilters,
    deleteGame,
    duplicateGame,
    refetch,
  };
}
