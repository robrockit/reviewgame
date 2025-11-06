import { create } from 'zustand';
import { GameData, Team, Question, BuzzEntry } from '../../types/game';

// Define types for state and actions
interface GameState {
  currentGameData: GameData | null;
  allTeams: Team[];
  currentQuestion: Question | null;
  buzzQueue: BuzzEntry[];
  selectedQuestions: string[];
  scoreUpdates: Record<string, number>; // More specific type for scoreUpdates
  // Daily Double wager state
  currentWager: number | null;
  isWagerSubmitted: boolean;
}

interface GameActions {
  setGame: (data: GameData | null) => void;
  setTeams: (teams: Team[] | ((prevTeams: Team[]) => Team[])) => void;
  setCurrentQuestion: (question: Question | null) => void;
  addBuzz: (teamId: string, timestamp: number) => void;
  removeBuzz: (teamId: string) => void;
  clearBuzzQueue: () => void;
  markQuestionUsed: (questionId: string) => void;
  updateTeamScore: (teamId: string, scoreChange: number) => void;
  // Daily Double wager actions
  setCurrentWager: (wager: number | null) => void;
  setWagerSubmitted: (submitted: boolean) => void;
  clearWager: () => void;
  reset: () => void;
}

// Combine state and actions into a single type for the store
type GameStore = GameState & GameActions;

// Initial state
const initialState: GameState = {
  currentGameData: null,
  allTeams: [],
  currentQuestion: null,
  buzzQueue: [],
  selectedQuestions: [],
  scoreUpdates: {}, // Initialize as an empty object
  currentWager: null,
  isWagerSubmitted: false,
};

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
  clearWager: () => set({ currentWager: null, isWagerSubmitted: false }),
  reset: () => set(initialState),
}));