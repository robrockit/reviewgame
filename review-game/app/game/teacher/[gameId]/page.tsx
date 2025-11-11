'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import { createClient } from '@/lib/supabase/client';
import { BackButton } from '@/components/navigation/BackButton';
import type { Tables } from '@/types/database.types';

type Game = Tables<'games'>;
type Team = Tables<'teams'>;
type QuestionBank = Tables<'question_banks'>;

interface GameWithBank extends Game {
  question_banks: QuestionBank;
}

export default function TeacherControlPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();

  const gameId = params?.gameId as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [game, setGame] = useState<GameWithBank | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);

  // Join URL for students
  const joinUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/game/team/${gameId}`
    : '';

  // Fetch game and teams data
  useEffect(() => {
    const fetchGameData = async () => {
      try {
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
            question_banks (*)
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

        setGame(gameData as GameWithBank);

        // Fetch teams
        const { data: teamsData, error: teamsError } = await supabase
          .from('teams')
          .select('*')
          .eq('game_id', gameId)
          .order('team_number', { ascending: true });

        if (teamsError) throw teamsError;

        setTeams(teamsData || []);
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
  }, [gameId, router, supabase]);

  // Set up real-time subscriptions for team updates
  useEffect(() => {
    if (!gameId) return;

    console.log('Setting up real-time subscription for game:', gameId);

    // Subscribe to team changes
    const teamsChannel = supabase
      .channel(`teams:${gameId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'teams',
          filter: `game_id=eq.${gameId}`,
        },
        async (payload) => {
          console.log('Team change detected:', payload);

          // Refetch teams to get updated data
          const { data: teamsData } = await supabase
            .from('teams')
            .select('*')
            .eq('game_id', gameId)
            .order('team_number', { ascending: true });

          if (teamsData) {
            console.log('Updated teams:', teamsData);
            setTeams(teamsData);
          }
        }
      )
      .subscribe((status) => {
        console.log('Subscription status:', status);
      });

    // Cleanup subscription on unmount
    return () => {
      console.log('Cleaning up subscription');
      supabase.removeChannel(teamsChannel);
    };
  }, [gameId, supabase]);

  // Handle team approval
  const handleApproveTeam = async (teamId: string) => {
    try {
      const { error: updateError } = await supabase
        .from('teams')
        .update({ connection_status: 'connected' })
        .eq('id', teamId);

      if (updateError) throw updateError;

      // Update local state
      setTeams(teams.map(team =>
        team.id === teamId
          ? { ...team, connection_status: 'connected' }
          : team
      ));
    } catch (err) {
      console.error('Error approving team:', err);
      alert('Failed to approve team. Please try again.');
    }
  };

  // Handle team rejection/removal
  const handleRejectTeam = async (teamId: string) => {
    try {
      const { error: deleteError } = await supabase
        .from('teams')
        .delete()
        .eq('id', teamId);

      if (deleteError) throw deleteError;

      // Update local state
      setTeams(teams.filter(team => team.id !== teamId));
    } catch (err) {
      console.error('Error rejecting team:', err);
      alert('Failed to reject team. Please try again.');
    }
  };

  // Handle starting the game
  const handleStartGame = async () => {
    if (!game) return;

    // Verify all teams are approved
    const pendingTeams = teams.filter(t => t.connection_status === 'pending');
    if (pendingTeams.length > 0) {
      alert('Please approve or reject all pending teams before starting the game.');
      return;
    }

    // Verify we have the expected number of teams
    if (teams.length !== game.num_teams) {
      const confirm = window.confirm(
        `You have ${teams.length} teams but expected ${game.num_teams}. Do you want to continue anyway?`
      );
      if (!confirm) return;
    }

    try {
      // Update game status to 'active' and set started_at timestamp
      const { error: updateError } = await supabase
        .from('games')
        .update({
          status: 'active',
          started_at: new Date().toISOString()
        })
        .eq('id', gameId);

      if (updateError) throw updateError;

      // Update local game state
      setGame({
        ...game,
        status: 'active',
        started_at: new Date().toISOString()
      });

      // Navigate to the game board
      router.push(`/game/board/${gameId}`);
    } catch (err) {
      console.error('Error starting game:', err);
      alert('Failed to start game. Please try again.');
    }
  };

  // Get count of teams by status
  const pendingCount = teams.filter(t => t.connection_status === 'pending').length;
  const connectedCount = teams.filter(t => t.connection_status === 'connected').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading game...</div>
      </div>
    );
  }

  if (error || !game) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Error</h1>
          <p className="text-gray-700">{error || 'Game not found'}</p>
          <BackButton href="/dashboard" variant="primary" className="mt-4" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
            <h1 className="text-3xl font-bold text-gray-900">Teacher Control Panel</h1>
            <BackButton href="/dashboard" variant="secondary" />
          </div>
          <p className="text-gray-600">
            Game Status: <span className="font-semibold capitalize">{game.status}</span>
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column: Game Info & QR Code */}
          <div className="space-y-6">
            {/* Game Information Card */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Game Information</h2>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-gray-600">Question Bank:</dt>
                  <dd className="font-medium text-gray-900">{game.question_banks.title}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-600">Subject:</dt>
                  <dd className="font-medium text-gray-900">{game.question_banks.subject}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-600">Expected Teams:</dt>
                  <dd className="font-medium text-gray-900">{game.num_teams}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-600">Timer:</dt>
                  <dd className="font-medium text-gray-900">
                    {game.timer_enabled ? `${game.timer_seconds}s` : 'Disabled'}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-600">Daily Doubles:</dt>
                  <dd className="font-medium text-gray-900">2 (randomly placed)</dd>
                </div>
              </dl>
            </div>

            {/* QR Code Card */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Student Join Code</h2>
              <div className="text-center">
                {/* QR Code Display */}
                <div className="bg-white border-2 border-gray-200 rounded-lg p-8 mb-4 inline-block">
                  <QRCodeSVG
                    value={joinUrl}
                    size={256}
                    level="H"
                    includeMargin={true}
                  />
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Join URL:
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={joinUrl}
                      readOnly
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-sm"
                    />
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(joinUrl);
                        alert('Join URL copied to clipboard!');
                      }}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
                    >
                      Copy
                    </button>
                  </div>
                </div>

                <p className="text-sm text-gray-600">
                  Students can scan the QR code or visit the URL to join the game
                </p>
              </div>
            </div>
          </div>

          {/* Right Column: Team Management */}
          <div className="space-y-6">
            {/* Team Status Summary */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Team Status</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-green-600">{connectedCount}</div>
                  <div className="text-sm text-green-700">Connected</div>
                </div>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-yellow-600">{pendingCount}</div>
                  <div className="text-sm text-yellow-700">Pending</div>
                </div>
              </div>
            </div>

            {/* Teams List */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                Teams ({teams.length}/{game.num_teams})
              </h2>

              {teams.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>No teams have joined yet.</p>
                  <p className="text-sm mt-2">Share the QR code or join URL with students.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {teams.map((team) => (
                    <div
                      key={team.id}
                      className={`border rounded-lg p-4 ${
                        team.connection_status === 'connected'
                          ? 'border-green-200 bg-green-50'
                          : 'border-yellow-200 bg-yellow-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold text-gray-900">
                            {team.team_name || `Team ${team.team_number}`}
                          </h3>
                          <p className="text-sm text-gray-600">
                            Status:{' '}
                            <span
                              className={`font-medium ${
                                team.connection_status === 'connected'
                                  ? 'text-green-600'
                                  : 'text-yellow-600'
                              }`}
                            >
                              {team.connection_status === 'connected' ? 'Approved' : 'Pending'}
                            </span>
                          </p>
                        </div>

                        {team.connection_status === 'pending' && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleApproveTeam(team.id)}
                              className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-sm font-medium"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleRejectTeam(team.id)}
                              className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-sm font-medium"
                            >
                              Reject
                            </button>
                          </div>
                        )}

                        {team.connection_status === 'connected' && (
                          <button
                            onClick={() => handleRejectTeam(team.id)}
                            className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-sm font-medium"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Start Game Button / Game Status */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              {game.status === 'active' ? (
                <div className="text-center py-4">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
                    <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h3 className="text-2xl font-bold text-green-600 mb-2">Game Active!</h3>
                  <p className="text-gray-600">
                    Students can now see their buzz buttons.
                  </p>
                  <p className="text-sm text-gray-500 mt-2">
                    The game board will be available in a future update.
                  </p>
                </div>
              ) : (
                <>
                  <button
                    onClick={handleStartGame}
                    disabled={pendingCount > 0 || connectedCount === 0}
                    className="w-full px-6 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {pendingCount > 0
                      ? `Approve ${pendingCount} Pending Team${pendingCount > 1 ? 's' : ''} First`
                      : connectedCount === 0
                      ? 'Waiting for Teams to Join'
                      : 'Start Game'}
                  </button>

                  {connectedCount > 0 && pendingCount === 0 && (
                    <p className="text-sm text-gray-600 text-center mt-2">
                      All teams are approved and ready to play!
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
