/**
 * @fileoverview Unit tests for POST /api/games/[gameId]/final-jeopardy/reveal-question (RG-183).
 *
 * The route verifies teacher ownership AND game phase in a single atomic UPDATE
 * (teacher_id filter + current_phase filter). Zero rows updated → 404 covers
 * both "not the owner" and "wrong phase" in one check.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetUser = vi.fn();
const mockUpdate = vi.fn();
const mockSelect = vi.fn();

vi.mock('@/lib/admin/auth', () => ({
  createAdminServerClient: async () => ({
    auth: { getUser: () => mockGetUser() },
    from: () => ({
      update: () => ({
        eq: () => ({
          eq: () => ({
            eq: () => ({
              select: () => mockSelect(),
            }),
          }),
        }),
      }),
    }),
  }),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_GAME_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const TEACHER_USER_ID = 'tttttttt-tttt-tttt-tttt-tttttttttttt';

function makeRequest(gameId: string) {
  return new NextRequest(
    `http://localhost/api/games/${gameId}/final-jeopardy/reveal-question`,
    { method: 'POST' }
  );
}

function makeContext(gameId: string) {
  return { params: Promise.resolve({ gameId }) };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/games/[gameId]/final-jeopardy/reveal-question', () => {
  let POST: (req: NextRequest, ctx: { params: Promise<{ gameId: string }> }) => Promise<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();
    // Default: authenticated teacher
    mockGetUser.mockResolvedValue({
      data: { user: { id: TEACHER_USER_ID } },
      error: null,
    });
    // Default: 1 row updated (success)
    mockSelect.mockResolvedValue({ data: [{ id: VALID_GAME_ID }], error: null });

    const routeModule = await import('./route');
    POST = routeModule.POST;
  });

  // ── Auth ───────────────────────────────────────────────────────────────────

  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: new Error('No session') });

    const res = await POST(makeRequest(VALID_GAME_ID), makeContext(VALID_GAME_ID));

    expect(res.status).toBe(401);
  });

  // ── Input validation ───────────────────────────────────────────────────────

  it('returns 400 for invalid game UUID', async () => {
    const res = await POST(makeRequest('not-a-uuid'), makeContext('not-a-uuid'));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/Invalid game ID/i);
  });

  // ── Ownership + phase check (atomic, 0-rows-updated → 404) ────────────────

  it('returns 404 when 0 rows updated (non-owner or wrong phase)', async () => {
    // Supabase returns empty array when the teacher_id or current_phase filter
    // does not match — this single assertion covers both protection paths.
    mockSelect.mockResolvedValue({ data: [], error: null });

    const res = await POST(makeRequest(VALID_GAME_ID), makeContext(VALID_GAME_ID));

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/not found|not in wager/i);
  });

  it('returns 500 on database error', async () => {
    mockSelect.mockResolvedValue({ data: null, error: new Error('DB error') });

    const res = await POST(makeRequest(VALID_GAME_ID), makeContext(VALID_GAME_ID));

    expect(res.status).toBe(500);
  });

  // ── Success ────────────────────────────────────────────────────────────────

  it('returns 200 on success', async () => {
    const res = await POST(makeRequest(VALID_GAME_ID), makeContext(VALID_GAME_ID));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});
