import { create } from 'zustand';
import type {
  PubTriviaPhase,
  PubTriviaPlayer,
  PubTriviaQuestionForPlayer,
  PubTriviaRoundResult,
} from '../../types/pub-trivia';

interface PubTriviaState {
  gameId: string | null;
  phase: PubTriviaPhase;
  players: PubTriviaPlayer[];
  totalQuestions: number;
  currentQuestionIndex: number;
  currentQuestion: PubTriviaQuestionForPlayer | null;
  /** Indices into currentQuestion.options that have been eliminated this round. */
  eliminatedOptionIndices: number[];
  /** ms-since-epoch when the current question round started. */
  questionStartedAt: number | null;
  questionDurationMs: number;
  lastRoundResults: PubTriviaRoundResult[] | null;
  lastRoundCorrectAnswer: string | null;
  /** True once the local player has submitted an answer for the current question. */
  hasAnsweredCurrentQuestion: boolean;
}

interface PubTriviaActions {
  initGame: (params: {
    gameId: string;
    totalQuestions: number;
    players: PubTriviaPlayer[];
    questionDurationMs: number;
  }) => void;
  setPhase: (phase: PubTriviaPhase) => void;
  setPlayers: (players: PubTriviaPlayer[]) => void;
  updatePlayerScore: (playerId: string, newScore: number) => void;
  addPlayer: (player: PubTriviaPlayer) => void;
  startQuestion: (params: {
    questionIndex: number;
    question: PubTriviaQuestionForPlayer;
    startedAt: number;
  }) => void;
  eliminateOption: (optionIndex: number) => void;
  setHasAnswered: () => void;
  endRound: (correctAnswer: string, results: PubTriviaRoundResult[]) => void;
  endGame: (finalRankings: PubTriviaPlayer[]) => void;
  reset: () => void;
}

const initialState: PubTriviaState = {
  gameId: null,
  phase: 'setup',
  players: [],
  totalQuestions: 0,
  currentQuestionIndex: 0,
  currentQuestion: null,
  eliminatedOptionIndices: [],
  questionStartedAt: null,
  questionDurationMs: 20_000,
  lastRoundResults: null,
  lastRoundCorrectAnswer: null,
  hasAnsweredCurrentQuestion: false,
};

export const usePubTriviaStore = create<PubTriviaState & PubTriviaActions>((set) => ({
  ...initialState,

  initGame: ({ gameId, totalQuestions, players, questionDurationMs }) =>
    set({ gameId, totalQuestions, players, questionDurationMs, phase: 'setup' }),

  setPhase: (phase) => set({ phase }),

  setPlayers: (players) => set({ players }),

  updatePlayerScore: (playerId, newScore) =>
    set((state) => ({
      players: state.players.map((p) =>
        p.id === playerId ? { ...p, score: newScore } : p
      ),
    })),

  addPlayer: (player) =>
    set((state) => ({
      players: [...state.players, player],
    })),

  startQuestion: ({ questionIndex, question, startedAt }) =>
    set({
      phase: 'question',
      currentQuestionIndex: questionIndex,
      currentQuestion: question,
      eliminatedOptionIndices: [],
      questionStartedAt: startedAt,
      lastRoundResults: null,
      lastRoundCorrectAnswer: null,
      hasAnsweredCurrentQuestion: false,
    }),

  eliminateOption: (optionIndex) =>
    set((state) => ({
      eliminatedOptionIndices: [...state.eliminatedOptionIndices, optionIndex],
    })),

  setHasAnswered: () => set({ hasAnsweredCurrentQuestion: true }),

  endRound: (correctAnswer, results) =>
    set({
      phase: 'results',
      currentQuestion: null,
      questionStartedAt: null,
      lastRoundCorrectAnswer: correctAnswer,
      lastRoundResults: results,
    }),

  endGame: (finalRankings) =>
    set({ phase: 'completed', players: finalRankings }),

  reset: () => set(initialState),
}));
