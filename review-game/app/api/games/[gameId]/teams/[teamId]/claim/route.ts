import { type NextRequest, NextResponse } from 'next/server';
import { createAdminServerClient } from '@/lib/admin/auth';
import { logger } from '@/lib/logger';

/**
 * POST /api/games/[gameId]/teams/[teamId]/claim
 * Claims a team for a specific device.
 *
 * Body: { deviceId: string }
 *
 * Verifies:
 * - Team exists and belongs to game
 * - Team is not already claimed by a different device
 * - deviceId is valid
 *
 * Actions:
 * - Updates team.device_id if unclaimed
 * - Returns success if already claimed by this device
 * - Returns error if claimed by different device
 */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ gameId: string; teamId: string }> }
) {
  try {
    const supabase = await createAdminServerClient();
    const { gameId, teamId } = await context.params;

    // Validate UUID formats
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(gameId) || !uuidRegex.test(teamId)) {
      return NextResponse.json(
        { error: 'Invalid ID format' },
        { status: 400 }
      );
    }

    // Get request body
    const body = await req.json();
    const { deviceId } = body;

    // Validate deviceId
    if (!deviceId || typeof deviceId !== 'string') {
      return NextResponse.json(
        { error: 'deviceId is required' },
        { status: 400 }
      );
    }

    // Validate deviceId format (UUID)
    if (!uuidRegex.test(deviceId)) {
      return NextResponse.json(
        { error: 'Invalid deviceId format' },
        { status: 400 }
      );
    }

    // Fetch team
    const { data: team, error: fetchError } = await supabase
      .from('teams')
      .select('id, game_id, device_id, team_name')
      .eq('id', teamId)
      .eq('game_id', gameId)
      .single();

    if (fetchError || !team) {
      logger.error('Team not found', fetchError, {
        operation: 'claimTeam',
        gameId,
        teamId,
      });
      return NextResponse.json(
        { error: 'Team not found' },
        { status: 404 }
      );
    }

    // Check if team is already claimed
    if (team.device_id) {
      // Team is claimed - check if it's by this device
      if (team.device_id === deviceId) {
        // Already claimed by this device - success
        return NextResponse.json({
          success: true,
          message: 'Team already claimed by this device',
          teamName: team.team_name,
        });
      } else {
        // Claimed by a different device - reject
        return NextResponse.json(
          {
            error: 'Team is already claimed by another device',
            code: 'TEAM_ALREADY_CLAIMED',
          },
          { status: 409 }
        );
      }
    }

    // Team is unclaimed - claim it for this device
    const { error: updateError } = await supabase
      .from('teams')
      .update({ device_id: deviceId })
      .eq('id', teamId)
      .eq('game_id', gameId)
      // Double-check device_id is still null (prevent race condition)
      .is('device_id', null);

    if (updateError) {
      logger.error('Failed to claim team', updateError, {
        operation: 'claimTeam',
        gameId,
        teamId,
        deviceId,
      });

      // Check if it failed because another device claimed it
      const { data: recheckTeam } = await supabase
        .from('teams')
        .select('device_id')
        .eq('id', teamId)
        .single();

      if (recheckTeam?.device_id && recheckTeam.device_id !== deviceId) {
        return NextResponse.json(
          {
            error: 'Team was claimed by another device during request',
            code: 'RACE_CONDITION',
          },
          { status: 409 }
        );
      }

      return NextResponse.json(
        { error: 'Failed to claim team' },
        { status: 500 }
      );
    }

    logger.info('Team claimed successfully', {
      operation: 'claimTeam',
      gameId,
      teamId,
      deviceId,
    });

    return NextResponse.json({
      success: true,
      message: 'Team claimed successfully',
      teamName: team.team_name,
    });
  } catch (error) {
    logger.error('Team claim failed', error, {
      operation: 'claimTeam',
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
