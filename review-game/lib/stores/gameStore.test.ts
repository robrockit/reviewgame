import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from './gameStore';
import type { GameData, Team, FinalJeopardyQuestion, FinalJeopardyTeamStatus } from '../../types/game';

// Helpers ─────────────────────────────────────────────────────────────────────

const makeGameData = (overrides?: Partial<GameData>): GameData => ({
  id: 'game-1',
  categories: [
    {
      id: 'cat-1',
      name: 'Science',
      questions: [
        { id: 'q-1', value: 100, text: 'Question 1', isUsed: false },
        { id: 'q-2', value: 200, text: 'Question 2', isUsed: false },
      ],
    },
  ],
  ...overrides,
});

const makeTeam = (id: string, score = 0): Team => ({
  id,
  name: `Team ${id}`,
  team_name: `Team ${id}`,
  score,
});

const makeFJQuestion = (): FinalJeopardyQuestion => ({
  category: 'History',
  question: 'Who was the first US president?',
  answer: 'George Washington',
});

// ─────────────────────────────────────────────────────────────────────────────

describe('gameStore', () => {
  // Reset to initial state before every test to prevent cross-test contamination
  beforeEach(() => {
    useGameStore.getState().reset();
  });

  // Initial state ─────────────────────────────────────────────────────────────

  describe('initial state', () => {
    it('starts with null currentGameData', () => {
      expect(useGameStore.getState().currentGameData).toBeNull();
    });

    it('starts with empty teams array', () => {
      expect(useGameStore.getState().allTeams).toEqual([]);
    });

    it('starts with regular phase', () => {
      expect(useGameStore.getState().currentPhase).toBe('regular');
    });

    it('starts with null finalJeopardyQuestion', () => {
      expect(useGameStore.getState().finalJeopardyQuestion).toBeNull();
    });

    it('starts with empty finalJeopardyTeamStatuses', () => {
      expect(useGameStore.getState().finalJeopardyTeamStatuses).toEqual({});
    });

    it('starts with empty buzzQueue', () => {
      expect(useGameStore.getState().buzzQueue).toEqual([]);
    });
  });

  // setGame ───────────────────────────────────────────────────────────────────

  describe('setGame', () => {
    it('stores game data', () => {
      const game = makeGameData();
      useGameStore.getState().setGame(game);
      expect(useGameStore.getState().currentGameData).toEqual(game);
    });

    it('clears game data when passed null', () => {
      useGameStore.getState().setGame(makeGameData());
      useGameStore.getState().setGame(null);
      expect(useGameStore.getState().currentGameData).toBeNull();
    });
  });

  // setTeams ──────────────────────────────────────────────────────────────────

  describe('setTeams', () => {
    it('sets teams array directly', () => {
      const teams = [makeTeam('t1'), makeTeam('t2')];
      useGameStore.getState().setTeams(teams);
      expect(useGameStore.getState().allTeams).toEqual(teams);
    });

    it('accepts an updater function', () => {
      const initial = [makeTeam('t1')];
      useGameStore.getState().setTeams(initial);
      useGameStore.getState().setTeams((prev) => [...prev, makeTeam('t2')]);
      expect(useGameStore.getState().allTeams).toHaveLength(2);
    });

    it('replaces all teams when given a new array', () => {
      useGameStore.getState().setTeams([makeTeam('t1'), makeTeam('t2')]);
      useGameStore.getState().setTeams([makeTeam('t3')]);
      expect(useGameStore.getState().allTeams).toHaveLength(1);
      expect(useGameStore.getState().allTeams[0].id).toBe('t3');
    });
  });

  // setCurrentQuestion ────────────────────────────────────────────────────────

  describe('setCurrentQuestion', () => {
    it('stores the question', () => {
      const q = { id: 'q-1', value: 100, text: 'Q', isUsed: false };
      useGameStore.getState().setCurrentQuestion(q);
      expect(useGameStore.getState().currentQuestion).toEqual(q);
    });

    it('clears the question when passed null', () => {
      useGameStore.getState().setCurrentQuestion({ id: 'q-1', value: 100, text: 'Q', isUsed: false });
      useGameStore.getState().setCurrentQuestion(null);
      expect(useGameStore.getState().currentQuestion).toBeNull();
    });
  });

  // buzz queue ────────────────────────────────────────────────────────────────

  describe('buzz queue', () => {
    it('addBuzz inserts entries sorted by timestamp', () => {
      useGameStore.getState().addBuzz('t2', 200);
      useGameStore.getState().addBuzz('t1', 100);
      const queue = useGameStore.getState().buzzQueue;
      expect(queue[0].teamId).toBe('t1');
      expect(queue[1].teamId).toBe('t2');
    });

    it('removeBuzz removes only the specified team', () => {
      useGameStore.getState().addBuzz('t1', 100);
      useGameStore.getState().addBuzz('t2', 200);
      useGameStore.getState().removeBuzz('t1');
      const queue = useGameStore.getState().buzzQueue;
      expect(queue).toHaveLength(1);
      expect(queue[0].teamId).toBe('t2');
    });

    it('clearBuzzQueue empties the queue', () => {
      useGameStore.getState().addBuzz('t1', 100);
      useGameStore.getState().addBuzz('t2', 200);
      useGameStore.getState().clearBuzzQueue();
      expect(useGameStore.getState().buzzQueue).toHaveLength(0);
    });
  });

  // markQuestionUsed ──────────────────────────────────────────────────────────

  describe('markQuestionUsed', () => {
    it('adds question id to selectedQuestions', () => {
      useGameStore.getState().markQuestionUsed('q-1');
      expect(useGameStore.getState().selectedQuestions).toContain('q-1');
    });

    it('sets isUsed flag on the matching question in currentGameData', () => {
      useGameStore.getState().setGame(makeGameData());
      useGameStore.getState().markQuestionUsed('q-1');
      const q = useGameStore.getState().currentGameData!.categories[0].questions[0];
      expect(q.isUsed).toBe(true);
    });

    it('does not affect other questions', () => {
      useGameStore.getState().setGame(makeGameData());
      useGameStore.getState().markQuestionUsed('q-1');
      const q = useGameStore.getState().currentGameData!.categories[0].questions[1];
      expect(q.isUsed).toBe(false);
    });

    it('handles missing currentGameData without crashing', () => {
      expect(() => useGameStore.getState().markQuestionUsed('q-1')).not.toThrow();
    });
  });

  // updateTeamScore ───────────────────────────────────────────────────────────

  describe('updateTeamScore', () => {
    it('adds points to scoreUpdates', () => {
      useGameStore.getState().updateTeamScore('t1', 200);
      expect(useGameStore.getState().scoreUpdates['t1']).toBe(200);
    });

    it('accumulates multiple score changes for the same team', () => {
      useGameStore.getState().updateTeamScore('t1', 200);
      useGameStore.getState().updateTeamScore('t1', 300);
      expect(useGameStore.getState().scoreUpdates['t1']).toBe(500);
    });

    it('supports negative score changes', () => {
      useGameStore.getState().updateTeamScore('t1', 200);
      useGameStore.getState().updateTeamScore('t1', -100);
      expect(useGameStore.getState().scoreUpdates['t1']).toBe(100);
    });

    it('tracks separate scores for different teams', () => {
      useGameStore.getState().updateTeamScore('t1', 200);
      useGameStore.getState().updateTeamScore('t2', 400);
      expect(useGameStore.getState().scoreUpdates['t1']).toBe(200);
      expect(useGameStore.getState().scoreUpdates['t2']).toBe(400);
    });
  });

  // Daily Double wager ────────────────────────────────────────────────────────

  describe('Daily Double wager', () => {
    it('setCurrentWager stores a wager', () => {
      useGameStore.getState().setCurrentWager(500);
      expect(useGameStore.getState().currentWager).toBe(500);
    });

    it('setWagerSubmitted updates the flag', () => {
      useGameStore.getState().setWagerSubmitted(true);
      expect(useGameStore.getState().isWagerSubmitted).toBe(true);
    });

    it('setControllingTeam stores the team id', () => {
      useGameStore.getState().setControllingTeam('t1');
      expect(useGameStore.getState().controllingTeamId).toBe('t1');
    });

    it('clearWager resets wager state', () => {
      useGameStore.getState().setCurrentWager(500);
      useGameStore.getState().setWagerSubmitted(true);
      useGameStore.getState().setControllingTeam('t1');
      useGameStore.getState().clearWager();
      const state = useGameStore.getState();
      expect(state.currentWager).toBeNull();
      expect(state.isWagerSubmitted).toBe(false);
      expect(state.controllingTeamId).toBeNull();
    });
  });

  // setCurrentPhase ───────────────────────────────────────────────────────────

  describe('setCurrentPhase', () => {
    it('transitions to final_jeopardy_wager', () => {
      useGameStore.getState().setCurrentPhase('final_jeopardy_wager');
      expect(useGameStore.getState().currentPhase).toBe('final_jeopardy_wager');
    });

    it('transitions to final_jeopardy_answer', () => {
      useGameStore.getState().setCurrentPhase('final_jeopardy_answer');
      expect(useGameStore.getState().currentPhase).toBe('final_jeopardy_answer');
    });

    it('transitions to final_jeopardy_reveal', () => {
      useGameStore.getState().setCurrentPhase('final_jeopardy_reveal');
      expect(useGameStore.getState().currentPhase).toBe('final_jeopardy_reveal');
    });

    it('returns to regular', () => {
      useGameStore.getState().setCurrentPhase('final_jeopardy_reveal');
      useGameStore.getState().setCurrentPhase('regular');
      expect(useGameStore.getState().currentPhase).toBe('regular');
    });
  });

  // setFinalJeopardyQuestion ──────────────────────────────────────────────────

  describe('setFinalJeopardyQuestion', () => {
    it('stores a FJ question', () => {
      const q = makeFJQuestion();
      useGameStore.getState().setFinalJeopardyQuestion(q);
      expect(useGameStore.getState().finalJeopardyQuestion).toEqual(q);
    });

    it('clears question when passed null', () => {
      useGameStore.getState().setFinalJeopardyQuestion(makeFJQuestion());
      useGameStore.getState().setFinalJeopardyQuestion(null);
      expect(useGameStore.getState().finalJeopardyQuestion).toBeNull();
    });
  });

  // updateFinalJeopardyTeamStatus ─────────────────────────────────────────────

  describe('updateFinalJeopardyTeamStatus', () => {
    const baseStatus: FinalJeopardyTeamStatus = {
      teamId: 't1',
      teamName: 'Team 1',
      currentScore: 1000,
      wager: null,
      answer: null,
      submittedAt: null,
      isCorrect: null,
      revealed: false,
    };

    it('creates a new team status entry', () => {
      useGameStore.getState().updateFinalJeopardyTeamStatus('t1', baseStatus);
      expect(useGameStore.getState().finalJeopardyTeamStatuses['t1']).toEqual(baseStatus);
    });

    it('merges partial updates into existing status', () => {
      useGameStore.getState().updateFinalJeopardyTeamStatus('t1', baseStatus);
      useGameStore.getState().updateFinalJeopardyTeamStatus('t1', { wager: 500, answer: 'Washington' });
      const status = useGameStore.getState().finalJeopardyTeamStatuses['t1'];
      expect(status.wager).toBe(500);
      expect(status.answer).toBe('Washington');
      expect(status.teamName).toBe('Team 1'); // untouched
    });

    it('tracks separate statuses for different teams', () => {
      useGameStore.getState().updateFinalJeopardyTeamStatus('t1', { ...baseStatus, teamId: 't1' });
      useGameStore.getState().updateFinalJeopardyTeamStatus('t2', { ...baseStatus, teamId: 't2', teamName: 'Team 2' });
      expect(useGameStore.getState().finalJeopardyTeamStatuses['t1'].teamName).toBe('Team 1');
      expect(useGameStore.getState().finalJeopardyTeamStatuses['t2'].teamName).toBe('Team 2');
    });
  });

  // resetFinalJeopardy ────────────────────────────────────────────────────────

  describe('resetFinalJeopardy', () => {
    it('resets phase, question, and team statuses', () => {
      useGameStore.getState().setCurrentPhase('final_jeopardy_reveal');
      useGameStore.getState().setFinalJeopardyQuestion(makeFJQuestion());
      useGameStore.getState().updateFinalJeopardyTeamStatus('t1', {
        teamId: 't1', teamName: 'T', currentScore: 0, wager: 200,
        answer: null, submittedAt: null, isCorrect: null, revealed: false,
      });

      useGameStore.getState().resetFinalJeopardy();

      const state = useGameStore.getState();
      expect(state.currentPhase).toBe('regular');
      expect(state.finalJeopardyQuestion).toBeNull();
      expect(state.finalJeopardyTeamStatuses).toEqual({});
    });

    it('does not affect other state', () => {
      useGameStore.getState().setGame(makeGameData());
      useGameStore.getState().setTeams([makeTeam('t1')]);
      useGameStore.getState().resetFinalJeopardy();
      expect(useGameStore.getState().currentGameData).not.toBeNull();
      expect(useGameStore.getState().allTeams).toHaveLength(1);
    });
  });

  // reset ─────────────────────────────────────────────────────────────────────

  describe('reset', () => {
    it('clears all state back to initial values', () => {
      useGameStore.getState().setGame(makeGameData());
      useGameStore.getState().setTeams([makeTeam('t1')]);
      useGameStore.getState().setCurrentPhase('final_jeopardy_wager');
      useGameStore.getState().setFinalJeopardyQuestion(makeFJQuestion());
      useGameStore.getState().addBuzz('t1', 100);
      useGameStore.getState().updateTeamScore('t1', 500);

      useGameStore.getState().reset();

      const state = useGameStore.getState();
      expect(state.currentGameData).toBeNull();
      expect(state.allTeams).toEqual([]);
      expect(state.currentPhase).toBe('regular');
      expect(state.finalJeopardyQuestion).toBeNull();
      expect(state.buzzQueue).toEqual([]);
      expect(state.scoreUpdates).toEqual({});
      expect(state.selectedQuestions).toEqual([]);
    });
  });

  // revealedAnswer ─────────────────────────────────────────────────────────────

  describe('revealedAnswer', () => {
    it('starts as null', () => {
      expect(useGameStore.getState().revealedAnswer).toBeNull();
    });

    it('setRevealedAnswer sets the answer text', () => {
      useGameStore.getState().setRevealedAnswer('Paris');
      expect(useGameStore.getState().revealedAnswer).toBe('Paris');
    });

    it('setRevealedAnswer(null) clears the answer', () => {
      useGameStore.getState().setRevealedAnswer('Paris');
      useGameStore.getState().setRevealedAnswer(null);
      expect(useGameStore.getState().revealedAnswer).toBeNull();
    });

    it('reset() clears revealedAnswer', () => {
      useGameStore.getState().setRevealedAnswer('Paris');
      useGameStore.getState().reset();
      expect(useGameStore.getState().revealedAnswer).toBeNull();
    });
  });
});
