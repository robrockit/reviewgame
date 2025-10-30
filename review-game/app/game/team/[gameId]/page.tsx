'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Tables } from '@/types/database.types';

type Game = Tables<'games'>;
type Team = Tables<'teams'>;
type QuestionBank = Tables<'question_banks'>;

interface GameWithBank extends Game {
  question_banks: QuestionBank;
}

type JoinState = 'loading' | 'select' | 'joining' | 'waiting' | 'approved' | 'error';

export default function StudentJoinPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();

  const gameId = params?.gameId as string;

  const [joinState, setJoinState] = useState<JoinState>('loading');
  const [error, setError] = useState<string | null>(null);
  const [game, setGame] = useState<GameWithBank | null>(null);
  const [existingTeams, setExistingTeams] = useState<Team[]>([]);
  const [selectedTeamNumber, setSelectedTeamNumber] = useState<number>(1);
  const [currentTeam, setCurrentTeam] = useState<Team | null>(null);

  // Fetch game data
  useEffect(() => {
    const fetchGameData = async () => {
      try {
        // Fetch game with question bank
        const { data: gameData, error: gameError } = await supabase
          .from('games')
          .select(`
            *,
            question_banks (*)
          `)
          .eq('id', gameId)
          .single();

        if (gameError) throw gameError;

        // Check if game is in valid state for joining
        if (gameData.status !== 'setup') {
          setError('This game is no longer accepting new teams.');
          setJoinState('error');
          return;
        }

        setGame(gameData as GameWithBank);

        // Fetch existing teams to see which numbers are taken
        const { data: teamsData, error: teamsError } = await supabase
          .from('teams')
          .select('*')
          .eq('game_id', gameId);

        if (teamsError) throw teamsError;

        setExistingTeams(teamsData || []);
        setJoinState('select');
      } catch (err) {
        console.error('Error fetching game data:', err);
        const message = err instanceof Error ? err.message : 'Failed to load game';
        setError(message);
        setJoinState('error');
      }
    };

    if (gameId) {
      fetchGameData();
    }
  }, [gameId, supabase]);

  // Poll for approval status when waiting
  useEffect(() => {
    if (joinState !== 'waiting' || !currentTeam) return;

    // Set up real-time subscription for team status updates
    const teamChannel = supabase
      .channel(`team:${currentTeam.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'teams',
          filter: `id=eq.${currentTeam.id}`,
        },
        (payload) => {
          console.log('Team status updated:', payload);
          const updatedTeam = payload.new as Team;

          if (updatedTeam.connection_status === 'connected') {
            setJoinState('approved');
            // Redirect to student game interface after a brief delay
            setTimeout(() => {
              router.push(`/game/student/${gameId}/${currentTeam.id}`);
            }, 2000);
          }
        }
      )
      .subscribe();

    // Also poll as a backup
    const pollInterval = setInterval(async () => {
      const { data: teamData } = await supabase
        .from('teams')
        .select('*')
        .eq('id', currentTeam.id)
        .single();

      if (teamData?.connection_status === 'connected') {
        setJoinState('approved');
        clearInterval(pollInterval);
        setTimeout(() => {
          router.push(`/game/student/${gameId}/${currentTeam.id}`);
        }, 2000);
      }
    }, 2000);

    // Cleanup
    return () => {
      clearInterval(pollInterval);
      supabase.removeChannel(teamChannel);
    };
  }, [joinState, currentTeam, gameId, router, supabase]);

  // Handle team join
  const handleJoinTeam = async () => {
    if (!game) return;

    // Check if team number is already taken
    const existingTeam = existingTeams.find(t => t.team_number === selectedTeamNumber);
    if (existingTeam) {
      setError(`Team ${selectedTeamNumber} is already taken. Please select another team.`);
      return;
    }

    setJoinState('joining');
    setError(null);

    try {
      // Get team name from game settings if available
      const teamName = game.team_names?.[selectedTeamNumber - 1] || `Team ${selectedTeamNumber}`;

      // Create team record
      const { data: newTeam, error: insertError } = await supabase
        .from('teams')
        .insert({
          game_id: gameId,
          team_number: selectedTeamNumber,
          team_name: teamName,
          connection_status: 'pending',
          score: 0,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      setCurrentTeam(newTeam);
      setJoinState('waiting');
    } catch (err) {
      console.error('Error joining game:', err);
      const message = err instanceof Error ? err.message : 'Failed to join game';
      setError(message);
      setJoinState('select');
    }
  };

  // Get available team numbers
  const getAvailableTeamNumbers = () => {
    if (!game) return [];
    const takenNumbers = new Set(existingTeams.map(t => t.team_number));
    return Array.from({ length: game.num_teams }, (_, i) => i + 1).filter(
      num => !takenNumbers.has(num)
    );
  };

  const availableTeams = getAvailableTeamNumbers();

  // Update selected team number when available teams change
  useEffect(() => {
    if (availableTeams.length > 0 && !availableTeams.includes(selectedTeamNumber)) {
      // If current selection is not available, select the first available team
      setSelectedTeamNumber(availableTeams[0]);
    }
  }, [availableTeams, selectedTeamNumber]);

  // Render loading state
  if (joinState === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-lg">Loading game...</div>
      </div>
    );
  }

  // Render error state
  if (joinState === 'error' || !game) {
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

  // Render approved state
  if (joinState === 'approved') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-green-50">
        <div className="text-center bg-white rounded-lg shadow-lg p-8 max-w-md">
          <div className="text-6xl mb-4">✅</div>
          <h1 className="text-2xl font-bold text-green-600 mb-4">Approved!</h1>
          <p className="text-gray-700 mb-4">
            Your team has been approved by the teacher.
          </p>
          <p className="text-sm text-gray-600">Redirecting to game...</p>
        </div>
      </div>
    );
  }

  // Render waiting state
  if (joinState === 'waiting') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-yellow-50">
        <div className="text-center bg-white rounded-lg shadow-lg p-8 max-w-md">
          <div className="text-6xl mb-4 animate-pulse">⏳</div>
          <h1 className="text-2xl font-bold text-yellow-600 mb-4">Waiting for Approval</h1>
          <p className="text-gray-700 mb-4">
            You&apos;re joining as <strong>{currentTeam?.team_name || `Team ${selectedTeamNumber}`}</strong>
          </p>
          <p className="text-sm text-gray-600">
            Please wait while the teacher approves your team...
          </p>
          <div className="mt-6 flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-600"></div>
          </div>
        </div>
      </div>
    );
  }

  // Render joining state
  if (joinState === 'joining') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center bg-white rounded-lg shadow-lg p-8 max-w-md">
          <div className="mb-4 flex justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
          <p className="text-gray-700">Joining game...</p>
        </div>
      </div>
    );
  }

  // Render team selection state
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Join Game</h1>
          <p className="text-gray-600">Select your team to get started</p>
        </div>

        {/* Game Info Card */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Game Information</h2>
          <dl className="space-y-2">
            <div className="flex justify-between">
              <dt className="text-gray-600">Question Bank:</dt>
              <dd className="font-medium text-gray-900">{game.question_banks.title}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-600">Subject:</dt>
              <dd className="font-medium text-gray-900">{game.question_banks.subject}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-600">Total Teams:</dt>
              <dd className="font-medium text-gray-900">{game.num_teams}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-600">Teams Joined:</dt>
              <dd className="font-medium text-gray-900">
                {existingTeams.length}/{game.num_teams}
              </dd>
            </div>
          </dl>
        </div>

        {/* Team Selection Card */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Select Your Team</h2>

          {availableTeams.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-6xl mb-4">😞</div>
              <p className="text-gray-700 font-medium mb-2">All teams are full!</p>
              <p className="text-sm text-gray-600">
                This game already has all {game.num_teams} teams. Please contact your teacher.
              </p>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <label htmlFor="teamSelect" className="block text-sm font-medium text-gray-700 mb-2">
                  Choose Team Number
                </label>
                <select
                  id="teamSelect"
                  value={selectedTeamNumber}
                  onChange={(e) => setSelectedTeamNumber(parseInt(e.target.value))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg"
                >
                  {availableTeams.map(num => {
                    const teamName = game.team_names?.[num - 1];
                    return (
                      <option key={num} value={num}>
                        Team {num}{teamName ? ` - ${teamName}` : ''}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Error Message */}
              {error && (
                <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                  {error}
                </div>
              )}

              {/* Join Button */}
              <button
                onClick={handleJoinTeam}
                className="w-full px-6 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-bold text-lg shadow-md hover:shadow-lg"
              >
                Join as Team {selectedTeamNumber}
              </button>

              {/* Info Text */}
              <p className="mt-4 text-sm text-gray-600 text-center">
                After joining, wait for the teacher to approve your team before the game starts.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
