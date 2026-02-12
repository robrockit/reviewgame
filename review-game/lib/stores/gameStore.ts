/**
 * @fileoverview Global game state management using Zustand.
 *
 * This store manages the complete state of an active game session including:
 * - Game data (board, categories, questions)
 * - Team information and scores
 * - Buzz queue for student responses
 * - Current question state
 * - Daily Double wager state
 *
 * The store is used across teacher controls, student views, and the game board display
 * to maintain consistent state throughout the application.
 *
 * @module lib/stores/gameStore
 */

import { create } from 'zustand';
import { GameData, Team, Question, BuzzEntry, GamePhase, FinalJeopardyQuestion, FinalJeopardyTeamStatus } from '../../types/game';

/**
 * Represents the state portion of the game store.
 *
 * @interface GameState
 * @property {GameData | null} currentGameData - The current game's board data including categories and questions
 * @property {Team[]} allTeams - All teams participating in the current game
 * @property {Question | null} currentQuestion - The question currently being displayed/answered
 * @property {BuzzEntry[]} buzzQueue - Ordered queue of buzzes from students (sorted by timestamp)
 * @property {string[]} selectedQuestions - Array of question IDs that have been used
 * @property {Record<string, number>} scoreUpdates - Score changes for each team (teamId -> score delta)
 * @property {number | null} currentWager - The wager amount for Daily Double questions
 * @property {boolean} isWagerSubmitted - Whether the wager has been submitted
 * @property {string | null} controllingTeamId - The team that controls the Daily Double
 * @property {GamePhase} currentPhase - The current phase of the game
 * @property {FinalJeopardyQuestion | null} finalJeopardyQuestion - The Final Jeopardy question data
 * @property {Record<string, FinalJeopardyTeamStatus>} finalJeopardyTeamStatuses - Team statuses for Final Jeopardy
 */
interface GameState {
  currentGameData: GameData | null;
  allTeams: Team[];
  currentQuestion: Question | null;
  buzzQueue: BuzzEntry[];
  selectedQuestions: string[];
  scoreUpdates: Record<string, number>;
  currentWager: number | null;
  isWagerSubmitted: boolean;
  controllingTeamId: string | null;
  currentPhase: GamePhase;
  finalJeopardyQuestion: FinalJeopardyQuestion | null;
  finalJeopardyTeamStatuses: Record<string, FinalJeopardyTeamStatus>;
}

/**
 * Represents the actions available in the game store.
 *
 * @interface GameActions
 */
interface GameActions {
  /**
   * Sets the current game data.
   * @param {GameData | null} data - The game data to set, or null to clear
   */
  setGame: (data: GameData | null) => void;

  /**
   * Sets or updates the teams array.
   * @param {Team[] | ((prevTeams: Team[]) => Team[])} teams - Teams array or updater function
   */
  setTeams: (teams: Team[] | ((prevTeams: Team[]) => Team[])) => void;

  /**
   * Sets the current question being displayed.
   * @param {Question | null} question - The question to display, or null to clear
   */
  setCurrentQuestion: (question: Question | null) => void;

  /**
   * Adds a buzz to the queue in timestamp order.
   * @param {string} teamId - The ID of the team that buzzed
   * @param {number} timestamp - The timestamp when the buzz occurred
   */
  addBuzz: (teamId: string, timestamp: number) => void;

  /**
   * Removes a specific team's buzz from the queue.
   * @param {string} teamId - The ID of the team whose buzz to remove
   */
  removeBuzz: (teamId: string) => void;

  /**
   * Clears all buzzes from the queue.
   */
  clearBuzzQueue: () => void;

  /**
   * Marks a question as used/selected.
   * @param {string} questionId - The ID of the question to mark as used
   */
  markQuestionUsed: (questionId: string) => void;

  /**
   * Updates a team's score by adding or subtracting points.
   * @param {string} teamId - The ID of the team whose score to update
   * @param {number} scoreChange - The amount to change the score (positive or negative)
   */
  updateTeamScore: (teamId: string, scoreChange: number) => void;

  /**
   * Sets the wager amount for a Daily Double.
   * @param {number | null} wager - The wager amount, or null to clear
   */
  setCurrentWager: (wager: number | null) => void;

  /**
   * Sets whether the wager has been submitted.
   * @param {boolean} submitted - True if wager is submitted, false otherwise
   */
  setWagerSubmitted: (submitted: boolean) => void;

  /**
   * Sets the team that controls the Daily Double.
   * @param {string | null} teamId - The controlling team's ID, or null to clear
   */
  setControllingTeam: (teamId: string | null) => void;

  /**
   * Clears all Daily Double wager state.
   */
  clearWager: () => void;

  /**
   * Sets the current game phase.
   * @param {GamePhase} phase - The phase to set
   */
  setCurrentPhase: (phase: GamePhase) => void;

