'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

interface JoinPageProps {
  params: {
    gameId: string;
  };
}

/**
 * Team Join Flow Component
 *
 * Allows students to join a game via QR code or manual URL entry.
 * Implements specifications from Phase 8, Section 8.1.
 *
 * Features:
 * - Validates game exists and is not full
 * - Generates unique device ID
 * - Creates team record with pending status
 * - Stores device ID in localStorage
 * - Redirects to waiting room
 *
 * @param params - Contains the gameId from the URL
 */
export default function JoinGamePage({ params }: JoinPageProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gameInfo, setGameInfo] = useState<{ title: string } | null>(null);
  const { gameId } = params;

  // Validate gameId on mount
  useEffect(() => {
    const validateGame = async () => {
      if (!gameId || typeof gameId !== 'string') {
        setError('Invalid game link. Please check the URL and try again.');
        return;
      }

      try {
        const supabase = createClient();

        // Fetch game details to validate it exists
        const { data: game, error: gameError } = await supabase
          .from('games')
          .select('id, bank_id, num_teams, status, question_banks(title)')
          .eq('id', gameId)
          .single();

        if (gameError || !game) {
          setError('Game not found. Please check the link and try again.');
          return;
        }

        // Check if game is already completed
        if (game.status === 'completed') {
          setError('This game has already ended.');
          return;
        }

        // Count existing teams to check if game is full
        const { count, error: countError } = await supabase
          .from('teams')
          .select('*', { count: 'exact', head: true })
          .eq('game_id', gameId);

        if (countError) {
          console.error('Error counting teams:', countError);
          setError('Unable to check game availability. Please try again.');
          return;
        }

        if (count !== null && count >= game.num_teams) {
          setError(`This game is full (${game.num_teams} teams maximum).`);
          return;
        }

        // Set game info for display
        const questionBank = game.question_banks as unknown as { title: string } | null;
        setGameInfo({
          title: questionBank?.title || 'Review Game',
        });
      } catch (err) {
        console.error('Unexpected error validating game:', err);
        setError('An unexpected error occurred. Please try again.');
      }
    };

    validateGame();
  }, [gameId]);

  /**
   * Generates a unique device ID using crypto.randomUUID()
   * Falls back to timestamp-based ID if crypto is unavailable
   */
  const generateDeviceId = (): string => {
    if (typeof window !== 'undefined' && window.crypto && window.crypto.randomUUID) {
      return window.crypto.randomUUID();
    }
    // Fallback for browsers without crypto.randomUUID
    return `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  /**
   * Handles the join game process
   * Creates a team record and redirects to waiting room
   */
  const handleJoinGame = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const supabase = createClient();

      // Check for existing device ID in localStorage
      let deviceId = localStorage.getItem('deviceId');

      // Check if this device already has a team in this game
      if (deviceId) {
        const { data: existingTeam } = await supabase
          .from('teams')
          .select('id, team_number, connection_status')
          .eq('game_id', gameId)
          .eq('device_id', deviceId)
          .single();

        if (existingTeam) {
          // Device already joined this game - redirect to waiting room or game
          if (existingTeam.connection_status === 'approved') {
            router.push(`/game/team/${existingTeam.id}`);
          } else {
            router.push(`/game/team/waiting/${existingTeam.id}`);
          }
          return;
        }
      }

      // Generate new device ID if not exists
      if (!deviceId) {
        deviceId = generateDeviceId();
        localStorage.setItem('deviceId', deviceId);
      }

      // Get the next team number
      const { count, error: countError } = await supabase
        .from('teams')
        .select('*', { count: 'exact', head: true })
        .eq('game_id', gameId);

      if (countError) {
        throw new Error('Failed to determine team number');
      }

      const teamNumber = (count || 0) + 1;

      // Create team record with pending status
      const { data: team, error: createError } = await supabase
        .from('teams')
        .insert({
          game_id: gameId,
          team_number: teamNumber,
          device_id: deviceId,
          connection_status: 'pending',
          score: 0,
          last_seen: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (createError || !team) {
        console.error('Error creating team:', createError);
        throw new Error('Failed to join game. Please try again.');
      }

      // Redirect to waiting room
      router.push(`/game/team/waiting/${team.id}`);
    } catch (err) {
      console.error('Error joining game:', err);
      setError(
        err instanceof Error ? err.message : 'Failed to join game. Please try again.'
      );
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-blue-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Join Game
          </h1>
          {gameInfo && (
            <p className="text-lg text-gray-600">
              {gameInfo.title}
            </p>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border-2 border-red-200 rounded-lg">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg
                  className="h-6 w-6 text-red-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">
                  Unable to Join Game
                </h3>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Instructions */}
        {!error && (
          <div className="mb-8 p-4 bg-blue-50 rounded-lg">
            <h2 className="text-sm font-semibold text-blue-900 mb-2">
              📱 Before You Join:
            </h2>
            <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
              <li>Make sure you are connected to the internet</li>
              <li>Keep this tab open during the game</li>
              <li>Wait for your teacher to approve your team</li>
            </ul>
          </div>
        )}

        {/* Join Button */}
        <button
          onClick={handleJoinGame}
          disabled={isLoading || !!error}
          className={`
            w-full py-4 px-6 rounded-xl text-lg font-bold text-white
            transition-all duration-200 transform
            ${
              isLoading || error
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 active:scale-95 shadow-lg hover:shadow-xl'
            }
          `}
        >
          {isLoading ? (
            <div className="flex items-center justify-center">
              <svg
                className="animate-spin h-6 w-6 mr-3"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Joining...
            </div>
          ) : (
            '🎮 Join Game'
          )}
        </button>

        {/* Footer Info */}
        <div className="mt-6 text-center text-xs text-gray-500">
          <p>Your device will be assigned a team number</p>
          <p className="mt-1">after your teacher approves it</p>
        </div>
      </div>
    </div>
  );
}
