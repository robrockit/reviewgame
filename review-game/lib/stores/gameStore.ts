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