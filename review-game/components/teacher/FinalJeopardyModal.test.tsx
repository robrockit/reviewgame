/**
 * @fileoverview Unit tests for FinalJeopardyModal (RG-183).
 *
 * Focuses on the two-step card-flip logic that lives in component state:
 *   Step 0 — card is unflipped: "Click to reveal" shown, onClick flips it.
 *   Step 1 — card is flipped but not graded: wager + answer + grade buttons.
 *   Step 2 — card is graded: wager + answer (read-only), grade buttons gone.
 *
 * "Finish Game" appears only after every team has been graded.
 *
 * Integration/API behaviour (onRevealTeam calling the reveal endpoint) is
 * covered by E2E tests; these tests exercise pure React state transitions.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import React from 'react';
import FinalJeopardyModal from './FinalJeopardyModal';

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

// Headless UI Dialog uses portals and real animations — replace with thin
// wrappers that render children inline so jest-dom can query them.
vi.mock('@headlessui/react', async () => {
  const React = await import('react');
  const Transition = Object.assign(
    ({ children, show }: { children: React.ReactNode; show: boolean }) =>
      show ? React.createElement(React.Fragment, null, children) : null,
    {
      Child: ({ children }: { children: React.ReactNode }) =>
        React.createElement(React.Fragment, null, children),
    }
  );
  const Dialog = Object.assign(
    ({ children }: { children: React.ReactNode }) =>
      React.createElement('div', { 'data-testid': 'dialog' }, children),
    {
      Panel: ({ children, className }: { children: React.ReactNode; className?: string }) =>
        React.createElement('div', { className }, children),
      Title: ({ children }: { children: React.ReactNode }) =>
        React.createElement('h2', null, children),
    }
  );
  return { Dialog, Transition };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEAM_1 = {
  id: 'team-1',
  name: 'Team Alpha',
  team_name: 'Team Alpha',
  score: 400,
  final_jeopardy_wager: 200,
  // Use a distinct answer so it doesn't collide with FJ_QUESTION.answer ('Russia')
  // which is shown separately in the "Correct Answer:" header.
  final_jeopardy_answer: 'Moscow',
};

const TEAM_2 = {
  id: 'team-2',
  name: 'Team Beta',
  team_name: 'Team Beta',
  score: 600,
  final_jeopardy_wager: 100,
  final_jeopardy_answer: 'France',
};

const FJ_QUESTION = {
  category: 'World Geography',
  question: 'This country spans 11 time zones.',
  answer: 'Russia',
};

function makeDefaultProps(overrides: Partial<React.ComponentProps<typeof FinalJeopardyModal>> = {}) {
  return {
    isOpen: true,
    gameId: 'game-abc',
    onRevealQuestion: vi.fn().mockResolvedValue(undefined),
    onAdvancePhase: vi.fn().mockResolvedValue(undefined),
    onRevealTeam: vi.fn().mockResolvedValue(undefined),
    onFinishGame: vi.fn().mockResolvedValue(undefined),
    onSkip: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function setStore(overrides: object = {}) {
  mockUseGameStore.mockReturnValue({
    currentPhase: 'final_jeopardy_reveal',
    finalJeopardyQuestion: FJ_QUESTION,
    finalJeopardyQuestionRevealed: false,
    allTeams: [TEAM_1],
    ...overrides,
  });
}

// ---------------------------------------------------------------------------
// Tests: wager phase
// ---------------------------------------------------------------------------

describe('FinalJeopardyModal — wager phase', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(cleanup);

  it('shows Reveal Question button before question is revealed', () => {
    setStore({ currentPhase: 'final_jeopardy_wager', finalJeopardyQuestionRevealed: false });
    render(<FinalJeopardyModal {...makeDefaultProps()} />);

    expect(screen.getByRole('button', { name: 'Reveal Question' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Begin Reveals' })).not.toBeInTheDocument();
  });

  it('shows Begin Reveals button after question is revealed', () => {
    setStore({ currentPhase: 'final_jeopardy_wager', finalJeopardyQuestionRevealed: true });
    render(<FinalJeopardyModal {...makeDefaultProps()} />);

    expect(screen.queryByRole('button', { name: 'Reveal Question' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Begin Reveals' })).toBeInTheDocument();
  });

  it('calls onRevealQuestion when Reveal Question is clicked', async () => {
    const onRevealQuestion = vi.fn().mockResolvedValue(undefined);
    setStore({ currentPhase: 'final_jeopardy_wager', finalJeopardyQuestionRevealed: false });
    render(<FinalJeopardyModal {...makeDefaultProps({ onRevealQuestion })} />);

    fireEvent.click(screen.getByRole('button', { name: 'Reveal Question' }));

    await waitFor(() => expect(onRevealQuestion).toHaveBeenCalledOnce());
  });
});

// ---------------------------------------------------------------------------
// Tests: reveal phase — card flip logic
// ---------------------------------------------------------------------------

describe('FinalJeopardyModal — reveal phase card flip', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(cleanup);

  it('shows "Click to reveal" on unflipped cards', () => {
    setStore();
    render(<FinalJeopardyModal {...makeDefaultProps()} />);

    expect(screen.getByText('Click to reveal')).toBeInTheDocument();
    // Grade buttons are not visible until the card is flipped
    expect(screen.queryByRole('button', { name: /correct/i })).not.toBeInTheDocument();
  });

  it('flipping a card shows wager, answer, and grade buttons', () => {
    setStore();
    render(<FinalJeopardyModal {...makeDefaultProps()} />);

    fireEvent.click(screen.getByText('Click to reveal'));

    expect(screen.queryByText('Click to reveal')).not.toBeInTheDocument();
    expect(screen.getByText('$200')).toBeInTheDocument();
    // TEAM_1.final_jeopardy_answer is 'Moscow' (distinct from the correct answer 'Russia')
    expect(screen.getByText('Moscow')).toBeInTheDocument();
    // Use getByText to avoid matching 'incorrect' which contains 'correct'
    expect(screen.getByText('Correct')).toBeInTheDocument();
    expect(screen.getByText('Incorrect')).toBeInTheDocument();
  });

  it('a flipped card has no click handler — cannot be "re-flipped"', () => {
    setStore();
    render(<FinalJeopardyModal {...makeDefaultProps()} />);

    fireEvent.click(screen.getByText('Click to reveal'));

    // The flip div (with onClick) is gone after flipping — no "?" or "Click to reveal"
    expect(screen.queryByText('Click to reveal')).not.toBeInTheDocument();
    expect(screen.queryByText('?')).not.toBeInTheDocument();
  });

  it('grading a team calls onRevealTeam and removes grade buttons', async () => {
    const onRevealTeam = vi.fn().mockResolvedValue(undefined);
    setStore();
    render(<FinalJeopardyModal {...makeDefaultProps({ onRevealTeam })} />);

    // Flip then grade
    fireEvent.click(screen.getByText('Click to reveal'));
    fireEvent.click(screen.getByText('Correct'));

    await waitFor(() => {
      expect(onRevealTeam).toHaveBeenCalledWith('team-1', true);
      expect(screen.queryByText('Correct')).not.toBeInTheDocument();
      expect(screen.queryByText('Incorrect')).not.toBeInTheDocument();
    });
  });

  it('grading incorrect calls onRevealTeam with isCorrect=false', async () => {
    const onRevealTeam = vi.fn().mockResolvedValue(undefined);
    setStore();
    render(<FinalJeopardyModal {...makeDefaultProps({ onRevealTeam })} />);

    fireEvent.click(screen.getByText('Click to reveal'));
    fireEvent.click(screen.getByText('Incorrect'));

    await waitFor(() => {
      expect(onRevealTeam).toHaveBeenCalledWith('team-1', false);
    });
  });
});

// ---------------------------------------------------------------------------
// Tests: Finish Game gating
// ---------------------------------------------------------------------------

describe('FinalJeopardyModal — Finish Game gating', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(cleanup);

  it('Finish Game button is not shown before any team is graded', () => {
    setStore();
    render(<FinalJeopardyModal {...makeDefaultProps()} />);

    expect(screen.queryByRole('button', { name: 'Finish Game' })).not.toBeInTheDocument();
  });

  it('Finish Game appears only after all teams are graded (1 team)', async () => {
    const onRevealTeam = vi.fn().mockResolvedValue(undefined);
    setStore();
    render(<FinalJeopardyModal {...makeDefaultProps({ onRevealTeam })} />);

    fireEvent.click(screen.getByText('Click to reveal'));
    fireEvent.click(screen.getByText('Correct'));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Finish Game' })).toBeInTheDocument()
    );
  });

  it('Finish Game does not appear until the last of 2 teams is graded', async () => {
    const onRevealTeam = vi.fn().mockResolvedValue(undefined);
    setStore({ allTeams: [TEAM_1, TEAM_2] });
    render(<FinalJeopardyModal {...makeDefaultProps({ onRevealTeam })} />);

    // Flip and grade TEAM_1 — wait for its grade buttons to disappear before touching TEAM_2
    const [flip1] = screen.getAllByText('Click to reveal');
    fireEvent.click(flip1);
    // After flip, TEAM_1 shows 'Correct'/'Incorrect'; TEAM_2 still shows 'Click to reveal'
    fireEvent.click(screen.getAllByText('Correct')[0]);

    await waitFor(() => {
      // TEAM_1 grade buttons gone, TEAM_2 unflipped — Finish Game must not appear yet
      expect(screen.queryByText('Correct')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Finish Game' })).not.toBeInTheDocument();
    });

    // Flip and grade TEAM_2
    fireEvent.click(screen.getByText('Click to reveal'));
    fireEvent.click(screen.getByText('Correct'));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Finish Game' })).toBeInTheDocument()
    );
  });
});
