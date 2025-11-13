/**
 * @fileoverview Games tab component displaying user's created games.
 *
 * Fetches and displays a list of games created by the user.
 *
 * @module app/admin/users/[userId]/components/GamesTab
 */

'use client';

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import type { AdminUserGame } from '@/app/api/admin/users/[userId]/games/route';

interface GamesTabProps {
  userId: string;
}

/**
 * Response type for games API
 */
interface GamesResponse {
  data: AdminUserGame[];
  pagination: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

/**
 * Games tab component
 *
 * Displays a list of games created by the user with details:
 * - Game ID and creation date
 * - Question bank used
 * - Number of teams
 * - Game status
 * - Timer settings
 */
export default function GamesTab({ userId }: GamesTabProps) {
  const [gamesData, setGamesData] = useState<GamesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchGames() {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`/api/admin/users/${userId}/games`);
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to fetch games');
        }

        const data = await response.json();
        setGamesData(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    }

    fetchGames();
  }, [userId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-purple-600 border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"></div>
          <p className="mt-4 text-sm text-gray-600">Loading games...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 p-4">
        <div className="flex">
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">Error loading games</h3>
            <div className="mt-2 text-sm text-red-700">
              <p>{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!gamesData || gamesData.data.length === 0) {
    return (
      <div className="border border-gray-200 rounded-lg p-8 text-center">
        <p className="text-sm text-gray-500">No games created yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-900">
          Games Created ({gamesData.pagination.totalCount})
        </h3>
      </div>

      <div className="overflow-hidden border border-gray-200 rounded-lg">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Created
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Question Bank
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Teams
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Timer
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {gamesData.data.map((game) => (
              <tr key={game.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                  {game.created_at
                    ? format(new Date(game.created_at), 'MMM d, yyyy')
                    : '-'}
                </td>
                <td className="px-4 py-3 text-sm text-gray-900">
                  <div>
                    <div className="font-medium">
                      {game.bank_title || 'Unknown'}
                    </div>
                    {game.bank_subject && (
                      <div className="text-xs text-gray-500">
                        {game.bank_subject}
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                      game.status === 'completed'
                        ? 'bg-green-100 text-green-800'
                        : game.status === 'in_progress'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {game.status || 'pending'}
                  </span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                  {game.num_teams}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                  {game.timer_enabled
                    ? `${game.timer_seconds}s`
                    : 'Off'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
