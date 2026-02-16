/**
 * @fileoverview Device-based authentication helpers.
 *
 * Provides functions to verify device ownership of teams using device_id.
 * Used to prevent team impersonation attacks.
 *
 * @module lib/auth/device
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import { logger } from '@/lib/logger';

/**
 * Verifies that a device_id matches the team's claimed device.
 *
 * Security Model:
 * - Each team can only be claimed by one device at a time
 * - device_id is stored in localStorage and sent with each request
 * - API routes verify device_id matches team.device_id before allowing operations
 *
 * @param supabase - Supabase client instance
 * @param teamId - ID of the team to verify
 * @param deviceId - device_id from request
 * @param gameId - (Optional) game_id for additional verification
 * @returns {Promise<boolean>} True if device owns the team, false otherwise
 *
 * @example
 * ```typescript
 * const deviceId = req.headers.get('X-Device-ID');
 * const isAuthorized = await verifyDeviceOwnsTeam(supabase, teamId, deviceId);
 * if (!isAuthorized) {
 *   return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
 * }
 * ```
 */
export async function verifyDeviceOwnsTeam(
  supabase: SupabaseClient<Database>,
  teamId: string,
  deviceId: string | null,
  gameId?: string
): Promise<boolean> {
  // Device ID is required
  if (!deviceId) {
    logger.warn('Device ID verification failed: no device_id provided', {
      operation: 'verifyDeviceOwnsTeam',
      teamId,
      gameId,
    });
    return false;
  }

  try {
    // Build query
    let query = supabase
      .from('teams')
      .select('id, device_id')
      .eq('id', teamId);

    // Add game_id filter if provided
    if (gameId) {
      query = query.eq('game_id', gameId);
    }

    const { data: team, error } = await query.single();

    if (error || !team) {
      logger.warn('Device ID verification failed: team not found', {
        operation: 'verifyDeviceOwnsTeam',
        teamId,
        gameId,
        error: error?.message,
      });
      return false;
    }

    // Check if team is claimed by this device
    if (team.device_id !== deviceId) {
      logger.warn('Device ID verification failed: device mismatch', {
        operation: 'verifyDeviceOwnsTeam',
        teamId,
        gameId,
        providedDeviceId: deviceId,
        teamDeviceId: team.device_id,
      });
      return false;
    }

    // Verification successful
    return true;
  } catch (error) {
    logger.error('Device ID verification error', error, {
      operation: 'verifyDeviceOwnsTeam',
      teamId,
      gameId,
    });
    return false;
  }
}

/**
 * Extracts device_id from request headers.
 *
 * Looks for device_id in the X-Device-ID header.
 *
 * @param req - NextRequest object
 * @returns {string | null} device_id or null if not found
 */
export function getDeviceIdFromRequest(req: Request): string | null {
  return req.headers.get('X-Device-ID');
}
