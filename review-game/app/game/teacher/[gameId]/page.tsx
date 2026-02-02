'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import { createClient } from '@/lib/supabase/client';
import { BackButton } from '@/components/navigation/BackButton';
import type { Tables } from '@/types/database.types';
import GameHeader from '@/components/teacher/GameHeader';
import EndGameModal from '@/components/teacher/EndGameModal';
import GameBreadcrumb from '@/components/teacher/GameBreadcrumb';
import Toast from '@/app/admin/users/[userId]/components/Toast';
import { logger } from '@/lib/logger';

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

  // Modal and toast state
  const [showEndGameModal, setShowEndGameModal] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

  // Join URL for students
  const joinUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/game/team/${gameId}`
    : '';

  // Derived state for header (must be before useEffects that use them)
  const hasConnectedTeams = teams.some(t => t.connection_status === 'connected');
  const gameTitle = game?.question_banks?.title ?? 'Untitled Game';

  // Get count of teams by status
  const pendingCount = teams.filter(t => t.connection_status === 'pending').length;
  const connectedCount = teams.filter(t => t.connection_status === 'connected').length;

  // Ref to track connected teams state for beforeunload handler
  // This prevents stale closures and avoids re-registering the listener
  const hasConnectedTeamsRef = useRef(hasConnectedTeams);
  useEffect(() => {
    hasConnectedTeamsRef.current = hasConnectedTeams;
  }, [hasConnectedTeams]);

  // Ref to prevent duplicate end game calls (race condition protection)
  const isEndingGameRef = useRef(false);

  // Helper functions for consistent toast notifications
  const showError = (message: string) => {
    setToastMessage(message);
    setToastType('error');
    setShowToast(true);
  };

  const showSuccess = (message: string) => {
    setToastMessage(message);
    setToastType('success');
    setShowToast(true);
  };

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
        logger.error('Error fetching game data', err, {
          operation: 'fetch_game_data',
          gameId,
        });
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

    logger.info('Setting up real-time subscription', {
      operation: 'setup_realtime_subscription',
      gameId,
    });

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
          logger.info('Team change detected', {
            operation: 'realtime_team_change',
            event: payload.eventType,
            gameId,
          });

          // Refetch teams to get updated data
          const { data: teamsData } = await supabase
            .from('teams')
            .select('*')
            .eq('game_id', gameId)
            .order('team_number', { ascending: true });

          if (teamsData) {
            logger.info('Updated teams from subscription', {
              operation: 'realtime_teams_updated',
              teamCount: teamsData.length,
              gameId,
            });
            setTeams(teamsData);
          }
        }
      )
      .subscribe((status) => {
        logger.info('Subscription status changed', {
          operation: 'realtime_subscription_status',
          status,
          gameId,
        });
      });

    // Cleanup subscription on unmount
    return () => {
      logger.info('Cleaning up subscription', {
        operation: 'cleanup_realtime_subscription',
        gameId,
      });
      supabase.removeChannel(teamsChannel);
    };
  }, [gameId, supabase]);

  // Browser back button warning for active games
  // Uses ref to avoid stale closures and prevent re-registering listener on every state change
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Check current ref value to avoid stale closure
      if (!hasConnectedTeamsRef.current) return;

      e.preventDefault();
      // Modern browsers ignore custom messages
      // They show their own generic warning
      e.returnValue = ''; // Required for Chrome
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []); // Empty deps - only register listener once; hasConnectedTeams tracked via ref

  // Handle team approval
  const handleApproveTeam = async (teamId: string) => {
    // Validate team belongs to this game
    const team = teams.find(t => t.id === teamId);
    if (!team) {
      logger.error('Invalid team ID for approval', new Error('Team not found'), {
        operation: 'approve_team',
        teamId,
        gameId,
      });
      showError('Team not found in this game');
      return;
    }

    if (team.connection_status === 'connected') {
      showError('Team is already approved');
      return;
    }

    try {
      const { error: updateError } = await supabase
        .from('teams')
        .update({ connection_status: 'connected' })
        .eq('id', teamId)
        .eq('game_id', gameId); // Add game_id constraint for security

      if (updateError) throw updateError;

      // Update local state
      setTeams(teams.map(t =>
        t.id === teamId
          ? { ...t, connection_status: 'connected' }
          : t
      ));

      showSuccess(`${team.team_name || `Team ${team.team_number}`} approved`);
    } catch (err) {
      logger.error('Error approving team', err, {
        operation: 'approve_team',
        teamId,
        gameId,
      });
      showError('Failed to approve team. Please try again.');
    }
  };

  // Handle team rejection/removal
  const handleRejectTeam = async (teamId: string) => {
    // Validate team belongs to this game
    const team = teams.find(t => t.id === teamId);
    if (!team) {
      logger.error('Invalid team ID for rejection', new Error('Team not found'), {
        operation: 'reject_team',
        teamId,
        gameId,
      });
      showError('Team not found in this game');
      return;
    }

    try {
      const { error: deleteError } = await supabase
        .from('teams')
        .delete()
        .eq('id', teamId)
        .eq('game_id', gameId); // Add game_id constraint for security

      if (deleteError) throw deleteError;

      // Update local state
      setTeams(teams.filter(t => t.id !== teamId));

      showSuccess(`${team.team_name || `Team ${team.team_number}`} removed`);
    } catch (err) {
      logger.error('Error rejecting team', err, {
        operation: 'reject_team',
        teamId,
        gameId,
      });
      showError('Failed to reject team. Please try again.');
    }
  };

  // Handle starting the game
  const handleStartGame = async () => {
    if (!game) return;

    // Verify all teams are approved
    const pendingTeams = teams.filter(t => t.connection_status === 'pending');
    if (pendingTeams.length > 0) {
      showError('Please approve or reject all pending teams before starting the game.');
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

      showSuccess('Game started successfully!');

      // Navigate to the game board after a brief delay
      setTimeout(() => {
        router.push(`/game/board/${gameId}`);
      }, 500);
    } catch (err) {
      logger.error('Error starting game', err, {
        operation: 'start_game',
        gameId,
      });
      showError('Failed to start game. Please try again.');
    }
  };

  // Handle ending the game
  const handleEndGame = async () => {
    // Prevent duplicate calls (race condition protection)
    if (isEndingGameRef.current) {
      logger.warn('End game already in progress, preventing duplicate call', {
        operation: 'end_game_duplicate_prevented',
        gameId,
      });
      return;
    }

    isEndingGameRef.current = true;

    try {
      // Call atomic database function to end game and disconnect teams
      // This ensures both operations succeed or fail together (data integrity)
      const { data, error } = await supabase.rpc('end_game', {
        p_game_id: gameId
      });

      if (error) throw error;

      // Check if game was already completed
      if (data?.already_completed) {
        showSuccess('Game was already completed');
      } else {
        showSuccess(`Game ended successfully. ${data?.teams_disconnected || 0} team(s) disconnected.`);
      }

      // Redirect to dashboard after brief delay to show toast
      setTimeout(() => {
        router.push('/dashboard');
      }, 1000);

    } catch (err) {
      logger.error('Failed to end game', err, {
        operation: 'end_game',
        gameId,
      });
      // Reset ref to allow retry after error
      isEndingGameRef.current = false;
      // Re-throw to let modal display error and keep modal open for retry
      // Modal's error display is more contextual than toast for this use case
      throw err;
    }
  };

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
    <>
      {/* Fixed Game Header */}
      <GameHeader
        gameTitle={gameTitle}
        gameStatus={game.status || 'setup'}
        hasConnectedTeams={hasConnectedTeams}
        teamCount={teams.length}
        onEndGame={() => setShowEndGameModal(true)}
      />

      <div className="min-h-screen bg-gray-50 pt-20 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Optional Breadcrumb */}
          <GameBreadcrumb gameTitle={gameTitle} />

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

      {/* End Game Modal */}
      <EndGameModal
        isOpen={showEndGameModal}
        onClose={() => setShowEndGameModal(false)}
        onConfirm={handleEndGame}
        gameTitle={gameTitle}
        teamCount={teams.length}
        hasConnectedTeams={hasConnectedTeams}
      />

      {/* Toast Notification */}
      {showToast && (
        <Toast
          message={toastMessage}
          type={toastType}
          onClose={() => setShowToast(false)}
        />
      )}
    </>
  );
}
