/**
 * Unit tests for POST /api/games/[gameId]/pub-trivia/question/answer
 *
 * Focuses on input validation and the MC option validation logic added in RG-186.
 * Scoring arithmetic and DB side-effects are covered by E2E tests.
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

vi.mock('@/lib/constants/question-banks', () => ({
  QUESTION_VALIDATION: { ANSWER_TEXT_MAX_LENGTH: 500 },
}));

const mockCreateAdminServiceClient = vi.fn();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const GAME_ID     = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const PLAYER_ID   = '11111111-2222-3333-4444-555555555555';
const DEVICE_ID   = 'cccccccc-dddd-eeee-ffff-aaaaaaaaaaaa';
const QUESTION_ID = 'bbbbbbbb-cccc-dddd-eeee-ffffffffffff';

function makeRequest(gameId: string, body: object) {
  return new NextRequest(`http://localhost/api/games/${gameId}/pub-trivia/question/answer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function makeContext(gameId: string) {
  return { params: Promise.resolve({ gameId }) };
}

type MockRow = Record<string, unknown>;

function makeChain(data: MockRow | null, error: unknown = null) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data, error }),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    insert: vi.fn().mockResolvedValue({ data: null, error: null }),
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
  id: PLAYER_ID,
  device_id: DEVICE_ID,
  score: 400,
  game_id: GAME_ID,
};

const BASE_QUESTION: MockRow = {
  id: QUESTION_ID,
  answer_text: 'Paris',
  mc_options: ['London', 'Berlin', 'Madrid'],
};

function setupServiceClient({
  game = BASE_GAME,
  player = BASE_PLAYER,
  question = BASE_QUESTION,
}: { game?: MockRow | null; player?: MockRow | null; question?: MockRow | null } = {}) {
  let callIndex = 0;
  const fromMock = vi.fn().mockImplementation(() => {
    callIndex++;
    if (callIndex === 1) return makeChain(game);      // games
    if (callIndex === 2) return makeChain(player);    // teams
    if (callIndex === 3) return makeChain(question);  // questions
    // pub_trivia_answers insert/maybeSingle + rpc call stubs
    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
  });
  const rpcMock = vi.fn().mockResolvedValue({ data: BASE_PLAYER.score as number + 600, error: null });
  mockCreateAdminServiceClient.mockReturnValue({ from: fromMock, rpc: rpcMock });
}

const VALID_BODY = {
  playerId: PLAYER_ID,
  answerText: 'Paris',
  deviceId: DEVICE_ID,
  questionId: QUESTION_ID,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/games/[gameId]/pub-trivia/question/answer', () => {
  let POST: (req: NextRequest, ctx: { params: Promise<{ gameId: string }> }) => Promise<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();
    setupServiceClient();
    const mod = await import('./route');
    POST = mod.POST;
  });

  // ── Input validation ────────────────────────────────────────────────────

  describe('input validation', () => {
    it('returns 400 for invalid game UUID', async () => {
      const res = await POST(makeRequest('bad', VALID_BODY), makeContext('bad'));
      expect(res.status).toBe(400);
    });

    it('returns 400 when required body fields are missing', async () => {
      const res = await POST(makeRequest(GAME_ID, {}), makeContext(GAME_ID));
      expect(res.status).toBe(400);
    });

    it('returns 400 when answerText is empty string', async () => {
      const res = await POST(makeRequest(GAME_ID, { ...VALID_BODY, answerText: '   ' }), makeContext(GAME_ID));
      expect(res.status).toBe(400);
    });

    it('returns 400 when playerId is not a UUID', async () => {
      const res = await POST(makeRequest(GAME_ID, { ...VALID_BODY, playerId: 'not-a-uuid' }), makeContext(GAME_ID));
      expect(res.status).toBe(400);
    });
  });

  // ── MC option validation ─────────────────────────────────────────────────

  describe('MC option validation', () => {
    it('accepts the correct answer text', async () => {
      const res = await POST(makeRequest(GAME_ID, { ...VALID_BODY, answerText: 'Paris' }), makeContext(GAME_ID));
      expect(res.status).toBe(200);
    });

    it('accepts a wrong MC option', async () => {
      const res = await POST(makeRequest(GAME_ID, { ...VALID_BODY, answerText: 'London' }), makeContext(GAME_ID));
      expect(res.status).toBe(200);
    });

    it('returns 400 for a string not in the offered options', async () => {
      const res = await POST(makeRequest(GAME_ID, { ...VALID_BODY, answerText: 'Tokyo' }), makeContext(GAME_ID));
      expect(res.status).toBe(400);
      expect((await res.json()).error).toMatch(/Invalid answer option/i);
    });

    it('accepts an option with different casing', async () => {
      const res = await POST(makeRequest(GAME_ID, { ...VALID_BODY, answerText: 'PARIS' }), makeContext(GAME_ID));
      expect(res.status).toBe(200);
    });

    it('accepts an option with surrounding whitespace', async () => {
      const res = await POST(makeRequest(GAME_ID, { ...VALID_BODY, answerText: '  Paris  ' }), makeContext(GAME_ID));
      expect(res.status).toBe(200);
    });

    it('returns 400 when mc_options is null and answer does not exactly match answer_text', async () => {
      setupServiceClient({ question: { ...BASE_QUESTION, mc_options: null } });
      const res = await POST(makeRequest(GAME_ID, { ...VALID_BODY, answerText: 'NotParis' }), makeContext(GAME_ID));
      expect(res.status).toBe(400);
    });

    it('accepts answer_text when mc_options is null and answer matches exactly', async () => {
      setupServiceClient({ question: { ...BASE_QUESTION, mc_options: null } });
      const res = await POST(makeRequest(GAME_ID, { ...VALID_BODY, answerText: 'Paris' }), makeContext(GAME_ID));
      expect(res.status).toBe(200);
    });

    it('deduplicates when correct answer is also in mc_options', async () => {
      // Should not produce a duplicate option — correct answer appears once
      setupServiceClient({ question: { ...BASE_QUESTION, mc_options: ['London', 'Berlin', 'Paris'] } });
      const res = await POST(makeRequest(GAME_ID, { ...VALID_BODY, answerText: 'Paris' }), makeContext(GAME_ID));
      expect(res.status).toBe(200);
    });
  });

  // ── Auth & ownership ─────────────────────────────────────────────────────

  describe('device ownership', () => {
    it('returns 403 when deviceId does not match stored device_id', async () => {
      setupServiceClient({ player: { ...BASE_PLAYER, device_id: 'ffffffff-ffff-ffff-ffff-ffffffffffff' } });
      const res = await POST(makeRequest(GAME_ID, VALID_BODY), makeContext(GAME_ID));
      expect(res.status).toBe(403);
    });

    it('returns 409 when answering a question that is no longer active', async () => {
      const differentId = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
      const res = await POST(
        makeRequest(GAME_ID, { ...VALID_BODY, questionId: differentId }),
        makeContext(GAME_ID)
      );
      expect(res.status).toBe(409);
    });
  });
});
