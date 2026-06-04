/**
 * Unit tests for GET /api/games/[gameId]/pub-trivia/state
 *
 * Covers: input validation, device identity verification, phase detection,
 * and null-device_id handling. DB behaviour (real data) is covered by E2E.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/admin/auth', () => ({
  createAdminServiceClient: () => mockCreateAdminServiceClient(),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const mockCreateAdminServiceClient = vi.fn();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const GAME_ID   = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const PLAYER_ID = '11111111-2222-3333-4444-555555555555';
const DEVICE_ID = 'cccccccc-dddd-eeee-ffff-aaaaaaaaaaaa';
const QUESTION_ID = 'bbbbbbbb-cccc-dddd-eeee-ffffffffffff';

function makeRequest(gameId: string, params: Record<string, string> = {}) {
  const url = new URL(`http://localhost/api/games/${gameId}/pub-trivia/state`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new NextRequest(url.toString());
}

function makeContext(gameId: string) {
  return { params: Promise.resolve({ gameId }) };
}

type MockRow = Record<string, unknown>;

/** Build a chainable Supabase mock that resolves to { data, error }. */
function makeChain(data: MockRow | null, error: unknown = null) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data, error }),
    maybeSingle: vi.fn().mockResolvedValue({ data, error }),
  };
  return chain;
}

const BASE_GAME: MockRow = {
  status: 'in_progress',
  game_type: 'pub_trivia',
  current_question_index: 0,
  pub_trivia_question_order: [QUESTION_ID],
  current_question_started_at: new Date(Date.now() - 5_000).toISOString(),
  timer_seconds: 20,
};

const BASE_PLAYER: MockRow = {
  score: 800,
  device_id: DEVICE_ID,
};

const BASE_QUESTION: MockRow = {
  id: QUESTION_ID,
  question_text: 'What is 2+2?',
  answer_text: '4',
  category: 'Maths',
  mc_options: ['1', '2', '3'],
};

