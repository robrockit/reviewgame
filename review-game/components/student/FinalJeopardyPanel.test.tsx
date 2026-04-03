/**
 * @fileoverview Unit tests for FinalJeopardyPanel (RG-183).
 *
 * Tests the combined wager + answer submission form, focusing on:
 *   - Character counter updates as the user types
 *   - Question text conditional rendering (hidden/revealed)
 *   - Submit button disabled state
 *   - Confirmation state after successful submit
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import React from 'react';
import FinalJeopardyPanel from './FinalJeopardyPanel';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockUseGameStore = vi.fn();

vi.mock('@/lib/stores/gameStore', () => ({
  useGameStore: (...args: unknown[]) => mockUseGameStore(...args),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// getDeviceId returns a stable device ID in tests
vi.mock('@/hooks/useDeviceId', () => ({
  getDeviceId: () => 'test-device-id',
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FJ_QUESTION = {
  category: 'World Geography',
  question: 'This country spans 11 time zones.',
  answer: 'Russia',
};

const DEFAULT_PROPS = {
  gameId: 'game-abc',
  teamId: 'team-xyz',
  teamName: 'Team Alpha',
  currentScore: 400,
};

function setStore(overrides: object = {}) {
  mockUseGameStore.mockReturnValue({
    currentPhase: 'final_jeopardy_wager',
    finalJeopardyQuestion: FJ_QUESTION,
    finalJeopardyQuestionRevealed: false,
    finalJeopardyTeamStatuses: {},
    ...overrides,
  });
}

// ---------------------------------------------------------------------------
// Tests: character counter
// ---------------------------------------------------------------------------

describe('FinalJeopardyPanel — answer character counter', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(cleanup);

  it('shows "0 / 500 characters" when answer textarea is empty', () => {
    setStore();
    render(<FinalJeopardyPanel {...DEFAULT_PROPS} />);

    expect(screen.getByText('0 / 500 characters')).toBeInTheDocument();
  });

  it('updates the counter as the user types', () => {
    setStore();
    render(<FinalJeopardyPanel {...DEFAULT_PROPS} />);

    const textarea = screen.getByLabelText('Your Final Jeopardy answer');
    fireEvent.change(textarea, { target: { value: 'Russia' } });

    expect(screen.getByText('6 / 500 characters')).toBeInTheDocument();
  });

  it('shows the correct count for a longer input', () => {
    setStore();
    render(<FinalJeopardyPanel {...DEFAULT_PROPS} />);

    const textarea = screen.getByLabelText('Your Final Jeopardy answer');
    const text = 'A'.repeat(250);
    fireEvent.change(textarea, { target: { value: text } });

    expect(screen.getByText('250 / 500 characters')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Tests: question reveal
// ---------------------------------------------------------------------------

describe('FinalJeopardyPanel — question reveal', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(cleanup);

  it('shows placeholder text when question is not yet revealed', () => {
    setStore({ finalJeopardyQuestionRevealed: false });
    render(<FinalJeopardyPanel {...DEFAULT_PROPS} />);

    expect(screen.getByText('The question will be revealed soon...')).toBeInTheDocument();
    expect(screen.queryByText(FJ_QUESTION.question)).not.toBeInTheDocument();
  });

  it('shows the question text after teacher reveals it', () => {
    setStore({ finalJeopardyQuestionRevealed: true });
    render(<FinalJeopardyPanel {...DEFAULT_PROPS} />);

    expect(screen.getByText(FJ_QUESTION.question)).toBeInTheDocument();
    expect(screen.queryByText('The question will be revealed soon...')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Tests: submit button disabled state
// ---------------------------------------------------------------------------

describe('FinalJeopardyPanel — submit button disabled state', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(cleanup);

  it('Submit button is disabled when wager and answer are both empty', () => {
    setStore();
    render(<FinalJeopardyPanel {...DEFAULT_PROPS} />);

    expect(screen.getByRole('button', { name: 'Submit Wager & Answer' })).toBeDisabled();
  });

  it('Submit button is disabled when only wager is filled', () => {
    setStore();
    render(<FinalJeopardyPanel {...DEFAULT_PROPS} />);

    const wagerInput = screen.getByLabelText('Your Wager');
    fireEvent.change(wagerInput, { target: { value: '100' } });

    expect(screen.getByRole('button', { name: 'Submit Wager & Answer' })).toBeDisabled();
  });

  it('Submit button is enabled when both wager and answer are filled', () => {
    setStore();
    render(<FinalJeopardyPanel {...DEFAULT_PROPS} />);

    fireEvent.change(screen.getByLabelText('Your Wager'), { target: { value: '100' } });
    fireEvent.change(screen.getByLabelText('Your Final Jeopardy answer'), {
      target: { value: 'Russia' },
    });

    expect(screen.getByRole('button', { name: 'Submit Wager & Answer' })).toBeEnabled();
  });
});

// ---------------------------------------------------------------------------
// Tests: successful submission state
// ---------------------------------------------------------------------------

describe('FinalJeopardyPanel — confirmation after submit', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(cleanup);

  it('shows submitted wager and answer in confirmation state', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, submitted_at: '2026-04-01T00:00:00Z' }),
    } as Response);

    setStore();
    render(<FinalJeopardyPanel {...DEFAULT_PROPS} />);

    fireEvent.change(screen.getByLabelText('Your Wager'), { target: { value: '200' } });
    fireEvent.change(screen.getByLabelText('Your Final Jeopardy answer'), {
      target: { value: 'Russia' },
    });

    fireEvent.submit(screen.getByRole('button', { name: 'Submit Wager & Answer' }).closest('form')!);

    await waitFor(() => {
      expect(screen.getByText('Submitted!')).toBeInTheDocument();
      expect(screen.getByText('$200')).toBeInTheDocument();
      expect(screen.getByText('Russia')).toBeInTheDocument();
    });
  });
});
