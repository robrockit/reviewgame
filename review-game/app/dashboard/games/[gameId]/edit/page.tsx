'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeftIcon, ArrowPathIcon, EyeIcon } from '@heroicons/react/24/outline';
import { logger } from '@/lib/logger';
import { canAccessCustomTeamNames, getMaxTeams } from '@/lib/utils/feature-access';
import { GAME_BOARD } from '@/lib/constants/game';
import type { Tables } from '@/types/database.types';

type Profile = Tables<'profiles'>;

interface QuestionBank {
  id: string;
  title: string;
  subject: string;
}

interface FinalJeopardy {
  category: string;
  question: string;
  answer: string;
}

interface GameData {
  id: string;
  bank_id: string;
  bank_title: string;
  bank_subject: string;
  num_teams: number;
  team_names: string[] | null;
  timer_enabled: boolean;
  timer_seconds: number | null;
  started_at: string | null;
  status: string | null;
  daily_double_positions: number[] | null;
  final_jeopardy_question: FinalJeopardy | null;
}

export default function EditGamePage() {
  const router = useRouter();
  const params = useParams();
  const gameId = params?.gameId as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [game, setGame] = useState<GameData | null>(null);
  const [userProfile, setProfile] = useState<Profile | null>(null);
  const [questionBanks, setQuestionBanks] = useState<QuestionBank[]>([]);

  // Form state
  const [selectedBankId, setSelectedBankId] = useState('');
  const [numTeams, setNumTeams] = useState(2);
  const [teamNames, setTeamNames] = useState<string[]>([]);
  const [timerEnabled, setTimerEnabled] = useState(true);
  const [timerSeconds, setTimerSeconds] = useState(30);
  const [dailyDoubles, setDailyDoubles] = useState<number[]>([]);
  const [finalJeopardy, setFinalJeopardy] = useState<FinalJeopardy>({
    category: '',
    question: '',
    answer: '',
  });

  // Fetch game data, user profile, and question banks
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch game data
        const gameResponse = await fetch(`/api/games/${gameId}`);
        if (!gameResponse.ok) {
          throw new Error('Failed to fetch game');
        }

        const foundGame = await gameResponse.json();

        setGame(foundGame);
        setSelectedBankId(foundGame.bank_id);
        setNumTeams(foundGame.num_teams);
        setTeamNames(foundGame.team_names || Array.from({ length: foundGame.num_teams }, (_, i) => `Team ${i + 1}`));
        setTimerEnabled(foundGame.timer_enabled ?? true);
        setTimerSeconds(foundGame.timer_seconds || 30);
        setDailyDoubles(foundGame.daily_double_positions || []);
        setFinalJeopardy(foundGame.final_jeopardy_question || { category: '', question: '', answer: '' });

        // Fetch user profile for subscription tier
        const profileResponse = await fetch('/api/user/context');
        if (profileResponse.ok) {
          const contextData = await profileResponse.json();
          setProfile(contextData.profile);
        }

        // Fetch question banks
        const banksResponse = await fetch('/api/question-banks');
        if (banksResponse.ok) {
          const banksData = await banksResponse.json();
          setQuestionBanks(banksData.data || banksData);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load game';
        setError(errorMessage);
        logger.error('Failed to fetch game for editing', err, {
          operation: 'fetchGameForEdit',
          gameId,
        });
      } finally {
        setLoading(false);
      }
    };

    if (gameId) {
      fetchData();
    }
  }, [gameId]);

  // Update team names array when num_teams changes
  useEffect(() => {
    if (numTeams > teamNames.length) {
      // Add new teams
      const newTeams = [...teamNames];
      for (let i = teamNames.length; i < numTeams; i++) {
        newTeams.push(`Team ${i + 1}`);
      }
      setTeamNames(newTeams);
    } else if (numTeams < teamNames.length) {
      // Remove excess teams
      setTeamNames(teamNames.slice(0, numTeams));
    }
  }, [numTeams]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleTeamNameChange = (index: number, value: string) => {
    const newTeamNames = [...teamNames];
    newTeamNames[index] = value;
    setTeamNames(newTeamNames);
  };

  const handleRegenerateDailyDoubles = () => {
    // Generate 2 random positions for daily doubles
    const newPositions: number[] = [];

    while (newPositions.length < GAME_BOARD.DAILY_DOUBLE_COUNT) {
      const randomPos = Math.floor(Math.random() * GAME_BOARD.TOTAL_QUESTIONS);
      if (!newPositions.includes(randomPos)) {
        newPositions.push(randomPos);
      }
    }

    setDailyDoubles(newPositions.sort((a, b) => a - b));
  };

  const handlePreview = () => {
    window.open(`/game/teacher/${gameId}`, '_blank');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    // Validation
    if (!selectedBankId) {
      setError('Please select a question bank');
      setSaving(false);
      return;
    }

    // Validate num_teams against subscription limits
    const maxTeams = getMaxTeams(userProfile);
    if (numTeams < 2 || numTeams > maxTeams) {
      setError(`Number of teams must be between 2 and ${maxTeams}. ${maxTeams < 15 ? 'Upgrade your subscription to increase this limit.' : ''}`);
      setSaving(false);
      return;
    }

    // Validate custom team names (premium only)
    const hasCustomNames = teamNames.some((name, i) => name !== `Team ${i + 1}`);
    if (hasCustomNames && !canAccessCustomTeamNames(userProfile)) {
      setError('Custom team names require BASIC or PREMIUM subscription');
      setSaving(false);
      return;
    }

    try {
      const response = await fetch(`/api/games/${gameId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bank_id: selectedBankId,
          num_teams: numTeams,
          team_names: teamNames,
          timer_enabled: timerEnabled,
          timer_seconds: timerEnabled ? timerSeconds : null,
          daily_double_positions: dailyDoubles,
          final_jeopardy_question: finalJeopardy.category ? finalJeopardy : null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update game');
      }

      logger.info('Game updated successfully', {
        operation: 'updateGame',
        gameId,
      });

      // Redirect back to games list
      router.push('/dashboard/games');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save changes';
      setError(errorMessage);
      logger.error('Failed to update game', err, {
        operation: 'updateGame',
        gameId,
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-sm text-gray-600">Loading game...</p>
        </div>
      </div>
    );
  }

  if (error && !game) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600">{error}</p>
          <Link
            href="/dashboard/games"
            className="mt-4 inline-flex items-center text-sm text-indigo-600 hover:text-indigo-500"
          >
            <ArrowLeftIcon className="h-4 w-4 mr-1" />
            Back to Games
          </Link>
        </div>
      </div>
    );
  }

  // Use centralized feature access utilities
  const canUseCustomNames = canAccessCustomTeamNames(userProfile);
  const maxAllowedTeams = getMaxTeams(userProfile);
  const gameStarted = !!game?.started_at;

  // Status badge
  const getStatusBadge = () => {
    switch (game?.status) {
      case 'setup':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">Setup</span>;
      case 'in_progress':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">In Progress</span>;
      case 'completed':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Completed</span>;
      default:
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">Unknown</span>;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/dashboard/games"
            className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-4"
          >
            <ArrowLeftIcon className="h-4 w-4 mr-1" />
            Back to Games
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Edit Game</h1>
              <p className="mt-2 text-sm text-gray-600">
                Customize game settings and configuration
              </p>
            </div>
            <button
              type="button"
              onClick={handlePreview}
              className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <EyeIcon className="h-5 w-5 mr-2" />
              Preview Game
            </button>
          </div>

          {gameStarted && (
            <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-sm text-yellow-800">
                <strong>Note:</strong> This game has already started. Question bank cannot be changed.
              </p>
            </div>
          )}

          {!canUseCustomNames && (
            <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-blue-800">
                <strong>Free Tier:</strong> Upgrade to premium for custom team names and more teams.
              </p>
            </div>
          )}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 1. Game Information */}
          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-5">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Game Information</h3>

              <div className="space-y-4">
                {/* Status Badge */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Status
                  </label>
                  {getStatusBadge()}
                </div>

                {/* Question Bank Selector */}
                <div>
                  <label htmlFor="question-bank" className="block text-sm font-medium text-gray-700 mb-1">
                    Question Bank
                  </label>
                  <select
                    id="question-bank"
                    value={selectedBankId}
                    onChange={(e) => setSelectedBankId(e.target.value)}
                    disabled={gameStarted}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                  >
                    {questionBanks.map((bank) => (
                      <option key={bank.id} value={bank.id}>
                        {bank.title} - {bank.subject}
                      </option>
                    ))}
                  </select>
                  {gameStarted && (
                    <p className="mt-1 text-xs text-gray-500">Cannot change question bank after game starts</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 2. Team Configuration */}
          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-5">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Team Configuration</h3>

              <div className="space-y-4">
                {/* Number of Teams */}
                <div>
                  <label htmlFor="num-teams" className="block text-sm font-medium text-gray-700 mb-1">
                    Number of Teams
                  </label>
                  <select
                    id="num-teams"
                    value={numTeams}
                    onChange={(e) => setNumTeams(parseInt(e.target.value, 10))}
                    className="block w-full max-w-xs rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  >
                    {Array.from({ length: maxAllowedTeams - 1 }, (_, i) => i + 2).map((num) => (
                      <option key={num} value={num}>
                        {num} teams
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-gray-500">
                    {maxAllowedTeams === 15 ? 'Premium: Up to 15 teams' : maxAllowedTeams === 10 ? 'Basic: Up to 10 teams' : 'Free tier: Up to 5 teams'}
                  </p>
                </div>

                {/* Team Names */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Team Names {!canUseCustomNames && <span className="text-xs text-gray-500">(Premium only for custom names)</span>}
                  </label>
                  <div className="space-y-3">
                    {teamNames.map((name, index) => (
                      <div key={index}>
                        <label htmlFor={`team-${index}`} className="block text-xs font-medium text-gray-600 mb-1">
                          Team {index + 1}
                        </label>
                        <input
                          type="text"
                          id={`team-${index}`}
                          value={name}
                          onChange={(e) => handleTeamNameChange(index, e.target.value)}
                          disabled={!canUseCustomNames}
                          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                          placeholder={`Team ${index + 1}`}
                          maxLength={50}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 3. Game Settings */}
          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-5">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Game Settings</h3>

              <div className="space-y-4">
                {/* Timer Settings */}
                <div>
                  <div className="flex items-center mb-3">
                    <input
                      type="checkbox"
                      id="timer-enabled"
                      checked={timerEnabled}
                      onChange={(e) => setTimerEnabled(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <label htmlFor="timer-enabled" className="ml-3 block text-sm font-medium text-gray-700">
                      Enable question timer
                    </label>
                  </div>

                  {timerEnabled && (
                    <div className="ml-7">
                      <label htmlFor="timer-duration" className="block text-sm font-medium text-gray-700 mb-1">
                        Timer Duration
                      </label>
                      <select
                        id="timer-duration"
                        value={timerSeconds}
                        onChange={(e) => setTimerSeconds(parseInt(e.target.value, 10))}
                        className="block w-full max-w-xs rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      >
                        <option value={5}>5 seconds</option>
                        <option value={10}>10 seconds</option>
                        <option value={15}>15 seconds</option>
                        <option value={30}>30 seconds</option>
                        <option value={60}>60 seconds</option>
                      </select>
                    </div>
                  )}
                </div>

                {/* Daily Doubles */}
                <div className="border-t border-gray-200 pt-4">
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Daily Double Positions
                    </label>
                    <button
                      type="button"
                      onClick={handleRegenerateDailyDoubles}
                      className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                      <ArrowPathIcon className="h-4 w-4 mr-1" />
                      Regenerate
                    </button>
                  </div>
                  {dailyDoubles.length > 0 ? (
                    <div className="flex gap-2">
                      {dailyDoubles.map((pos, index) => (
                        <span key={index} className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
                          Position {pos}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">No daily doubles set. Click regenerate to create them.</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 4. Final Jeopardy */}
          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-5">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Final Jeopardy (Optional)</h3>

              <div className="space-y-4">
                {/* Category */}
                <div>
                  <label htmlFor="fj-category" className="block text-sm font-medium text-gray-700 mb-1">
                    Category
                  </label>
                  <input
                    type="text"
                    id="fj-category"
                    value={finalJeopardy.category}
                    onChange={(e) => setFinalJeopardy({ ...finalJeopardy, category: e.target.value })}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    placeholder="e.g., World History"
                    maxLength={100}
                  />
                </div>

                {/* Question */}
                <div>
                  <label htmlFor="fj-question" className="block text-sm font-medium text-gray-700 mb-1">
                    Question
                  </label>
                  <textarea
                    id="fj-question"
                    value={finalJeopardy.question}
                    onChange={(e) => setFinalJeopardy({ ...finalJeopardy, question: e.target.value })}
                    rows={3}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    placeholder="Enter the Final Jeopardy question..."
                    maxLength={500}
                  />
                </div>

                {/* Answer */}
                <div>
                  <label htmlFor="fj-answer" className="block text-sm font-medium text-gray-700 mb-1">
                    Answer
                  </label>
                  <input
                    type="text"
                    id="fj-answer"
                    value={finalJeopardy.answer}
                    onChange={(e) => setFinalJeopardy({ ...finalJeopardy, answer: e.target.value })}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    placeholder="What is...?"
                    maxLength={200}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-800">
                <strong>Error:</strong> {error}
              </p>
            </div>
          )}

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-3 bg-white px-6 py-4 rounded-lg shadow">
            <Link
              href="/dashboard/games"
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
