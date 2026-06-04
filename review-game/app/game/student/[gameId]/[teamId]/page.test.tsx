/**
 * Unit tests for Jeopardy student page subscription reconnect logic (RG-187).
 *
 * Verifies that:
 * - On first SUBSCRIBED (initial connection), the reconnect refetch is NOT triggered
 * - On second SUBSCRIBED (after CHANNEL_ERROR), the store IS reset and data IS refetched
 * - isInitialGameSubRef resets at the start of each effect invocation so React
 *   Strict Mode's mount→unmount→remount cycle doesn't fire the reconnect path
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act, cleanup } from '@testing-library/react';
import React from 'react';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GAME_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const TEAM_ID = '11111111-2222-3333-4444-555555555555';
const DEVICE_ID = 'cccccccc-dddd-eeee-ffff-aaaaaaaaaaaa';

// ---------------------------------------------------------------------------
// Store spies (must be module-level so vi.mock factory can capture them)
// ---------------------------------------------------------------------------

const mockClearBuzzQueue = vi.fn();
const mockSetRevealedAnswer = vi.fn();

// ---------------------------------------------------------------------------
// Supabase mock — stable reference to avoid subscription effect re-running
// ---------------------------------------------------------------------------

type StatusCb = (status: string) => void;
const capturedCallbacks = new Map<string, StatusCb>();
const mockRemoveChannel = vi.fn();
const mockFrom = vi.fn();

const mockSupabase = {
  channel: vi.fn().mockImplementation((name: string) => ({
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn().mockImplementation((cb: StatusCb) => {
      capturedCallbacks.set(name, cb);
    }),
  })),
  removeChannel: mockRemoveChannel,
  from: mockFrom,
};

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => mockSupabase,
}));

vi.mock('@/lib/stores/gameStore', () => {
  const hook = vi.fn().mockReturnValue({
    buzzQueue: [],
    currentQuestion: null,
    revealedAnswer: null,
    currentPhase: 'regular',
    finalJeopardyQuestion: null,
    finalJeopardyQuestionRevealed: false,
  });
  Object.defineProperty(hook, 'getState', {
    value: () => ({
      clearBuzzQueue: mockClearBuzzQueue,
      setRevealedAnswer: mockSetRevealedAnswer,
    }),
    writable: true,
  });
  return { useGameStore: hook };
});

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useParams: () => ({ gameId: GAME_ID, teamId: TEAM_ID }),
}));

vi.mock('@/hooks/useDeviceId', () => ({
  useDeviceId: () => DEVICE_ID,
}));

vi.mock('@/hooks/useBuzzer', () => ({
  useBuzzer: () => ({ sendBuzz: vi.fn() }),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// Stub ConnectionBanner to avoid 'use client' / CSS complexity in test env
vi.mock('@/components/ui/ConnectionBanner', () => ({
  ConnectionBanner: () => null,
  BANNER_OFFSET_CLASS: 'pt-10',
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MOCK_GAME = {
  id: GAME_ID,
  status: 'active',
  game_type: 'jeopardy',
  bank_id: 'bank-1',
  num_teams: 2,
  teacher_id: 'teacher-1',
};

const MOCK_TEAM = {
  id: TEAM_ID,
  game_id: GAME_ID,
  team_number: 1,
  team_name: 'Team 1',
  score: 200,
  connection_status: 'connected',
  device_id: DEVICE_ID,
};

function makeChain(data: object | null) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data, error: null }),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Jeopardy student page — subscription reconnect (RG-187)', () => {
  let StudentPage: React.ComponentType;

  beforeEach(async () => {
    vi.clearAllMocks();
    capturedCallbacks.clear();

    // Stable from() mock — games table returns game data, teams table returns team data
    let fromCallIndex = 0;
    mockFrom.mockImplementation(() => {
      fromCallIndex++;
      // Odd calls → game queries, even calls → team queries (initial fetch pattern)
      return fromCallIndex % 2 !== 0 ? makeChain(MOCK_GAME) : makeChain(MOCK_TEAM);
    });

    // Mock the team claim API
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, teamName: 'Team 1', teamNumber: 1 }),
    }));

    // Import fresh module (cached after first import — Vitest module cache is per-run)
    const mod = await import('./page');
    StudentPage = mod.default;
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('does NOT trigger store reset on initial SUBSCRIBED', async () => {
    render(React.createElement(StudentPage));

    // Allow all effects (claim, fetch data, subscription setup) to complete
    await act(async () => {});

    const gameCallback = capturedCallbacks.get(`game:${GAME_ID}`);
    expect(gameCallback).toBeDefined();

    // First SUBSCRIBED — initial connection
    act(() => { gameCallback?.('SUBSCRIBED'); });

    expect(mockClearBuzzQueue).not.toHaveBeenCalled();
    expect(mockSetRevealedAnswer).not.toHaveBeenCalled();
  });

  it('triggers store reset and data refetch on second SUBSCRIBED after CHANNEL_ERROR', async () => {
    render(React.createElement(StudentPage));
    await act(async () => {});

    const gameCallback = capturedCallbacks.get(`game:${GAME_ID}`);
    expect(gameCallback).toBeDefined();

    // Initial connection
    act(() => { gameCallback?.('SUBSCRIBED'); });
    expect(mockClearBuzzQueue).not.toHaveBeenCalled();

    // Simulate disconnect
    act(() => { gameCallback?.('CHANNEL_ERROR'); });
    expect(mockClearBuzzQueue).not.toHaveBeenCalled();

    // Reconnect — should now trigger store reset
    act(() => { gameCallback?.('SUBSCRIBED'); });

    expect(mockClearBuzzQueue).toHaveBeenCalledOnce();
    expect(mockSetRevealedAnswer).toHaveBeenCalledWith(null);
  });

  it('does NOT trigger store reset on second SUBSCRIBED after TIMED_OUT', async () => {
    // Same behaviour as CHANNEL_ERROR — TIMED_OUT is also a real disconnect
    render(React.createElement(StudentPage));
    await act(async () => {});

    const gameCallback = capturedCallbacks.get(`game:${GAME_ID}`);
    act(() => { gameCallback?.('SUBSCRIBED'); });
    act(() => { gameCallback?.('TIMED_OUT'); });
    act(() => { gameCallback?.('SUBSCRIBED'); });

    expect(mockClearBuzzQueue).toHaveBeenCalledOnce();
  });

  it('isInitialGameSubRef resets on each effect mount (React Strict Mode safety)', async () => {
    // In React Strict Mode the effect runs twice: mount → unmount → remount.
    // The second SUBSCRIBED (from the remount) must NOT trigger the reconnect
    // path — it's still the initial connection from the user's perspective.
    // We simulate this by unmounting and remounting with the same component.
    const { unmount } = render(React.createElement(StudentPage));
    await act(async () => {});

    const firstCallback = capturedCallbacks.get(`game:${GAME_ID}`);
    act(() => { firstCallback?.('SUBSCRIBED'); });

    // Unmount (simulates Strict Mode cleanup)
    unmount();
    capturedCallbacks.clear();

    // Remount (simulates Strict Mode remount)
    render(React.createElement(StudentPage));
    await act(async () => {});

    const secondCallback = capturedCallbacks.get(`game:${GAME_ID}`);
    expect(secondCallback).toBeDefined();

    // This SUBSCRIBED is the first real one for this mount — should NOT refetch
    act(() => { secondCallback?.('SUBSCRIBED'); });

    expect(mockClearBuzzQueue).not.toHaveBeenCalled();
    expect(mockSetRevealedAnswer).not.toHaveBeenCalled();
  });
});
