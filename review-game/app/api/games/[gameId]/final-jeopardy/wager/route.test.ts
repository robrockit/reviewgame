import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from './route';

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const mockCreateAdminServerClient = vi.fn();
const mockCreateAdminServiceClient = vi.fn();

vi.mock('@/lib/admin/auth', () => ({
  createAdminServerClient: () => mockCreateAdminServerClient(),
  createAdminServiceClient: () => mockCreateAdminServiceClient(),
}));

const mockVerifyDeviceOwnsTeam = vi.fn();
const mockGetDeviceIdFromRequest = vi.fn();

vi.mock('@/lib/auth/device', () => ({
  verifyDeviceOwnsTeam: (...args: unknown[]) => mockVerifyDeviceOwnsTeam(...args),
  getDeviceIdFromRequest: (...args: unknown[]) => mockGetDeviceIdFromRequest(...args),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

const VALID_GAME_ID = '00000000-0000-0000-0000-000000000001';
const VALID_TEAM_ID = '00000000-0000-0000-0000-000000000002';

function makeRequest(body: Record<string, unknown>, headers: Record<string, string> = {}) {
  return new NextRequest(`http://localhost/api/games/${VALID_GAME_ID}/final-jeopardy/wager`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

function makeContext(gameId = VALID_GAME_ID) {
  return { params: Promise.resolve({ gameId }) };
}

function makeRpcResult(success: boolean, overrides: Record<string, unknown> = {}) {
  return {
    data: [{ success, submitted_at: '2026-01-01T00:00:00Z', error_message: null, ...overrides }],
    error: null,
  };
}

// ─── Two-client invariant ─────────────────────────────────────────────────────

describe('POST /api/games/[gameId]/final-jeopardy/wager — two-client invariant', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateAdminServerClient.mockResolvedValue({});
    mockGetDeviceIdFromRequest.mockReturnValue('device-abc');
  });

  it('does NOT call createAdminServiceClient when verifyDeviceOwnsTeam returns false', async () => {
    mockVerifyDeviceOwnsTeam.mockResolvedValue(false);

    const req = makeRequest({ teamId: VALID_TEAM_ID, wager: 100 });
    const res = await POST(req, makeContext());

    expect(res.status).toBe(403);
    expect(mockCreateAdminServiceClient).not.toHaveBeenCalled();
  });

  it('calls createAdminServiceClient only after verifyDeviceOwnsTeam passes', async () => {
    mockVerifyDeviceOwnsTeam.mockResolvedValue(true);
    mockCreateAdminServiceClient.mockReturnValue({
      rpc: vi.fn().mockResolvedValue(makeRpcResult(true)),
    });

    const req = makeRequest({ teamId: VALID_TEAM_ID, wager: 100 });
    await POST(req, makeContext());

    expect(mockVerifyDeviceOwnsTeam).toHaveBeenCalledTimes(1);
    expect(mockCreateAdminServiceClient).toHaveBeenCalledTimes(1);
  });

  it('passes the device ID from the request to verifyDeviceOwnsTeam', async () => {
    mockGetDeviceIdFromRequest.mockReturnValue('device-xyz');
    mockVerifyDeviceOwnsTeam.mockResolvedValue(false);

    const req = makeRequest({ teamId: VALID_TEAM_ID, wager: 0 });
    await POST(req, makeContext());

    expect(mockVerifyDeviceOwnsTeam).toHaveBeenCalledWith(
      expect.anything(),
      VALID_TEAM_ID,
      'device-xyz',
      VALID_GAME_ID,
    );
  });
});

// ─── Input validation ─────────────────────────────────────────────────────────
//
// Validation is split across two auth tiers:
//   Pre-auth  — structural checks (UUID format, required fields) — run before verifyDeviceOwnsTeam
//               so we don't waste a DB round-trip on obviously bad input
//   Post-auth — range/type checks (negative, non-integer) — run after auth to avoid
//               leaking constraint details to unauthenticated callers
//
// There is no upper-bound check in the route. The max wager (team's current score)
// requires live team data and is enforced atomically inside submit_final_jeopardy_wager.

describe('POST /api/games/[gameId]/final-jeopardy/wager — input validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateAdminServerClient.mockResolvedValue({});
    mockGetDeviceIdFromRequest.mockReturnValue('device-abc');
    // Default to auth failing — pre-auth checks must reject before reaching verifyDeviceOwnsTeam
    mockVerifyDeviceOwnsTeam.mockResolvedValue(false);
  });

  it('returns 400 for an invalid gameId UUID', async () => {
    const req = makeRequest({ teamId: VALID_TEAM_ID, wager: 100 });
    const res = await POST(req, makeContext('not-a-uuid'));
    expect(res.status).toBe(400);
  });

  it('returns 400 when teamId is missing', async () => {
    const req = makeRequest({ wager: 100 });
    const res = await POST(req, makeContext());
    expect(res.status).toBe(400);
  });

  it('returns 400 when wager is missing', async () => {
    const req = makeRequest({ teamId: VALID_TEAM_ID });
    const res = await POST(req, makeContext());
    expect(res.status).toBe(400);
  });

  // Range/type checks happen post-auth (auth must pass to reach them)
  it('returns 400 for a negative wager', async () => {
    mockVerifyDeviceOwnsTeam.mockResolvedValue(true);
    const req = makeRequest({ teamId: VALID_TEAM_ID, wager: -1 });
    const res = await POST(req, makeContext());
    expect(res.status).toBe(400);
  });

  it('returns 400 for a non-integer wager', async () => {
    mockVerifyDeviceOwnsTeam.mockResolvedValue(true);
    const req = makeRequest({ teamId: VALID_TEAM_ID, wager: 50.5 });
    const res = await POST(req, makeContext());
    expect(res.status).toBe(400);
  });

  // Upper-bound (wager > team score) is enforced by the DB function which has access
  // to live team data; the route propagates that as a 400 from the DB result
  it('returns 400 when the DB function rejects an over-limit wager', async () => {
    mockVerifyDeviceOwnsTeam.mockResolvedValue(true);
    mockCreateAdminServiceClient.mockReturnValue({
      rpc: vi.fn().mockResolvedValue(makeRpcResult(false, { error_message: 'Wager cannot exceed 200' })),
    });
    const req = makeRequest({ teamId: VALID_TEAM_ID, wager: 99999 });
    const res = await POST(req, makeContext());
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toBe('Wager cannot exceed 200');
  });
});

