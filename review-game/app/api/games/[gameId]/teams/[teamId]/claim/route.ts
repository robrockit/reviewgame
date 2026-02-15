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

    // Type for claim_team function result
    interface ClaimTeamResult {
      success: boolean;
      error?: string;
      message?: string;
      already_claimed?: boolean;
      team_name?: string;
      team_number?: number;
    }

    // Use atomic database function with row-level locking to prevent race conditions
    // Note: claim_team is defined in migration but not yet in generated types
    const { data: rawResult, error: claimError } = await supabase.rpc(
      'claim_team' as any,
      {
        p_team_id: teamId,
        p_game_id: gameId,
        p_device_id: deviceId,
      }
    );

    if (claimError) {
      logger.error('Database error during team claim', claimError, {
        operation: 'claimTeam',
        gameId,
        teamId,
      });
      return NextResponse.json(
        { error: 'Failed to claim team' },
        { status: 500 }
      );
    }

    // Parse result from database function
    if (!rawResult || typeof rawResult !== 'object') {
      logger.error('Invalid result from claim_team function', new Error('Invalid result'), {
        operation: 'claimTeam',
        gameId,
        teamId,
        result: rawResult,
      });
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }

    // Type assertion for database function result (safe after validation above)
    const result = rawResult as unknown as ClaimTeamResult;

    // Check if claim was successful
    if (!result.success) {
      const errorCode = result.error || 'UNKNOWN_ERROR';
      const errorMessage = result.message || 'Failed to claim team';

      logger.warn('Team claim rejected', {
        operation: 'claimTeam',
        gameId,
        teamId,
        deviceId,
        errorCode,
      });

      const statusCode = errorCode === 'TEAM_NOT_FOUND' ? 404 : 409;

      return NextResponse.json(
        {
          error: errorMessage,
          code: errorCode,
        },
        { status: statusCode }
      );
    }

    // Success
    logger.info('Team claimed successfully', {
      operation: 'claimTeam',
      gameId,
      teamId,
      deviceId,
      alreadyClaimed: result.already_claimed || false,
    });

    return NextResponse.json({
      success: true,
      message: result.already_claimed
        ? 'Team already claimed by this device'
        : 'Team claimed successfully',
      teamName: result.team_name,
      teamNumber: result.team_number,
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
