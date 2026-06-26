/**
 * @fileoverview Unit tests for POST /api/games/[gameId]/teacher-score (RG-190).
 *
 * The route validates auth, UUID formats, and delta bounds before calling the
 * update_team_score RPC. The RPC itself enforces teacher ownership via auth.uid().
 * Tests cover every validation branch and the three RPC failure mappings
 * (Unauthorized → 403, not found → 404, other → 400).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetUser = vi.fn();
const mockRpc = vi.fn();

vi.mock('@/lib/admin/auth', () => ({
  createAdminServerClient: async () => ({
    auth: { getUser: () => mockGetUser() },
    rpc: () => mockRpc(),
  }),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_GAME_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const VALID_TEAM_ID = 'bbbbbbbb-cccc-dddd-eeee-ffffffffffff';
const TEACHER_USER_ID = 'tttttttt-tttt-tttt-tttt-tttttttttttt';

type RequestBody = { teamId?: unknown; delta?: unknown };

function makeRequest(gameId: string, body: RequestBody = { teamId: VALID_TEAM_ID, delta: 200 }) {
  return new NextRequest(
    `http://localhost/api/games/${gameId}/teacher-score`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );
}

function makeContext(gameId: string) {
  return { params: Promise.resolve({ gameId }) };
}

function makeRpcSuccess(newScore = 1400) {
  return {
    data: [{ team_id: VALID_TEAM_ID, new_score: newScore, success: true, error_message: null }],
    error: null,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/games/[gameId]/teacher-score', () => {
  let POST: (req: NextRequest, ctx: { params: Promise<{ gameId: string }> }) => Promise<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();
    // Defaults: authenticated teacher, successful RPC
    mockGetUser.mockResolvedValue({ data: { user: { id: TEACHER_USER_ID } }, error: null });
    mockRpc.mockResolvedValue(makeRpcSuccess());

    const routeModule = await import('./route');
    POST = routeModule.POST;
  });

  // ── Auth ───────────────────────────────────────────────────────────────────

  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: new Error('No session') });

    const res = await POST(makeRequest(VALID_GAME_ID), makeContext(VALID_GAME_ID));

    expect(res.status).toBe(401);
  });

  // ── Input validation — gameId ──────────────────────────────────────────────

  it('returns 400 for invalid game UUID', async () => {
    const res = await POST(makeRequest('not-a-uuid'), makeContext('not-a-uuid'));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invalid game id/i);
  });

  // ── Input validation — body fields ────────────────────────────────────────

  it('returns 400 when teamId is missing', async () => {
    const res = await POST(makeRequest(VALID_GAME_ID, { delta: 200 }), makeContext(VALID_GAME_ID));

    expect(res.status).toBe(400);
  });

  it('returns 400 when delta is missing', async () => {
    const res = await POST(makeRequest(VALID_GAME_ID, { teamId: VALID_TEAM_ID }), makeContext(VALID_GAME_ID));

    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid teamId UUID', async () => {
    const res = await POST(
      makeRequest(VALID_GAME_ID, { teamId: 'bad-id', delta: 200 }),
      makeContext(VALID_GAME_ID)
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invalid team id/i);
  });

  it('returns 400 when delta is 0', async () => {
    const res = await POST(
      makeRequest(VALID_GAME_ID, { teamId: VALID_TEAM_ID, delta: 0 }),
      makeContext(VALID_GAME_ID)
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/non-zero/i);
  });

  it('returns 400 when delta is not an integer (float)', async () => {
    const res = await POST(
      makeRequest(VALID_GAME_ID, { teamId: VALID_TEAM_ID, delta: 1.5 }),
      makeContext(VALID_GAME_ID)
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/non-zero integer/i);
  });

  it('returns 400 when delta exceeds +10000', async () => {
    const res = await POST(
      makeRequest(VALID_GAME_ID, { teamId: VALID_TEAM_ID, delta: 10001 }),
      makeContext(VALID_GAME_ID)
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/10.?000/);
  });

  it('returns 400 when delta is below -10000', async () => {
    const res = await POST(
      makeRequest(VALID_GAME_ID, { teamId: VALID_TEAM_ID, delta: -10001 }),
      makeContext(VALID_GAME_ID)
    );

    expect(res.status).toBe(400);
  });

  // ── RPC failure paths ──────────────────────────────────────────────────────

  it('returns 500 on RPC transport error', async () => {
    mockRpc.mockResolvedValue({ data: null, error: new Error('DB connection refused') });

    const res = await POST(makeRequest(VALID_GAME_ID), makeContext(VALID_GAME_ID));

    expect(res.status).toBe(500);
  });

  it('returns 500 when RPC returns empty array', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });

    const res = await POST(makeRequest(VALID_GAME_ID), makeContext(VALID_GAME_ID));

    expect(res.status).toBe(500);
  });

  it('treats a row with undefined success as failure (safe fallback for schema drift)', async () => {
    // If a future migration changes the RPC return shape, missing 'success' is falsy
    // → falls into the error branch with error_message fallback → 400, not a crash.
    mockRpc.mockResolvedValue({
      data: [{ team_id: VALID_TEAM_ID, new_score: 0 }], // success and error_message absent
      error: null,
    });

    const res = await POST(makeRequest(VALID_GAME_ID), makeContext(VALID_GAME_ID));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Failed to update score');
  });

  it('returns 403 when RPC reports Unauthorized', async () => {
    mockRpc.mockResolvedValue({
      data: [{ team_id: VALID_TEAM_ID, new_score: 0, success: false, error_message: 'Unauthorized' }],
      error: null,
    });

    const res = await POST(makeRequest(VALID_GAME_ID), makeContext(VALID_GAME_ID));

    expect(res.status).toBe(403);
  });

  it('returns 404 when RPC reports Game not found', async () => {
    mockRpc.mockResolvedValue({
      data: [{ team_id: VALID_TEAM_ID, new_score: 0, success: false, error_message: 'Game not found' }],
      error: null,
    });

    const res = await POST(makeRequest(VALID_GAME_ID), makeContext(VALID_GAME_ID));

    expect(res.status).toBe(404);
  });

  it('returns 404 when RPC reports Team not found', async () => {
    mockRpc.mockResolvedValue({
      data: [{ team_id: VALID_TEAM_ID, new_score: 0, success: false, error_message: 'Team not found' }],
      error: null,
    });

    const res = await POST(makeRequest(VALID_GAME_ID), makeContext(VALID_GAME_ID));

    expect(res.status).toBe(404);
  });

  it('returns 400 for any other RPC success=false message', async () => {
    mockRpc.mockResolvedValue({
      data: [{ team_id: VALID_TEAM_ID, new_score: 0, success: false, error_message: 'Some constraint violation' }],
      error: null,
    });

    const res = await POST(makeRequest(VALID_GAME_ID), makeContext(VALID_GAME_ID));

    expect(res.status).toBe(400);
  });

  // ── Success ────────────────────────────────────────────────────────────────

  it('returns 200 with ScoreOverrideResponse on success', async () => {
    mockRpc.mockResolvedValue(makeRpcSuccess(1400));

    const res = await POST(
      makeRequest(VALID_GAME_ID, { teamId: VALID_TEAM_ID, delta: 200 }),
      makeContext(VALID_GAME_ID)
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.teamId).toBe(VALID_TEAM_ID);
    expect(body.delta).toBe(200);
    expect(body.newScore).toBe(1400);
  });

  it('accepts a negative delta (deduct points)', async () => {
    mockRpc.mockResolvedValue(makeRpcSuccess(800));

    const res = await POST(
      makeRequest(VALID_GAME_ID, { teamId: VALID_TEAM_ID, delta: -200 }),
      makeContext(VALID_GAME_ID)
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.delta).toBe(-200);
    expect(body.newScore).toBe(800);
  });

  it('accepts boundary delta values (±10000)', async () => {
    mockRpc.mockResolvedValue(makeRpcSuccess(10000));
    const resPos = await POST(
      makeRequest(VALID_GAME_ID, { teamId: VALID_TEAM_ID, delta: 10000 }),
      makeContext(VALID_GAME_ID)
    );
    expect(resPos.status).toBe(200);

    mockRpc.mockResolvedValue(makeRpcSuccess(0));
    const resNeg = await POST(
      makeRequest(VALID_GAME_ID, { teamId: VALID_TEAM_ID, delta: -10000 }),
      makeContext(VALID_GAME_ID)
    );
    expect(resNeg.status).toBe(200);
  });
});