// ─── Successful submission ────────────────────────────────────────────────────

describe('POST /api/games/[gameId]/final-jeopardy/wager — success', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateAdminServerClient.mockResolvedValue({});
    mockGetDeviceIdFromRequest.mockReturnValue('device-abc');
    mockVerifyDeviceOwnsTeam.mockResolvedValue(true);
  });

  it('returns 200 with success payload on valid submission', async () => {
    mockCreateAdminServiceClient.mockReturnValue({
      rpc: vi.fn().mockResolvedValue(makeRpcResult(true)),
    });

    const req = makeRequest({ teamId: VALID_TEAM_ID, wager: 500 });
    const res = await POST(req, makeContext());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.teamId).toBe(VALID_TEAM_ID);
    expect(body.wager).toBe(500);
  });

  it('returns 400 when the DB function reports failure', async () => {
    mockCreateAdminServiceClient.mockReturnValue({
      rpc: vi.fn().mockResolvedValue(makeRpcResult(false, { error_message: 'Wager already submitted' })),
    });

    const req = makeRequest({ teamId: VALID_TEAM_ID, wager: 100 });
    const res = await POST(req, makeContext());
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('Wager already submitted');
  });

  it('returns 500 when the RPC call itself errors', async () => {
    mockCreateAdminServiceClient.mockReturnValue({
      rpc: vi.fn().mockResolvedValue({ data: null, error: new Error('DB error') }),
    });

    const req = makeRequest({ teamId: VALID_TEAM_ID, wager: 100 });
    const res = await POST(req, makeContext());

    expect(res.status).toBe(500);
  });
});