/** Set up serviceClient to return game and player from parallel fetch, then question and answer check. */
function setupServiceClient({
  game = BASE_GAME,
  gameError = null,
  player = BASE_PLAYER,
  playerError = null,
  question = BASE_QUESTION,
  questionError = null,
  existingAnswer = null,
}: {
  game?: MockRow | null;
  gameError?: unknown;
  player?: MockRow | null;
  playerError?: unknown;
  question?: MockRow | null;
  questionError?: unknown;
  existingAnswer?: MockRow | null;
} = {}) {
  // Promise.all resolves each query in sequence of .single() calls.
  // We control order by tracking call count on the service client stub.
  let callIndex = 0;
  const fromMock = vi.fn().mockImplementation(() => {
    callIndex++;
    if (callIndex === 1) return makeChain(game, gameError);      // games fetch
    if (callIndex === 2) return makeChain(player, playerError);  // teams fetch
    if (callIndex === 3) return makeChain(question, questionError); // questions fetch
    // pub_trivia_answers maybeSingle
    const c = makeChain(existingAnswer);
    return c;
  });
  mockCreateAdminServiceClient.mockReturnValue({ from: fromMock });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/games/[gameId]/pub-trivia/state', () => {
  let GET: (req: NextRequest, ctx: { params: Promise<{ gameId: string }> }) => Promise<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();
    setupServiceClient();
    const mod = await import('./route');
    GET = mod.GET;
  });

  // ── Input validation ────────────────────────────────────────────────────

  describe('input validation', () => {
    it('returns 400 for invalid game UUID', async () => {
      const res = await GET(makeRequest('not-a-uuid', { playerId: PLAYER_ID, deviceId: DEVICE_ID }), makeContext('not-a-uuid'));
      expect(res.status).toBe(400);
      expect((await res.json()).error).toMatch(/Invalid game ID/i);
    });

    it('returns 400 when playerId is missing', async () => {
      const res = await GET(makeRequest(GAME_ID, { deviceId: DEVICE_ID }), makeContext(GAME_ID));
      expect(res.status).toBe(400);
      expect((await res.json()).error).toMatch(/playerId/i);
    });

    it('returns 400 when playerId is not a UUID', async () => {
      const res = await GET(makeRequest(GAME_ID, { playerId: 'bad', deviceId: DEVICE_ID }), makeContext(GAME_ID));
      expect(res.status).toBe(400);
    });

    it('returns 400 when deviceId is missing', async () => {
      const res = await GET(makeRequest(GAME_ID, { playerId: PLAYER_ID }), makeContext(GAME_ID));
      expect(res.status).toBe(400);
      expect((await res.json()).error).toMatch(/deviceId/i);
    });

    it('returns 400 when deviceId is not a UUID', async () => {
      const res = await GET(makeRequest(GAME_ID, { playerId: PLAYER_ID, deviceId: 'bad' }), makeContext(GAME_ID));
      expect(res.status).toBe(400);
    });
  });

  // ── Device identity ─────────────────────────────────────────────────────

  describe('device identity verification', () => {
    it('returns 403 when deviceId does not match stored device_id', async () => {
      setupServiceClient({ player: { ...BASE_PLAYER, device_id: 'ffffffff-ffff-ffff-ffff-ffffffffffff' } });
      const res = await GET(makeRequest(GAME_ID, { playerId: PLAYER_ID, deviceId: DEVICE_ID }), makeContext(GAME_ID));
      expect(res.status).toBe(403);
    });

    it('returns 401 when stored device_id is null (player joined before device binding)', async () => {
      setupServiceClient({ player: { ...BASE_PLAYER, device_id: null } });
      const res = await GET(makeRequest(GAME_ID, { playerId: PLAYER_ID, deviceId: DEVICE_ID }), makeContext(GAME_ID));
      expect(res.status).toBe(401);
    });

    it('returns 200 when deviceId matches stored device_id', async () => {
      const res = await GET(makeRequest(GAME_ID, { playerId: PLAYER_ID, deviceId: DEVICE_ID }), makeContext(GAME_ID));
      expect(res.status).toBe(200);
    });
  });

  // ── Phase detection ─────────────────────────────────────────────────────

  describe('phase detection', () => {
    it('returns phase: completed for a completed game', async () => {
      setupServiceClient({ game: { ...BASE_GAME, status: 'completed' } });
      const res = await GET(makeRequest(GAME_ID, { playerId: PLAYER_ID, deviceId: DEVICE_ID }), makeContext(GAME_ID));
      const body = await res.json();
      expect(res.status).toBe(200);
      expect(body.phase).toBe('completed');
      expect(body.score).toBe(800);
    });

    it('returns phase: lobby for a setup game', async () => {
      setupServiceClient({ game: { ...BASE_GAME, status: 'setup', current_question_started_at: null } });
      const res = await GET(makeRequest(GAME_ID, { playerId: PLAYER_ID, deviceId: DEVICE_ID }), makeContext(GAME_ID));
      const body = await res.json();
      expect(res.status).toBe(200);
      expect(body.phase).toBe('lobby');
    });

    it('returns phase: lobby for in_progress game with no active question', async () => {
      setupServiceClient({ game: { ...BASE_GAME, current_question_started_at: null } });
      const res = await GET(makeRequest(GAME_ID, { playerId: PLAYER_ID, deviceId: DEVICE_ID }), makeContext(GAME_ID));
      const body = await res.json();
      expect(body.phase).toBe('lobby');
    });

    it('returns phase: question for in_progress game with unanswered active question', async () => {
      setupServiceClient({ existingAnswer: null });
      const res = await GET(makeRequest(GAME_ID, { playerId: PLAYER_ID, deviceId: DEVICE_ID }), makeContext(GAME_ID));
      const body = await res.json();
      expect(res.status).toBe(200);
      expect(body.phase).toBe('question');
      expect(body.question).toBeDefined();
      expect(body.question.id).toBe(QUESTION_ID);
      expect(body.durationMs).toBe(20_000);
      expect(typeof body.startedAt).toBe('number');
    });

    it('returns phase: answered when player already submitted an answer', async () => {
      setupServiceClient({ existingAnswer: { id: 'some-answer-id' } });
      const res = await GET(makeRequest(GAME_ID, { playerId: PLAYER_ID, deviceId: DEVICE_ID }), makeContext(GAME_ID));
      const body = await res.json();
      expect(res.status).toBe(200);
      expect(body.phase).toBe('answered');
      expect(body.question).toBeDefined();
    });

    it('does not include answer_text in question payload', async () => {
      const res = await GET(makeRequest(GAME_ID, { playerId: PLAYER_ID, deviceId: DEVICE_ID }), makeContext(GAME_ID));
      const body = await res.json();
      expect(body.question).not.toHaveProperty('correctAnswer');
      expect(body.question).not.toHaveProperty('answer_text');
      // But the correct answer must be present in the options array (shuffled in)
      expect(body.question.options).toContain('4');
    });

    it('returns phase: lobby if question_order is null for active game', async () => {
      setupServiceClient({ game: { ...BASE_GAME, pub_trivia_question_order: null } });
      const res = await GET(makeRequest(GAME_ID, { playerId: PLAYER_ID, deviceId: DEVICE_ID }), makeContext(GAME_ID));
      const body = await res.json();
      expect(body.phase).toBe('lobby');
    });
  });

  // ── Error handling ──────────────────────────────────────────────────────

  describe('error handling', () => {
    it('returns 404 when game is not found', async () => {
      setupServiceClient({ game: null, gameError: new Error('not found') });
      const res = await GET(makeRequest(GAME_ID, { playerId: PLAYER_ID, deviceId: DEVICE_ID }), makeContext(GAME_ID));
      expect(res.status).toBe(404);
    });

    it('returns 404 when player is not found in the game', async () => {
      setupServiceClient({ player: null, playerError: new Error('not found') });
      const res = await GET(makeRequest(GAME_ID, { playerId: PLAYER_ID, deviceId: DEVICE_ID }), makeContext(GAME_ID));
      expect(res.status).toBe(404);
    });

    it('returns 400 for a non-pub_trivia game', async () => {
      setupServiceClient({ game: { ...BASE_GAME, game_type: 'jeopardy' } });
      const res = await GET(makeRequest(GAME_ID, { playerId: PLAYER_ID, deviceId: DEVICE_ID }), makeContext(GAME_ID));
      expect(res.status).toBe(400);
    });

    it('falls back to lobby if question fetch fails', async () => {
      setupServiceClient({ question: null, questionError: new Error('db error') });
      const res = await GET(makeRequest(GAME_ID, { playerId: PLAYER_ID, deviceId: DEVICE_ID }), makeContext(GAME_ID));
      const body = await res.json();
      expect(res.status).toBe(200);
      expect(body.phase).toBe('lobby');
    });
  });
});
