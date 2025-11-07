'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Tables, TablesInsert } from '@/types/database.types';
import { logger } from '@/lib/logger';

type QuestionBank = Tables<'question_banks'>;
type Profile = Tables<'profiles'>;

// Generate 2 random Daily Double positions for a 7x5 board
const generateDailyDoublePositions = (): { category: number; position: number }[] => {
  const positions: { category: number; position: number }[] = [];
  const usedPositions = new Set<string>();

  while (positions.length < 2) {
    const category = Math.floor(Math.random() * 7); // 0-6 (7 categories)
    const position = Math.floor(Math.random() * 5); // 0-4 (5 questions per category)
    const key = `${category}-${position}`;

    if (!usedPositions.has(key)) {
      usedPositions.add(key);
      positions.push({ category, position });
    }
  }

  return positions;
};

export default function NewGamePage() {
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [questionBanks, setQuestionBanks] = useState<QuestionBank[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [selectedBankId, setSelectedBankId] = useState<string>('');
  const [numTeams, setNumTeams] = useState<number>(4);
  const [teamNames, setTeamNames] = useState<string[]>(['Team 1', 'Team 2', 'Team 3', 'Team 4']);
  const [timerEnabled, setTimerEnabled] = useState<boolean>(true);
  const [timerSeconds, setTimerSeconds] = useState<number>(10);

  const router = useRouter();
  const supabase = createClient();

  // Check if user has premium access
  const isPremium = profile?.subscription_status === 'active' || profile?.subscription_status === 'trial';

  useEffect(() => {
    const initializePage = async () => {
      try {
        // Get current user
        const { data: { user: currentUser }, error: userError } = await supabase.auth.getUser();

        if (userError || !currentUser) {
          router.push('/login');
          return;
        }

        setUser(currentUser);

        // Fetch user profile
        // Note: Profile should be automatically created by database trigger when user signs up
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', currentUser.id)
          .single();

        if (profileError) {
          logger.error('Error fetching profile', {
            error: profileError.message,
            userId: currentUser.id,
            code: profileError.code,
            operation: 'fetchProfile',
            page: 'NewGamePage'
          });

          // If profile doesn't exist, it means the database trigger hasn't run yet or failed
          if (profileError.code === 'PGRST116') {
            setError(
              'Your profile has not been created yet. Please sign out and sign back in, or contact support if the issue persists.'
            );
          } else {
            setError('Failed to load user profile. Please try again.');
          }

          setLoading(false);
          return;
        }

        setProfile(profileData);

        // Fetch question banks (public + user's custom if premium)
        const isPremiumUser = profileData?.subscription_status === 'active' || profileData?.subscription_status === 'trial';

        const query = supabase
          .from('question_banks')
          .select('*')
          .eq('is_public', true);

        // If premium, also include user's custom banks
        if (isPremiumUser) {
          const { data: customBanks, error: customError } = await supabase
            .from('question_banks')
            .select('*')
            .eq('owner_id', currentUser.id)
            .eq('is_custom', true);

          const { data: publicBanks, error: publicError } = await supabase
            .from('question_banks')
            .select('*')
            .eq('is_public', true);

          if (publicError) throw publicError;
          if (customError) throw customError;

          const allBanks = [...(publicBanks || []), ...(customBanks || [])];
          setQuestionBanks(allBanks);
        } else {
          const { data: banks, error: banksError } = await query;

          if (banksError) throw banksError;
          setQuestionBanks(banks || []);
        }

        setLoading(false);
      } catch (err) {
        logger.error('Initialization error', {
          error: err instanceof Error ? err.message : String(err),
          userId: user?.id,
          operation: 'initializePage',
          page: 'NewGamePage'
        });
        setError('Failed to load page. Please try again.');
        setLoading(false);
      }
    };

    initializePage();
  }, [router, supabase]);

  // Update team names array when number of teams changes
  useEffect(() => {
    const defaultNames = Array.from({ length: numTeams }, (_, i) => `Team ${i + 1}`);
    setTeamNames(defaultNames);
  }, [numTeams]);

  const handleTeamNameChange = (index: number, value: string) => {
    const newTeamNames = [...teamNames];
    newTeamNames[index] = value;
    setTeamNames(newTeamNames);
  };

  const handleCreateGame = async () => {
    if (!selectedBankId) {
      setError('Please select a question bank');
      return;
    }

    if (!user) {
      setError('You must be logged in to create a game');
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      // Generate Daily Double positions
      const dailyDoublePositions = generateDailyDoublePositions();

      // Prepare game data
      const gameData: TablesInsert<'games'> = {
        teacher_id: user.id,
        bank_id: selectedBankId,
        num_teams: numTeams,
        team_names: isPremium ? teamNames : null, // Only save custom names for premium users
        timer_enabled: timerEnabled,
        timer_seconds: timerEnabled ? timerSeconds : null,
        daily_double_positions: dailyDoublePositions,
        status: 'setup', // Game starts in setup phase
        selected_questions: [],
      };

      // Create game in database
      const { data: newGame, error: gameError } = await supabase
        .from('games')
        .insert(gameData)
        .select()
        .single();

      if (gameError) throw gameError;

      // Create initial team records
      const teamRecords = Array.from({ length: numTeams }, (_, i) => ({
        game_id: newGame.id,
        team_number: i + 1,
        team_name: isPremium && teamNames[i] ? teamNames[i] : `Team ${i + 1}`,
        score: 0,
        connection_status: 'pending',
      }));

      const { error: teamsError } = await supabase
        .from('teams')
        .insert(teamRecords);

      if (teamsError) throw teamsError;

      // Redirect to teacher control page
      router.push(`/game/teacher/${newGame.id}`);
    } catch (err) {
      logger.error('Error creating game', {
        error: err instanceof Error ? err.message : String(err),
        userId: user?.id,
        selectedBankId,
        numTeams,
        operation: 'createGame',
        page: 'NewGamePage'
      });
      setError(err instanceof Error ? err.message : 'Failed to create game. Please try again.');
      setIsCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Create New Game</h1>
          <p className="text-gray-600">Set up your Jeopardy-style review game</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {/* Game Setup Form */}
        <div className="bg-white rounded-lg shadow-sm p-6 space-y-6">
          {/* Question Bank Selection */}
          <div>
            <label htmlFor="questionBank" className="block text-sm font-medium text-gray-700 mb-2">
              Question Bank <span className="text-red-500">*</span>
            </label>
            <select
              id="questionBank"
              value={selectedBankId}
              onChange={(e) => setSelectedBankId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            >
              <option value="">Select a question bank...</option>
              {questionBanks.map((bank) => (
                <option key={bank.id} value={bank.id}>
                  {bank.title} - {bank.subject}
                  {bank.is_custom && ' (Custom)'}
                </option>
              ))}
            </select>
            <p className="mt-1 text-sm text-gray-500">
              {isPremium
                ? 'Select from public banks or your custom question banks'
                : 'Upgrade to premium to create custom question banks'}
            </p>
          </div>

          {/* Number of Teams */}
          <div>
            <label htmlFor="numTeams" className="block text-sm font-medium text-gray-700 mb-2">
              Number of Teams
            </label>
            <select
              id="numTeams"
              value={numTeams}
              onChange={(e) => setNumTeams(parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {Array.from({ length: 9 }, (_, i) => i + 2).map((num) => (
                <option key={num} value={num}>
                  {num} Teams
                </option>
              ))}
            </select>
          </div>

          {/* Custom Team Names (Premium Only) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Team Names
              </label>
              {!isPremium && (
                <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                  Premium Feature
                </span>
              )}
            </div>
            <div className="space-y-2">
              {teamNames.map((name, index) => (
                <input
                  key={index}
                  type="text"
                  value={name}
                  onChange={(e) => handleTeamNameChange(index, e.target.value)}
                  disabled={!isPremium}
                  placeholder={`Team ${index + 1}`}
                  className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    !isPremium ? 'bg-gray-100 cursor-not-allowed' : ''
                  }`}
                />
              ))}
            </div>
            <p className="mt-1 text-sm text-gray-500">
              {isPremium
                ? 'Customize team names for your game'
                : 'Upgrade to premium to use custom team names'}
            </p>
          </div>

          {/* Timer Configuration */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Timer Settings
            </label>
            <div className="space-y-3">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="timerEnabled"
                  checked={timerEnabled}
                  onChange={(e) => setTimerEnabled(e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="timerEnabled" className="ml-2 block text-sm text-gray-700">
                  Enable timer for questions
                </label>
              </div>
              {timerEnabled && (
                <div className="ml-6">
                  <label htmlFor="timerDuration" className="block text-sm text-gray-700 mb-1">
                    Timer Duration
                  </label>
                  <select
                    id="timerDuration"
                    value={timerSeconds}
                    onChange={(e) => setTimerSeconds(parseInt(e.target.value))}
                    className="w-48 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value={5}>5 seconds</option>
                    <option value={10}>10 seconds</option>
                    <option value={15}>15 seconds</option>
                    <option value={30}>30 seconds</option>
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Summary */}
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Game Summary</h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• {numTeams} teams will join</li>
              <li>• Timer: {timerEnabled ? `${timerSeconds} seconds` : 'Disabled'}</li>
              <li>• 2 Daily Doubles will be randomly placed</li>
              <li>• Teams will need approval to join</li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4">
            <button
              onClick={() => router.push('/dashboard')}
              className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
              disabled={isCreating}
            >
              Cancel
            </button>
            <button
              onClick={handleCreateGame}
              disabled={!selectedBankId || isCreating}
              className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCreating ? 'Creating Game...' : 'Create Game'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
