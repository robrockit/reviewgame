'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { BuzzButton, BuzzButtonState } from '@/components/student/BuzzButton';
import { useBuzzer } from '@/hooks/useBuzzer';
import { useGameStore } from '@/lib/stores/gameStore';
import type { Tables } from '@/types/database.types';

type Game = Tables<'games'>;
type Team = Tables<'teams'>;

export default function StudentGamePage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();

  const gameId = params?.gameId as string;
  const teamId = params?.teamId as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [game, setGame] = useState<Game | null>(null);
  const [team, setTeam] = useState<Team | null>(null);
  const [buzzButtonState, setBuzzButtonState] = useState<BuzzButtonState>('waiting');
  const [queuePosition, setQueuePosition] = useState<number | null>(null);

  // Use buzzer hook for real-time buzz events
  const { sendBuzz } = useBuzzer(gameId);

  // Get buzz queue from game store
  const { buzzQueue } = useGameStore();

  // Fetch game and team data
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch game
        const { data: gameData, error: gameError } = await supabase
          .from('games')
          .select('*')
          .eq('id', gameId)
          .single();

        if (gameError) throw gameError;

        // Fetch team
        const { data: teamData, error: teamError } = await supabase
          .from('teams')
          .select('*')
          .eq('id', teamId)
          .single();

        if (teamError) throw teamError;

        // Verify team belongs to this game
        if (teamData.game_id !== gameId) {
          throw new Error('Team does not belong to this game');
        }

        setGame(gameData);
        setTeam(teamData);

        // Set initial buzz button state based on game status
        if (gameData.status === 'setup') {
          setBuzzButtonState('waiting');
        } else if (gameData.status === 'active') {
          // TODO: Will be updated based on question state
          setBuzzButtonState('active');
        } else {
          setBuzzButtonState('waiting');
        }

        setLoading(false);
      } catch (err) {
        console.error('Error fetching data:', err);
        const message = err instanceof Error ? err.message : 'Failed to load game';
        setError(message);
        setLoading(false);
      }
    };

    if (gameId && teamId) {
      fetchData();
    }
  }, [gameId, teamId, supabase]);

  // Set up real-time subscriptions
  useEffect(() => {
    if (!gameId || !teamId) return;

    console.log('Setting up real-time subscriptions for student view');

    // Subscribe to game updates
    const gameChannel = supabase
      .channel(`game:${gameId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'games',
          filter: `id=eq.${gameId}`,
        },
        (payload) => {
          console.log('Game updated:', payload);
          const updatedGame = payload.new as Game;
          setGame(updatedGame);

          // Update button state based on game status
          if (updatedGame.status === 'setup') {
            setBuzzButtonState('waiting');
          } else if (updatedGame.status === 'active') {
            // TODO: Will be based on actual question state
            setBuzzButtonState('active');
          } else if (updatedGame.status === 'completed') {
            setBuzzButtonState('waiting');
          }
        }
      )
      .subscribe((status) => {
        console.log('Game subscription status:', status);
      });

    // Subscribe to team updates (for score changes)
    const teamChannel = supabase
      .channel(`team:${teamId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'teams',
          filter: `id=eq.${teamId}`,
        },
        (payload) => {
          console.log('Team updated:', payload);
          setTeam(payload.new as Team);
        }
      )
      .subscribe((status) => {
        console.log('Team subscription status:', status);
      });

    // Cleanup
    return () => {
      console.log('Cleaning up subscriptions');
      supabase.removeChannel(gameChannel);
      supabase.removeChannel(teamChannel);
    };
  }, [gameId, teamId, supabase]);

  // Monitor buzz queue to update button state and position
  useEffect(() => {
    if (!teamId) return;

    // Find this team's position in the buzz queue
    const position = buzzQueue.findIndex(buzz => buzz.teamId === teamId);

    if (position === -1) {
      // Team not in queue
      setQueuePosition(null);
      // Only set to active if game is active, otherwise keep current state
      if (game?.status === 'active' && buzzButtonState !== 'waiting') {
        setBuzzButtonState('active');
      }
    } else {
      // Team is in queue
      const pos = position + 1; // Convert to 1-based position
      setQueuePosition(pos);

      if (pos === 1) {
        // First in queue - it's their turn to answer
        setBuzzButtonState('answering');
      } else {
        // In queue but not first
        setBuzzButtonState('buzzed');
      }
    }
  }, [buzzQueue, teamId, game?.status, buzzButtonState]);

  // Handle buzz button press
  const handleBuzz = async () => {
    console.log('Buzz button pressed!');

    if (!teamId) {
      console.error('Cannot buzz: teamId is not available');
      return;
    }

    // Send buzz event via Supabase broadcast channel
    sendBuzz(teamId);

    // The buzz queue tracking effect will automatically update the button state
    // based on the team's position in the queue
  };

  // Render loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-purple-50 to-blue-50">
        <div className="text-lg">Loading game...</div>
      </div>
    );
  }

  // Render error state
  if (error || !game || !team) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center bg-white rounded-lg shadow-lg p-8 max-w-md">
          <div className="text-6xl mb-4">❌</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Error</h1>
          <p className="text-gray-700 mb-6">{error || 'Game not found'}</p>
          <button
            onClick={() => router.push('/')}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  // Render waiting for game to start
  if (game.status === 'setup') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-purple-50 to-blue-50">
        <div className="text-center bg-white rounded-lg shadow-lg p-8 max-w-lg">
          <div className="text-6xl mb-4">⏳</div>
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            {team.team_name || `Team ${team.team_number}`}
          </h1>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <p className="text-blue-900 font-semibold">Current Score</p>
            <p className="text-4xl font-bold text-blue-600">{team.score || 0}</p>
          </div>
          <p className="text-gray-700 text-lg mb-2">Waiting for game to start...</p>
          <p className="text-gray-600 text-sm">
            The teacher will start the game when all teams are ready.
          </p>
          <div className="mt-6 flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </div>
      </div>
    );
  }

  // Render game completed
  if (game.status === 'completed') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-green-50 to-blue-50">
        <div className="text-center bg-white rounded-lg shadow-lg p-8 max-w-lg">
          <div className="text-6xl mb-4">🎉</div>
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Game Complete!</h1>
          <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
            <p className="text-green-900 font-semibold mb-2">
              {team.team_name || `Team ${team.team_number}`}
            </p>
            <p className="text-gray-600 mb-1">Final Score</p>
            <p className="text-5xl font-bold text-green-600">{team.score || 0}</p>
          </div>
          <p className="text-gray-600">
            Thank you for playing!
          </p>
        </div>
      </div>
    );
  }

  // Render active game interface
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header - Team Info */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {team.team_name || `Team ${team.team_number}`}
              </h1>
              <p className="text-gray-600 mt-1">Ready to play!</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600 mb-1">Current Score</p>
              <p className="text-5xl font-bold text-blue-600">{team.score || 0}</p>
            </div>
          </div>
        </div>

        {/* Main Game Area */}
        <div className="flex flex-col items-center justify-center py-12">
          {/* Status Message */}
          <div className="mb-8 text-center">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              {buzzButtonState === 'waiting' && 'Waiting for question...'}
              {buzzButtonState === 'active' && 'Ready to buzz in!'}
              {buzzButtonState === 'buzzed' && 'You buzzed in!'}
              {buzzButtonState === 'answering' && 'Your turn to answer!'}
            </h2>
            <p className="text-gray-600">
              {buzzButtonState === 'waiting' && 'The teacher will present the next question soon.'}
              {buzzButtonState === 'active' && 'Press the button when you know the answer!'}
              {buzzButtonState === 'buzzed' && 'Waiting for teacher to acknowledge...'}
              {buzzButtonState === 'answering' && 'Give your answer out loud to the teacher.'}
            </p>
          </div>

          {/* Buzz Button */}
          <BuzzButton
            state={buzzButtonState}
            onBuzz={handleBuzz}
            size={300}
            queuePosition={queuePosition}
          />

          {/* Instructions */}
          <div className="mt-12 bg-white rounded-lg shadow p-6 max-w-md">
            <h3 className="font-bold text-gray-900 mb-3">How to Play</h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex items-start">
                <span className="text-blue-600 mr-2">•</span>
                <span>Listen carefully to each question</span>
              </li>
              <li className="flex items-start">
                <span className="text-blue-600 mr-2">•</span>
                <span>Press the buzz button when you know the answer</span>
              </li>
              <li className="flex items-start">
                <span className="text-blue-600 mr-2">•</span>
                <span>First team to buzz gets to answer</span>
              </li>
              <li className="flex items-start">
                <span className="text-blue-600 mr-2">•</span>
                <span>Give your answer out loud to the teacher</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
