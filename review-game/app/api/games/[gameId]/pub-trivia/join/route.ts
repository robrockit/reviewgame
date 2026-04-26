import { type NextRequest, NextResponse } from 'next/server';
import { createAdminServiceClient } from '@/lib/admin/auth';
import { PUB_TRIVIA_ICON_EMOJIS } from '@/lib/constants/pubTriviaIcons';
import { logger } from '@/lib/logger';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/games/[gameId]/pub-trivia/join
 *
 * Unauthenticated player joins a pub trivia game:
 * 1. Validates gameId, playerName, and deviceId
 * 2. Checks game is pub_trivia and not completed
 * 3. If device already has a team, returns existing record (with current connectionStatus)
 * 4. Calls join_game_atomic to get a seat (handles capacity + team_number atomically)
 * 5. Patches team_name and connection_status='pending' (awaiting teacher approval)
 * 6. Returns { playerId, playerName, deviceId, connectionStatus }
 */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await context.params;

    if (!UUID_RE.test(gameId)) {
      return NextResponse.json({ error: 'Invalid game ID' }, { status: 400 });
    }

    const body = (await req.json()) as Partial<{ playerName: string; deviceId: string; playerIcon: string }>;
    const { playerName, deviceId, playerIcon } = body;

    if (!playerName || typeof playerName !== 'string' || playerName.trim().length === 0) {
      return NextResponse.json({ error: 'playerName is required' }, { status: 400 });
    }
    if (playerName.trim().length > 50) {
      return NextResponse.json({ error: 'playerName must not exceed 50 characters' }, { status: 400 });
    }
    if (!deviceId || !UUID_RE.test(deviceId)) {
      return NextResponse.json({ error: 'deviceId must be a valid UUID' }, { status: 400 });
    }
    if (playerIcon !== undefined && !PUB_TRIVIA_ICON_EMOJIS.has(playerIcon)) {
      return NextResponse.json({ error: 'Invalid playerIcon' }, { status: 400 });
    }
    const resolvedIcon = playerIcon ?? null;

    const serviceClient = createAdminServiceClient();

    // Verify the game is a pub trivia game that is joinable
    const { data: game, error: gameError } = await serviceClient
      .from('games')
      .select('status, game_type, num_teams')
      .eq('id', gameId)
      .single();

    if (gameError || !game) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }
    if (game.game_type !== 'pub_trivia') {
      return NextResponse.json({ error: 'Not a pub trivia game' }, { status: 400 });
    }
    if (game.status === 'completed') {
      return NextResponse.json({ error: 'This game has already ended' }, { status: 409 });
    }

    // Check if this device already has a player record in this game
    const { data: existing } = await serviceClient
      .from('teams')
      .select('id, team_name, score, connection_status, player_icon')
      .eq('game_id', gameId)
      .eq('device_id', deviceId)
      .maybeSingle();

    if (existing) {
      logger.info('Pub trivia player rejoining', {
        operation: 'joinPubTriviaGame',
        gameId,
        teamId: existing.id,
      });
      return NextResponse.json({
        playerId: existing.id,
        playerName: existing.team_name ?? playerName.trim(),
        playerIcon: existing.player_icon ?? null,
        score: existing.score ?? 0,
        deviceId,
        connectionStatus: existing.connection_status ?? 'pending',
      });
    }

    // Use existing RPC for atomic seat assignment (handles num_teams capacity)
    type JoinResult =
      | { success: true; team_id: string; team_number: number }
      | { success: false; error_code: string };

    const { data: rpcResult, error: rpcError } = await serviceClient.rpc('join_game_atomic', {
      p_game_id: gameId,
      p_device_id: deviceId,
    });

    if (rpcError) {
      logger.error('RPC error joining pub trivia game', rpcError, {
        operation: 'joinPubTriviaGame',
        gameId,
      });
      return NextResponse.json({ error: 'Failed to join game' }, { status: 500 });
    }

    const result = rpcResult as JoinResult;

    if (!result.success) {
      const code = result.error_code;
      if (code === 'game_full') {
        return NextResponse.json({ error: 'Game is full' }, { status: 409 });
      }
      if (code === 'game_completed') {
        return NextResponse.json({ error: 'Game has already ended' }, { status: 409 });
      }
      return NextResponse.json({ error: 'Failed to join game' }, { status: 500 });
    }

    // Patch the team with the player's chosen name and icon; mark as pending until teacher approves
    const { data: patchedTeam, error: patchError } = await serviceClient
      .from('teams')
      .update({
        team_name: playerName.trim(),
        player_icon: resolvedIcon,
        connection_status: 'pending',
        updated_at: new Date().toISOString(),
      })
      .eq('id', result.team_id)
      .select('id, team_name, score, player_icon')
      .single();

    if (patchError || !patchedTeam) {
      logger.error('Failed to patch pub trivia team', patchError, {
        operation: 'joinPubTriviaGame',
        gameId,
        teamId: result.team_id,
      });
      return NextResponse.json({ error: 'Failed to set player name' }, { status: 500 });
    }

    logger.info('Pub trivia player joined', {
      operation: 'joinPubTriviaGame',
      gameId,
      teamId: patchedTeam.id,
    });

    return NextResponse.json({
      playerId: patchedTeam.id,
      playerName: patchedTeam.team_name ?? playerName.trim(),
      playerIcon: patchedTeam.player_icon ?? null,
      score: patchedTeam.score ?? 0,
      deviceId,
      connectionStatus: 'pending',
    });
  } catch (error) {
    logger.error('Unexpected error joining pub trivia game', error, {
      operation: 'joinPubTriviaGame',
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
