/**
 * @fileoverview Unit tests for POST /api/games/[gameId]/final-jeopardy/submit (RG-183).
 *
 * Tests validation logic and the two-client security invariant:
 * createAdminServiceClient (service role) must NOT be constructed until after
 * device ownership is verified via createAdminServerClient (anon).
 *
 * Integration / database behaviour is covered by E2E tests.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Mocks — declared before dynamic import so vi.mock hoisting applies
// ---------------------------------------------------------------------------

const mockVerifyDeviceOwnsTeam = vi.fn();
const mockGetDeviceIdFromRequest = vi.fn().mockReturnValue('device-abc');
const mockCreateAdminServerClient = vi.fn();
const mockCreateAdminServiceClient = vi.fn();
const mockRpc = vi.fn();

vi.mock('@/lib/admin/auth', () => ({
  createAdminServerClient: () => mockCreateAdminServerClient(),
  createAdminServiceClient: () => mockCreateAdminServiceClient(),
}));

vi.mock('@/lib/auth/device', () => ({
  verifyDeviceOwnsTeam: (...args: unknown[]) => mockVerifyDeviceOwnsTeam(...args),
  getDeviceIdFromRequest: (req: unknown) => mockGetDeviceIdFromRequest(req),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_GAME_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const VALID_TEAM_ID = '11111111-2222-3333-4444-555555555555';

function makeRequest(gameId: string, body: object, deviceId = 'device-abc') {
  return new NextRequest(`http://localhost/api/games/${gameId}/final-jeopardy/submit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Device-ID': deviceId,
    },
    body: JSON.stringify(body),
  });
}

function makeContext(gameId: string) {
  return { params: Promise.resolve({ gameId }) };
}

function mockServiceClient(result: object) {
  const rpcChain = { data: result, error: null };
  mockRpc.mockResolvedValue(rpcChain);
  mockCreateAdminServiceClient.mockReturnValue({ rpc: mockRpc });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/games/[gameId]/final-jeopardy/submit', () => {
  // Lazily import after mocks are set up
  let POST: (req: NextRequest, ctx: { params: Promise<{ gameId: string }> }) => Promise<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();
    // Default: anon client is a no-op object (only used to pass to verifyDeviceOwnsTeam)
    mockCreateAdminServerClient.mockResolvedValue({});
    // Default: device is authorized
    mockVerifyDeviceOwnsTeam.mockResolvedValue(true);
    // Default: service client returns a successful result
    mockServiceClient([{ success: true, submitted_at: '2026-04-01T00:00:00Z' }]);
    const routeModule = await import('./route');
    POST = routeModule.POST;
  });

  // ── Input validation (pre-auth) ────────────────────────────────────────────

  describe('input validation (pre-auth)', () => {
    it('returns 400 for invalid game UUID', async () => {
      const res = await POST(
        makeRequest('not-a-uuid', { teamId: VALID_TEAM_ID, wager: 0, answer: 'A' }),
        makeContext('not-a-uuid')
      );
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/Invalid game ID/i);
    });

    it('returns 400 when teamId is missing', async () => {
      const res = await POST(
        makeRequest(VALID_GAME_ID, { wager: 0, answer: 'A' }),
        makeContext(VALID_GAME_ID)
      );
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/required/i);
    });

    it('returns 400 when wager is missing', async () => {
      const res = await POST(
        makeRequest(VALID_GAME_ID, { teamId: VALID_TEAM_ID, answer: 'A' }),
        makeContext(VALID_GAME_ID)
      );
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/required/i);
    });

    it('returns 400 when answer is missing', async () => {
      const res = await POST(
        makeRequest(VALID_GAME_ID, { teamId: VALID_TEAM_ID, wager: 0 }),
        makeContext(VALID_GAME_ID)
      );
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/required/i);
    });

    it('returns 400 for invalid team UUID', async () => {
      const res = await POST(
        makeRequest(VALID_GAME_ID, { teamId: 'bad-id', wager: 0, answer: 'A' }),
        makeContext(VALID_GAME_ID)
      );
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/Invalid team ID/i);
    });
  });

  // ── Two-client security invariant ─────────────────────────────────────────

  describe('two-client security invariant', () => {
    it('returns 403 when device does not own the team', async () => {
      mockVerifyDeviceOwnsTeam.mockResolvedValue(false);

      const res = await POST(
        makeRequest(VALID_GAME_ID, { teamId: VALID_TEAM_ID, wager: 0, answer: 'A' }),
        makeContext(VALID_GAME_ID)
      );

      expect(res.status).toBe(403);
    });

    it('does NOT call createAdminServiceClient when auth fails', async () => {
      mockVerifyDeviceOwnsTeam.mockResolvedValue(false);

      await POST(
        makeRequest(VALID_GAME_ID, { teamId: VALID_TEAM_ID, wager: 0, answer: 'A' }),
        makeContext(VALID_GAME_ID)
      );

      expect(mockCreateAdminServiceClient).not.toHaveBeenCalled();
    });
  });

  // ── Post-auth validation ───────────────────────────────────────────────────

  describe('post-auth validation', () => {
    it('returns 400 for non-integer wager', async () => {
      const res = await POST(
        makeRequest(VALID_GAME_ID, { teamId: VALID_TEAM_ID, wager: 1.5, answer: 'A' }),
        makeContext(VALID_GAME_ID)
      );
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/integer/i);
    });

    it('returns 400 for negative wager', async () => {
      const res = await POST(
        makeRequest(VALID_GAME_ID, { teamId: VALID_TEAM_ID, wager: -1, answer: 'A' }),
        makeContext(VALID_GAME_ID)
      );
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/negative/i);
    });

    it('returns 400 for empty answer string', async () => {
      const res = await POST(
        makeRequest(VALID_GAME_ID, { teamId: VALID_TEAM_ID, wager: 0, answer: '' }),
        makeContext(VALID_GAME_ID)
      );
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/required/i);
    });

    it('returns 400 for whitespace-only answer', async () => {
      const res = await POST(
        makeRequest(VALID_GAME_ID, { teamId: VALID_TEAM_ID, wager: 0, answer: '   ' }),
        makeContext(VALID_GAME_ID)
      );
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/required/i);
    });

    it('returns 400 for answer exceeding 500 chars', async () => {
      const res = await POST(
        makeRequest(VALID_GAME_ID, {
          teamId: VALID_TEAM_ID,
          wager: 0,
          answer: 'x'.repeat(501),
        }),
        makeContext(VALID_GAME_ID)
      );
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/500/i);
    });
  });

  // ── Success path ───────────────────────────────────────────────────────────

  describe('success', () => {
    it('returns 200 with teamId and wager on success (answer intentionally omitted)', async () => {
      mockServiceClient([{ success: true, submitted_at: '2026-04-01T00:00:00Z' }]);

      const res = await POST(
        makeRequest(VALID_GAME_ID, { teamId: VALID_TEAM_ID, wager: 200, answer: 'Russia' }),
        makeContext(VALID_GAME_ID)
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.teamId).toBe(VALID_TEAM_ID);
      expect(body.wager).toBe(200);
      // answer is NOT echoed back to avoid logging student responses through
      // Vercel/Sentry pipelines — the client already holds it locally
      expect(body.answer).toBeUndefined();
    });

    it('calls submit_final_jeopardy RPC with correct args', async () => {
      await POST(
        makeRequest(VALID_GAME_ID, { teamId: VALID_TEAM_ID, wager: 300, answer: 'Paris' }),
        makeContext(VALID_GAME_ID)
      );

      expect(mockRpc).toHaveBeenCalledWith('submit_final_jeopardy', {
        p_game_id: VALID_GAME_ID,
        p_team_id: VALID_TEAM_ID,
        p_wager: 300,
        p_answer: 'Paris',
      });
    });
  });

  // ── RPC failure paths ──────────────────────────────────────────────────────

  describe('RPC failure paths', () => {
    it('returns 400 when RPC returns success=false (e.g. already submitted)', async () => {
      mockServiceClient([{ success: false, error_message: 'Already submitted' }]);

      const res = await POST(
        makeRequest(VALID_GAME_ID, { teamId: VALID_TEAM_ID, wager: 0, answer: 'A' }),
        makeContext(VALID_GAME_ID)
      );

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/Already submitted/i);
    });

    it('returns 500 when the RPC call itself throws', async () => {
      mockRpc.mockResolvedValue({ data: null, error: new Error('DB error') });
      mockCreateAdminServiceClient.mockReturnValue({ rpc: mockRpc });

      const res = await POST(
        makeRequest(VALID_GAME_ID, { teamId: VALID_TEAM_ID, wager: 0, answer: 'A' }),
        makeContext(VALID_GAME_ID)
      );

      expect(res.status).toBe(500);
    });
  });
});