  /**
   * Sets the Final Jeopardy question.
   * @param {FinalJeopardyQuestion | null} question - The Final Jeopardy question, or null to clear
   */
  setFinalJeopardyQuestion: (question: FinalJeopardyQuestion | null) => void;

  /**
   * Updates a team's Final Jeopardy status.
   * @param {string} teamId - The team ID to update
   * @param {Partial<FinalJeopardyTeamStatus>} status - Partial status to merge
   */
  updateFinalJeopardyTeamStatus: (teamId: string, status: Partial<FinalJeopardyTeamStatus>) => void;

  /**
   * Resets all Final Jeopardy state.
   */
  resetFinalJeopardy: () => void;

  /**
   * Resets the entire store to initial state.
   */
  reset: () => void;
}

/**
 * Combined type representing the complete game store (state + actions).
 *
 * @typedef {GameState & GameActions} GameStore
 */
type GameStore = GameState & GameActions;

/**
 * Initial state for the game store.
 * @constant {GameState}
 */
const initialState: GameState = {
  currentGameData: null,
  allTeams: [],
  currentQuestion: null,
  buzzQueue: [],
  selectedQuestions: [],
  scoreUpdates: {},
  currentWager: null,
  isWagerSubmitted: false,
  controllingTeamId: null,
  currentPhase: 'regular',
  finalJeopardyQuestion: null,
  finalJeopardyTeamStatuses: {},
};

/**
 * Zustand store hook for managing global game state.
 *
 * This store provides centralized state management for all game-related data and operations.
 * It can be accessed from any component using the `useGameStore` hook.
 *
 * @example
 * ```tsx
 * // Access state
 * const currentQuestion = useGameStore((state) => state.currentQuestion);
 * const teams = useGameStore((state) => state.allTeams);
 *
 * // Use actions
 * const { setCurrentQuestion, updateTeamScore } = useGameStore();
 * setCurrentQuestion(question);
 * updateTeamScore('team-123', 200);
 *
 * // Access actions directly via getState()
 * useGameStore.getState().addBuzz('team-456', Date.now());
 * ```
 *
 * @returns {GameStore} The game store with state and actions
 */
export const useGameStore = create<GameStore>((set) => ({
  // State
  ...initialState,

  // Actions
  setGame: (data) => set({ currentGameData: data }),
  setTeams: (teams) =>
    set((state) => ({
      allTeams: typeof teams === 'function' ? teams(state.allTeams) : teams,
    })),
  setCurrentQuestion: (question) => set({ currentQuestion: question }),
  addBuzz: (teamId, timestamp) =>
    set((state) => ({
      buzzQueue: [...state.buzzQueue, { teamId, timestamp }].sort(
        (a, b) => a.timestamp - b.timestamp
      ),
    })),
  removeBuzz: (teamId) =>
    set((state) => ({
      buzzQueue: state.buzzQueue.filter((buzz) => buzz.teamId !== teamId),
    })),
  clearBuzzQueue: () => set({ buzzQueue: [] }),
  markQuestionUsed: (questionId) =>
    set((state) => {
      // Update selectedQuestions array
      const updatedSelectedQuestions = [...state.selectedQuestions, questionId];

      // Update the isUsed flag on the actual question object in categories
      const updatedGameData = state.currentGameData ? {
        ...state.currentGameData,
        categories: state.currentGameData.categories.map((category) => ({
          ...category,
          questions: category.questions.map((question) =>
            question.id === questionId
              ? { ...question, isUsed: true }
              : question
          ),
        })),
      } : null;

      return {
        selectedQuestions: updatedSelectedQuestions,
        currentGameData: updatedGameData,
      };
    }),
  updateTeamScore: (teamId, scoreChange) =>
    set((state) => {
      const currentScore = state.scoreUpdates[teamId] || 0;
      return {
        scoreUpdates: {
          ...state.scoreUpdates,
          [teamId]: currentScore + scoreChange,
        },
      };
    }),
  // Daily Double wager actions
  setCurrentWager: (wager) => set({ currentWager: wager }),
  setWagerSubmitted: (submitted) => set({ isWagerSubmitted: submitted }),
  setControllingTeam: (teamId) => set({ controllingTeamId: teamId }),
  clearWager: () => set({ currentWager: null, isWagerSubmitted: false, controllingTeamId: null }),

  // Final Jeopardy actions
  setCurrentPhase: (phase) => set({ currentPhase: phase }),
  setFinalJeopardyQuestion: (question) => set({ finalJeopardyQuestion: question }),
  updateFinalJeopardyTeamStatus: (teamId, status) =>
    set((state) => ({
      finalJeopardyTeamStatuses: {
        ...state.finalJeopardyTeamStatuses,
        [teamId]: {
          ...state.finalJeopardyTeamStatuses[teamId],
          ...status,
        },
      },
    })),
  resetFinalJeopardy: () =>
    set({
      currentPhase: 'regular',
      finalJeopardyQuestion: null,
      finalJeopardyTeamStatuses: {},
    }),

  reset: () => set(initialState),
}));