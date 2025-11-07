'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Database } from '@/types/database.types';
import { logger } from '@/lib/logger';

type Team = Database['public']['Tables']['teams']['Row'];

interface WaitingRoomProps {
  params: {
    teamId: string;
  };
}

/**
 * Waiting Room Component
 *
 * Displays while team is pending approval from teacher.
 * Implements specifications from Phase 8, Section 8.2.
 *
 * Features:
 * - Displays waiting state with animation
 * - Subscribes to team status changes via Supabase Realtime
 * - Auto-redirects when approved
 * - Handles rejection with error message
 *
 * @param params - Contains the teamId from the URL
 */
export default function WaitingRoomPage({ params }: WaitingRoomProps) {
  const router = useRouter();
  const [team, setTeam] = useState<Team | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { teamId } = params;

  useEffect(() => {
    const supabase = createClient();

    // Fetch initial team data
    const fetchTeam = async () => {
      const { data, error: fetchError } = await supabase
        .from('teams')
        .select('*')
        .eq('id', teamId)
        .single();

      if (fetchError || !data) {
        setError('Team not found. Please rejoin the game.');
        return;
      }

      setTeam(data);

      // If already approved, redirect immediately
      if (data.connection_status === 'approved') {
        router.push(`/game/team/${teamId}`);
        return;
      }

      // If rejected, show error
      if (data.connection_status === 'rejected') {
        setError('Your join request was declined by the teacher.');
        return;
      }
    };

    fetchTeam();

    // Subscribe to team changes for real-time updates
    const channel = supabase
      .channel(`team-${teamId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'teams',
          filter: `id=eq.${teamId}`,
        },
        (payload) => {
          const updatedTeam = payload.new as Team;
          setTeam(updatedTeam);

          // Auto-redirect on approval
          if (updatedTeam.connection_status === 'approved') {
            router.push(`/game/team/${teamId}`);
          }

          // Show error on rejection
          if (updatedTeam.connection_status === 'rejected') {
            setError('Your join request was declined by the teacher.');
          }
        }
      )
      .subscribe();

    // Cleanup subscription on unmount
    return () => {
      supabase.removeChannel(channel);
    };
  }, [teamId, router]);

  // Update last_seen timestamp periodically
  // Only run when team is in pending state to avoid memory leaks
  useEffect(() => {
    // Don't run interval if team is not pending or if there's an error
    if (!team || team.connection_status !== 'pending' || error) {
      return;
    }

    const supabase = createClient();

    const updateLastSeen = async () => {
      const { error: updateError } = await supabase
        .from('teams')
        .update({ last_seen: new Date().toISOString() })
        .eq('id', teamId);

      if (updateError) {
        logger.error('Failed to update last_seen timestamp', {
          error: updateError.message,
          teamId,
          operation: 'updateLastSeen',
          page: 'WaitingRoomPage'
        });
        // Don't show error to user as this is a background operation
        // Teacher will see stale last_seen timestamp if this fails repeatedly
      }
    };

    // Update immediately
    updateLastSeen();

    // Update every 10 seconds
    const interval = setInterval(updateLastSeen, 10000);

    return () => clearInterval(interval);
  }, [teamId, team, error]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-yellow-50 to-yellow-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
        {error ? (
          // Error State
          <div className="text-center">
            <div className="mb-6">
              <svg
                className="mx-auto h-16 w-16 text-red-500"
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
            <h1 className="text-2xl font-bold text-gray-900 mb-4">
              Unable to Join
            </h1>
            <p className="text-gray-600 mb-6">{error}</p>
            <button
              onClick={() => router.push(`/game/team/join/${team?.game_id}`)}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        ) : (
          // Waiting State
          <>
            {/* Loading Animation */}
            <div className="text-center mb-8">
              <div className="relative inline-block">
                <div className="animate-spin rounded-full h-24 w-24 border-8 border-yellow-200 border-t-yellow-500 mx-auto" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-4xl">⏳</span>
                </div>
              </div>
            </div>

            {/* Header */}
            <div className="text-center mb-6">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Waiting for Approval
              </h1>
              {team && (
                <p className="text-xl text-gray-600">
                  Team {team.team_number}
                </p>
              )}
            </div>

            {/* Instructions */}
            <div className="bg-blue-50 rounded-lg p-6 mb-6">
              <h2 className="text-sm font-semibold text-blue-900 mb-3">
                📋 What happens next:
              </h2>
              <ol className="text-sm text-blue-800 space-y-2 list-decimal list-inside">
                <li>Your teacher will see your join request</li>
                <li>They will approve your team to join the game</li>
                <li>You will automatically be taken to the game screen</li>
              </ol>
            </div>

            {/* Tips */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-yellow-900 mb-2">
                💡 While you wait:
              </h3>
              <ul className="text-sm text-yellow-800 space-y-1 list-disc list-inside">
                <li>Keep this page open</li>
                <li>Do not refresh the page</li>
                <li>Stay connected to the internet</li>
              </ul>
            </div>

            {/* Status Indicator */}
            <div className="mt-8 text-center">
              <div className="inline-flex items-center px-4 py-2 bg-gray-100 rounded-full">
                <div className="animate-pulse h-3 w-3 bg-green-500 rounded-full mr-2" />
                <span className="text-sm text-gray-600">Connected</span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
