/**
 * Pub Trivia game mode types.
 *
 * Players are individuals (backed by the teams table with team_number = player slot).
 * Questions are presented in random order with 4 multiple-choice options.
 * Scoring is time-based with declining point brackets and progressive wrong-answer elimination.
 */

// ─── Question & Answer Types ────────────────────────────────────────────────

/** A question as presented during a pub trivia round, with shuffled options. */
export interface PubTriviaQuestion {
  id: string;
  questionText: string;
  category: string;
  /** All 4 options, shuffled. Index of correctAnswer is randomised at game-start. */
  options: string[];
  /** The correct answer string (used server-side; not sent to players until round ends). */
  correctAnswer: string;
}

/** Question as sent to players — correct answer omitted. */
export type PubTriviaQuestionForPlayer = Omit<PubTriviaQuestion, 'correctAnswer'>;

// ─── Scoring ─────────────────────────────────────────────────────────────────

/** Point value awarded based on elapsed percentage of the question timer. */
export const PUB_TRIVIA_POINT_BRACKETS = [
  { maxPct: 0.25, points: 1000 },
  { maxPct: 0.50, points: 800 },
  { maxPct: 0.75, points: 600 },
  { maxPct: 1.00, points: 400 },
] as const;

/** At these elapsed-percentage thresholds, one wrong option is eliminated. */
export const OPTION_ELIMINATION_THRESHOLDS = [0.4, 0.7] as const;

/**
 * Returns the points earned for a correct answer given elapsed fraction (0–1).
 * Returns 0 for wrong answers (caller must pass isCorrect check first).
 */
export function calcPointsEarned(elapsedFraction: number): number {
  for (const bracket of PUB_TRIVIA_POINT_BRACKETS) {
    if (elapsedFraction <= bracket.maxPct) return bracket.points;
  }
  return 400;
}

// ─── Game State ──────────────────────────────────────────────────────────────

export type PubTriviaPhase =
  | 'setup'          // players joining
  | 'question'       // question + options visible, timer running
  | 'results'        // round ended, correct answer + leaderboard shown
  | 'completed';     // all questions done, final leaderboard

export interface PubTriviaPlayer {
  id: string;
  playerName: string;
  playerIcon: string | null;
  score: number;
  connectionStatus: string | null;
}

export interface PubTriviaRoundResult {
  playerId: string;
  playerName: string;
  playerIcon: string | null;
  answerText: string;
  isCorrect: boolean;
  pointsEarned: number;
}

export interface PubTriviaGameState {
  gameId: string;
  phase: PubTriviaPhase;
  players: PubTriviaPlayer[];
  /** Total number of questions in this game. */
  totalQuestions: number;
  /** 0-based index of the question currently being shown. */
  currentQuestionIndex: number;
  /** Active question (null during setup/results/completed). */
  currentQuestion: PubTriviaQuestionForPlayer | null;
  /** Indices of options that have been eliminated so far this round. */
  eliminatedOptionIndices: number[];
  /** When the current question round started (ms since epoch). Null outside 'question' phase. */
  questionStartedAt: number | null;
  /** Timer duration in ms for each question. */
  questionDurationMs: number;
  /** Results from the last completed round (null during question phase). */
  lastRoundResults: PubTriviaRoundResult[] | null;
  /** Correct answer from the last round (revealed after round ends). */
  lastRoundCorrectAnswer: string | null;
  /** Whether the current player has submitted an answer this round. */
  hasAnsweredCurrentQuestion: boolean;
}

// ─── Broadcast Events ────────────────────────────────────────────────────────

export type PubTriviaBroadcastEvent =
  | PtQuestionStartedEvent
  | PtOptionEliminatedEvent
  | PtAllAnsweredEvent
  | PtAnswerTallyEvent
  | PtQuestionEndedEvent
  | PtGameEndedEvent;

export interface PtQuestionStartedEvent {
  type: 'pt_question_started';
  payload: {
    questionIndex: number;
    question: PubTriviaQuestionForPlayer;
    durationMs: number;
    startedAt: number;
  };
}

export interface PtOptionEliminatedEvent {
  type: 'pt_option_eliminated';
  payload: {
    eliminatedIndex: number;
  };
}

export interface PtAllAnsweredEvent {
  type: 'pt_all_answered';
  payload: {
    playerCount: number;
  };
}

/** Live answer distribution broadcast after each submission. Teacher-only display. */
export interface PtAnswerTallyEvent {
  type: 'pt_answer_tally';
  payload: {
    /** Map of answerText → number of players who chose it. */
    tally: Record<string, number>;
    totalAnswered: number;
  };
}

export interface PtQuestionEndedEvent {
  type: 'pt_question_ended';
  payload: {
    correctAnswer: string;
    results: PubTriviaRoundResult[];
  };
}

export interface PtGameEndedEvent {
  type: 'pt_game_ended';
  payload: {
    finalRankings: PubTriviaPlayer[];
  };
}

// ─── API Payloads ─────────────────────────────────────────────────────────────

export interface StartPubTriviaRequest {
  questionDurationMs?: number;
}

export interface StartPubTriviaResponse {
  totalQuestions: number;
  players: PubTriviaPlayer[];
}

export interface SubmitAnswerRequest {
  playerId: string;
  answerText: string;
  deviceId: string;
}

export interface SubmitAnswerResponse {
  isCorrect: boolean;
  pointsEarned: number;
  totalScore: number;
}

export interface QuestionEndResponse {
  correctAnswer: string;
  results: PubTriviaRoundResult[];
  hasNextQuestion: boolean;
}
