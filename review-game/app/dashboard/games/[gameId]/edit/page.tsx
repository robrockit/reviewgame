'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { logger } from '@/lib/logger';

interface GameData {
  id: string;
  bank_id: string;
  bank_title: string;
  num_teams: number;
  team_names: string[] | null;
  timer_enabled: boolean;
  timer_seconds: number | null;
  started_at: string | null;
}

export default function EditGamePage() {
  const router = useRouter();
  const params = useParams();
  const gameId = params?.gameId as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [game, setGame] = useState<GameData | null>(null);

  // Form state
  const [teamNames, setTeamNames] = useState<string[]>([]);
  const [timerEnabled, setTimerEnabled] = useState(true);
  const [timerSeconds, setTimerSeconds] = useState(30);

  // Fetch game data
  useEffect(() => {
    const fetchGame = async () => {
      try {
        const response = await fetch(`/api/games?limit=1`);
        if (!response.ok) {
          throw new Error('Failed to fetch game');
        }

        const data = await response.json();
        // Find the game by ID
        const foundGame = data.data.find((g: GameData) => g.id === gameId);

        if (!foundGame) {
          throw new Error('Game not found');
        }

        setGame(foundGame);
        setTeamNames(foundGame.team_names || Array.from({ length: foundGame.num_teams }, (_, i) => `Team ${i + 1}`));
        setTimerEnabled(foundGame.timer_enabled);
        setTimerSeconds(foundGame.timer_seconds || 30);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load game';
        setError(errorMessage);
        logger.error('Failed to fetch game for editing', err, {
          operation: 'fetchGameForEdit',
          gameId,
        });
      } finally {
        setLoading(false);
      }
    };

    if (gameId) {
      fetchGame();
    }
  }, [gameId]);

  const handleTeamNameChange = (index: number, value: string) => {
    const newTeamNames = [...teamNames];
    newTeamNames[index] = value;
    setTeamNames(newTeamNames);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/games/${gameId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          team_names: teamNames,
          timer_enabled: timerEnabled,
          timer_seconds: timerEnabled ? timerSeconds : null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update game');
      }

      logger.info('Game updated successfully', {
        operation: 'updateGame',
        gameId,
      });

      // Redirect back to games list
      router.push('/dashboard/games');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save changes';
      setError(errorMessage);
      logger.error('Failed to update game', err, {
        operation: 'updateGame',
        gameId,
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-sm text-gray-600">Loading game...</p>
        </div>
      </div>
    );
  }

  if (error && !game) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600">{error}</p>
          <Link
            href="/dashboard/games"
            className="mt-4 inline-flex items-center text-sm text-indigo-600 hover:text-indigo-500"
          >
            <ArrowLeftIcon className="h-4 w-4 mr-1" />
            Back to Games
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/dashboard/games"
            className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-4"
          >
            <ArrowLeftIcon className="h-4 w-4 mr-1" />
            Back to Games
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Edit Game Settings</h1>
          <p className="mt-2 text-sm text-gray-600">
            Modify team names and timer settings for: <strong>{game?.bank_title}</strong>
          </p>
          {game?.started_at && (
            <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-sm text-yellow-800">
                <strong>Note:</strong> This game has already started. Some settings cannot be changed.
              </p>
            </div>
          )}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white shadow rounded-lg">
          <div className="px-6 py-5 space-y-6">
            {/* Team Names */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Team Names</h3>
              <div className="space-y-3">
                {teamNames.map((name, index) => (
                  <div key={index}>
                    <label htmlFor={`team-${index}`} className="block text-sm font-medium text-gray-700 mb-1">
                      Team {index + 1}
                    </label>
                    <input
                      type="text"
                      id={`team-${index}`}
                      value={name}
                      onChange={(e) => handleTeamNameChange(index, e.target.value)}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      placeholder={`Team ${index + 1}`}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Timer Settings */}
            <div className="border-t border-gray-200 pt-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Timer Settings</h3>

              <div className="space-y-4">
                {/* Timer Enabled Toggle */}
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="timer-enabled"
                    checked={timerEnabled}
                    onChange={(e) => setTimerEnabled(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <label htmlFor="timer-enabled" className="ml-3 block text-sm font-medium text-gray-700">
                    Enable question timer
                  </label>
                </div>

                {/* Timer Seconds Input */}
                {timerEnabled && (
                  <div>
                    <label htmlFor="timer-seconds" className="block text-sm font-medium text-gray-700 mb-1">
                      Seconds per question
                    </label>
                    <input
                      type="number"
                      id="timer-seconds"
                      min="10"
                      max="120"
                      value={timerSeconds}
                      onChange={(e) => setTimerSeconds(parseInt(e.target.value, 10))}
                      className="block w-full max-w-xs rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    />
                    <p className="mt-1 text-xs text-gray-500">Between 10 and 120 seconds</p>
                  </div>
                )}
              </div>
            </div>

            {/* Error Display */}
            {error && (
              <div className="border-t border-gray-200 pt-6">
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-sm text-red-800">
                    <strong>Error:</strong> {error}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Form Actions */}
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 rounded-b-lg flex items-center justify-end gap-3">
            <Link
              href="/dashboard/games"
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
