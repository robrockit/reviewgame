import { create } from 'zustand';

// Define types for state and actions
interface GameState {
  currentGameData: object | null;
  allTeams: object[];
  currentQuestion: object | null;
  buzzQueue: { teamId: string; timestamp: number }[];
  selectedQuestions: string[];
  scoreUpdates: Record<string, number>; // More specific type for scoreUpdates
}

interface GameActions {
  setGame: (data: object | null) => void;
  setTeams: (teams: object[]) => void;
  setCurrentQuestion: (question: object | null) => void;
  addBuzz: (teamId: string, timestamp: number) => void;
  clearBuzzQueue: () => void;
  markQuestionUsed: (questionId: string) => void;
  updateTeamScore: (teamId: string, scoreChange: number) => void;
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
};

export const useGameStore = create<GameStore>((set, get) => ({
  // State
  ...initialState,

  // Actions
  setGame: (data) => set({ currentGameData: data }),
  setTeams: (teams) => set({ allTeams: teams }),
  setCurrentQuestion: (question) => set({ currentQuestion: question }),
  addBuzz: (teamId, timestamp) =>
    set((state) => ({
      buzzQueue: [...state.buzzQueue, { teamId, timestamp }].sort(
        (a, b) => a.timestamp - b.timestamp
      ),
    })),
  clearBuzzQueue: () => set({ buzzQueue: [] }),
  markQuestionUsed: (questionId) =>
    set((state) => ({
      selectedQuestions: [...state.selectedQuestions, questionId],
    })),
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
  reset: () => set(initialState),
}));