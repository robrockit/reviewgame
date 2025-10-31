'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { GameBoard } from '@/components/game/GameBoard';
import { TeamScoreboard } from '@/components/game/TeamScoreboard';
import { useGameStore } from '@/lib/stores/gameStore';
import type { Tables } from '@/types/database.types';
import type { Category, Question, Team } from '@/types/game';

type Game = Tables<'games'>;
type DatabaseTeam = Tables<'teams'>;
type DatabaseQuestion = Tables<'questions'>;

interface GameWithBank extends Game {
  question_banks: {
    id: string;
    title: string;
    subject: string;
  };
}

export default function GameBoardPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();

  const gameId = params?.gameId as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [game, setGame] = useState<GameWithBank | null>(null);
  const [teacherId, setTeacherId] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'connecting'>('connecting');
  const [subscriptionError, setSubscriptionError] = useState<string | null>(null);

  const { setGame: setStoreGame, setTeams } = useGameStore();

  // Fetch game data and questions
  useEffect(() => {
    const fetchGameData = async () => {
      try {
        // Validate gameId parameter
        if (!gameId || typeof gameId !== 'string' || gameId.length === 0) {
          setError('Invalid game ID');
          setLoading(false);
          return;
        }

        // Check authentication
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
          router.push('/login');
          return;
        }

        // Fetch game with question bank
        const { data: gameData, error: gameError } = await supabase
          .from('games')
          .select(`
            *,
            question_banks (
              id,
              title,
              subject
            )
          `)
          .eq('id', gameId)
          .single();

        if (gameError) throw gameError;

        // Verify this teacher owns the game
        if (gameData.teacher_id !== user.id) {
          setError('You do not have permission to access this game.');
          setLoading(false);
          return;
        }

        // Cache the teacher ID for authorization checks in subscriptions
        setTeacherId(user.id);

        // Fetch questions and teams in parallel to prevent race conditions
        const [questionsResult, teamsResult] = await Promise.all([
          supabase
            .from('questions')
            .select('*')
            .eq('bank_id', gameData.bank_id)
            .order('category')
            .order('position'),
          supabase
            .from('teams')
            .select('*')
            .eq('game_id', gameId)
            .eq('connection_status', 'connected')
            .order('team_number'),
        ]);

        if (questionsResult.error) throw questionsResult.error;
        if (teamsResult.error) throw teamsResult.error;

        // Transform questions into game board format
        const categories = transformQuestionsToCategories(
          questionsResult.data,
          gameData.selected_questions || []
        );

        // Transform teams for store
        const teamsForStore: Team[] = (teamsResult.data || []).map((t: DatabaseTeam) => ({
          id: t.id,
          name: t.team_name || `Team ${t.team_number}`,
          score: t.score || 0,
        }));

        // Set all state together to prevent partial renders
        setGame(gameData as GameWithBank);
        setStoreGame({
          id: gameData.id,
          categories,
        });
        setTeams(teamsForStore);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching game data:', err);
        const message = err instanceof Error ? err.message : 'Failed to load game data';
        setError(message);
        setLoading(false);
      }
    };

    if (gameId) {
      fetchGameData();
    }
  }, [gameId, router, supabase, setStoreGame, setTeams]);

  // Transform database questions into Category[] format
  const transformQuestionsToCategories = (
    questions: DatabaseQuestion[],
    usedQuestions: string[]
    // dailyDoublePositions will be added later for Daily Double logic
  ): Category[] => {
    // Group questions by category
    const categoriesMap = new Map<string, DatabaseQuestion[]>();

    questions.forEach((q) => {
      if (!categoriesMap.has(q.category)) {
        categoriesMap.set(q.category, []);
      }
      categoriesMap.get(q.category)!.push(q);
    });

    // Convert to array and sort
    const categories: Category[] = Array.from(categoriesMap.entries())
      .map(([categoryName, categoryQuestions]) => {
        // Sort by point_value (100, 200, 300, 400, 500)
        const sortedQuestions = categoryQuestions.sort((a, b) => a.point_value - b.point_value);

        // Transform to Question type
        const questions: Question[] = sortedQuestions.map((q) => {
          // For now, Daily Doubles will be marked later
          // TODO: Implement proper Daily Double selection logic
          const isDailyDouble = false;

          return {
            id: q.id,
            value: q.point_value,
            text: q.question_text,
            isUsed: usedQuestions.includes(q.id),
            isDailyDouble,
          };
        });

        return {
          id: categoryName.toLowerCase().replace(/\s+/g, '-'),
          name: categoryName,
          questions,
        };
      })
      .slice(0, 7); // Limit to 7 categories max

    return categories;
  };

  // Set up real-time subscriptions
  useEffect(() => {
    if (!gameId) return;

    console.log('Setting up real-time subscriptions for game board');

    // Subscribe to game updates
    const gameChannel = supabase
      .channel(`game-board:${gameId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'games',
          filter: `id=eq.${gameId}`,
        },
        (payload) => {
          try {
            console.log('Game updated:', payload);
            const updatedGame = payload.new as Game;

            // Verify authorization using cached teacher ID
            if (!teacherId || updatedGame.teacher_id !== teacherId) {
              setError('You no longer have permission to access this game.');
              setConnectionStatus('disconnected');
              return;
            }

            // Update local game state using callback form to avoid stale closure
            setGame((prevGame) => {
              if (!prevGame) return prevGame;
              return {
                ...prevGame,
                ...updatedGame,
                // Preserve nested question_banks object from initial fetch
                question_banks: prevGame.question_banks,
              };
            });
          } catch (error) {
            console.error('Error in game update handler:', error);
            setSubscriptionError('Failed to process game update');
          }
        }
      )
      .subscribe((status, err) => {
        console.log('Game board subscription status:', status);
        if (err) {
          console.error('Game subscription error:', err);
          setSubscriptionError('Lost connection to game updates. Attempting to reconnect...');
          setConnectionStatus('disconnected');
        } else if (status === 'SUBSCRIBED') {
          setConnectionStatus('connected');
          setSubscriptionError(null);
        } else if (status === 'CHANNEL_ERROR') {
          setConnectionStatus('disconnected');
          setSubscriptionError('Connection error. Attempting to reconnect...');
        }
      });

    // Subscribe to team score updates
    const teamsChannel = supabase
      .channel(`teams-board:${gameId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'teams',
          filter: `game_id=eq.${gameId}`,
        },
        (payload) => {
          try {
            console.log('Team updated:', payload);
            const updatedTeam = payload.new as DatabaseTeam;

            // Update only the specific team to avoid race conditions
            const teamForStore: Team = {
              id: updatedTeam.id,
              name: updatedTeam.team_name || `Team ${updatedTeam.team_number}`,
              score: updatedTeam.score || 0,
            };

            // Update only the changed team using callback form to prevent memory leak
            // Defensive check: only update if team exists, otherwise add it
            setTeams((prevTeams: Team[]) => {
              const teamExists = prevTeams.some((t) => t.id === teamForStore.id);
              if (teamExists) {
                return prevTeams.map((t: Team) => (t.id === teamForStore.id ? teamForStore : t));
              } else {
                // Team doesn't exist yet (update arrived before initial fetch completed)
                // Add it to the list
                return [...prevTeams, teamForStore];
              }
            });
          } catch (error) {
            console.error('Error in team update handler:', error);
            setSubscriptionError('Failed to process team update');
          }
        }
      )
      .subscribe((status, err) => {
        console.log('Teams subscription status:', status);
        if (err) {
          console.error('Teams subscription error:', err);
          setSubscriptionError('Lost connection to team updates. Attempting to reconnect...');
          setConnectionStatus('disconnected');
        } else if (status === 'SUBSCRIBED') {
          setConnectionStatus('connected');
          setSubscriptionError(null);
        } else if (status === 'CHANNEL_ERROR') {
          setConnectionStatus('disconnected');
          setSubscriptionError('Connection error. Attempting to reconnect...');
        }
      });

    // Cleanup
    return () => {
      console.log('Cleaning up game board subscriptions');
      supabase.removeChannel(gameChannel);
      supabase.removeChannel(teamsChannel);
    };
  }, [gameId, supabase, setTeams, setGame, teacherId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading game board...</div>
      </div>
    );
  }

  if (error || !game) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Error</h1>
          <p className="text-gray-700">{error || 'Game not found'}</p>
          <button
            onClick={() => router.push('/dashboard')}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-[1800px] mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2">{game.question_banks.title}</h1>
            <p className="text-gray-400">
              Subject: {game.question_banks.subject} | Status: <span className="capitalize">{game.status}</span>
            </p>
          </div>
          <button
            onClick={() => router.push(`/game/teacher/${gameId}`)}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
          >
            Back to Control Panel
          </button>
        </div>

        {/* Connection Status Indicator */}
        {connectionStatus !== 'connected' && (
          <div className={`mb-4 p-4 rounded-lg ${
            connectionStatus === 'disconnected'
              ? 'bg-red-900/50 border border-red-700'
              : 'bg-yellow-900/50 border border-yellow-700'
          }`}>
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${
                connectionStatus === 'disconnected' ? 'bg-red-500' : 'bg-yellow-500'
              } animate-pulse`}></div>
              <div>
                <p className="font-semibold">
                  {connectionStatus === 'disconnected' ? 'Disconnected' : 'Connecting...'}
                </p>
                {subscriptionError && (
                  <p className="text-sm text-gray-300">{subscriptionError}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Game Board */}
        <GameBoard />

        {/* Scoreboard */}
        <div className="mt-8">
          <TeamScoreboard />
        </div>
      </div>
    </div>
  );
}
