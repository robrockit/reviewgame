"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useGameStore } from '../../lib/stores/gameStore';
import { createClient } from '@/lib/supabase/client';

interface DailyDoubleModalProps {
  gameId: string;
}

// Daily Double constants
const DAILY_DOUBLE_MAX_WAGER = 1000;
const DAILY_DOUBLE_MIN_WAGER = 5;

export const DailyDoubleModal: React.FC<DailyDoubleModalProps> = ({ gameId }) => {
  const {
    currentQuestion,
    setCurrentQuestion,
    allTeams,
    currentWager,
    setCurrentWager,
    isWagerSubmitted,
    setWagerSubmitted,
    controllingTeamId,
    setControllingTeam,
    clearWager,
    markQuestionUsed,
  } = useGameStore();

  const [isProcessing, setIsProcessing] = useState(false);
  const [wagerInput, setWagerInput] = useState('');
  const [wagerError, setWagerError] = useState<string | null>(null);
  const supabase = createClient();

  // Track if component is mounted to prevent state updates after unmount
  const isMountedRef = useRef(true);

  // Modal is open when currentQuestion is a Daily Double and not null
  const isOpen = currentQuestion !== null && currentQuestion.isDailyDouble === true;

  // Get the controlling team data
  const controllingTeam = controllingTeamId
    ? allTeams.find(team => team.id === controllingTeamId)
    : null;

  // Get category name from current question
  const categoryName = currentQuestion?.categoryName || 'Category';

  // Set mounted flag on mount and clean up on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Reset wager state when modal opens
  useEffect(() => {
    if (isOpen) {
      setWagerInput('');
      setWagerError(null);
      clearWager();
    }
  }, [isOpen, clearWager]);

  // Calculate max wager for the selected team
  const getMaxWager = useCallback(() => {
    if (!controllingTeamId) return DAILY_DOUBLE_MAX_WAGER;

    const team = allTeams.find(t => t.id === controllingTeamId);
    const teamScore = team?.score || 0;

    // Max wager is the higher of team's score or the fixed maximum
    return Math.max(teamScore, DAILY_DOUBLE_MAX_WAGER);
  }, [controllingTeamId, allTeams]);

  // Validate wager amount
  const validateWager = useCallback((amount: number): string | null => {
    const maxWager = getMaxWager();

    if (amount < DAILY_DOUBLE_MIN_WAGER) {
      return `Minimum wager is ${DAILY_DOUBLE_MIN_WAGER} points`;
    }

    if (amount > maxWager) {
      return `Maximum wager is ${maxWager} points`;
    }

    return null;
  }, [getMaxWager]);

  // Handle wager submission
  const handleWagerSubmit = useCallback(async () => {
    if (!controllingTeamId || !currentQuestion) {
      setWagerError('Please select a controlling team');
      return;
    }

    const wagerAmount = parseInt(wagerInput, 10);

    // Validate wager is a number
    if (isNaN(wagerAmount) || wagerAmount <= 0) {
      setWagerError('Please enter a valid wager amount');
      return;
    }

    const validationError = validateWager(wagerAmount);
    if (validationError) {
      setWagerError(validationError);
      return;
    }

    setIsProcessing(true);
    try {
      // Set wager and mark as submitted
      setCurrentWager(wagerAmount);
      setWagerSubmitted(true);
      setWagerError(null);

      console.log(`Wager submitted: ${wagerAmount} points for question ${currentQuestion.id} by team ${controllingTeamId}`);
    } catch (error) {
      console.error('Error submitting wager:', error);
      setWagerError('Failed to submit wager. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  }, [wagerInput, controllingTeamId, currentQuestion, validateWager, setCurrentWager, setWagerSubmitted]);

  // Close modal handler
  const handleClose = useCallback(async () => {
    if (isProcessing) return;

    setIsProcessing(true);

    // Mark question as used in database before closing to prevent reopening
    if (currentQuestion) {
      // Mark in local store immediately (optimistic update)
      markQuestionUsed(currentQuestion.id);

      try {
        const { data: gameData, error: fetchError } = await supabase
          .from('games')
          .select('selected_questions')
          .eq('id', gameId)
          .single();

        if (fetchError) {
          console.error('Failed to fetch game data for marking question:', fetchError);
          throw fetchError;
        }

        if (gameData) {
          const selectedQuestions = gameData.selected_questions || [];
          if (!selectedQuestions.includes(currentQuestion.id)) {
            const { error: updateError } = await supabase
              .from('games')
              .update({
                selected_questions: [...selectedQuestions, currentQuestion.id]
              })
              .eq('id', gameId);

            if (updateError) {
              console.error('Failed to mark question as used in DB:', updateError);
              throw updateError;
            }
          }
        }
      } catch (error) {
        console.error('Failed to mark question as used on close:', error);
        // Question is already marked in local store, so modal will close
        // Show warning to user but don't block the close operation
        alert('Warning: Failed to save question state to database. The question has been marked as used locally but may reappear if you refresh the page.');
      }
    }

    setCurrentQuestion(null);
    clearWager();
    setIsProcessing(false);
  }, [isProcessing, setCurrentQuestion, clearWager, markQuestionUsed, currentQuestion, gameId, supabase]);

  // Handle correct answer with wager
  const handleCorrect = async () => {
    if (isProcessing || !currentQuestion || !controllingTeamId || !controllingTeam || !currentWager) return;

    // IMPORTANT: Snapshot values before any async operations to prevent race conditions
    const teamIdToUpdate = controllingTeam.id;
    const scoreToAward = currentWager; // Use wager amount instead of question value
    const questionId = currentQuestion.id;

    setIsProcessing(true);
    try {
      // Award wager points to the controlling team
      // Use server-side RPC function for proper authorization and atomic updates
      // The RPC function handles fetching current score atomically
      const { data: scoreResult, error: scoreError } = await supabase
        .rpc('update_team_score', {
          p_team_id: teamIdToUpdate,
          p_score_change: scoreToAward,
          p_game_id: gameId
        });

      if (scoreError) {
        console.error('Error updating team score:', scoreError);
        throw scoreError;
      }

      // Check for authorization or validation errors from the RPC function
      if (scoreResult && scoreResult.length > 0 && !scoreResult[0].success) {
        console.error('Score update failed:', scoreResult[0].error_message);
        throw new Error(scoreResult[0].error_message || 'Failed to update score');
      }

      // Try to mark question as used in database (less critical)
      try {
        const { data: gameData, error: gameError } = await supabase
          .from('games')
          .select('selected_questions')
          .eq('id', gameId)
          .single();

        if (!gameError && gameData) {
          const selectedQuestions = gameData.selected_questions || [];
          if (!selectedQuestions.includes(questionId)) {
            const { error: updateError } = await supabase
              .from('games')
              .update({
                selected_questions: [...selectedQuestions, questionId]
              })
              .eq('id', gameId);

            if (updateError) {
              console.warn('Failed to mark question in DB (will sync later):', updateError);
            }
          }
        }
      } catch (markError) {
        console.warn('Failed to mark question as used in DB:', markError);
      }

      // Success - clear wager and close modal
      if (isMountedRef.current) {
        clearWager();
        setCurrentQuestion(null);
      }
    } catch (error) {
      console.error('Error handling correct answer:', error);
      if (isMountedRef.current) {
        alert('Failed to update score. Please try again.');
      }
    } finally {
      if (isMountedRef.current) {
        setIsProcessing(false);
      }
    }
  };

  // Handle incorrect answer with wager
  const handleIncorrect = async () => {
    if (isProcessing || !currentQuestion || !controllingTeamId || !controllingTeam || !currentWager) return;

    // IMPORTANT: Snapshot values before any async operations to prevent race conditions
    const teamIdToUpdate = controllingTeam.id;
    const scoreToDeduct = currentWager; // Use wager amount instead of question value
    const questionId = currentQuestion.id;

    setIsProcessing(true);
    try {
      // Deduct wager points from the controlling team
      // Use server-side RPC function for proper authorization and atomic updates
      // The RPC function handles fetching current score atomically
      const { data: scoreResult, error: scoreError } = await supabase
        .rpc('update_team_score', {
          p_team_id: teamIdToUpdate,
          p_score_change: -scoreToDeduct, // Negative for deduction
          p_game_id: gameId
        });

      if (scoreError) {
        console.error('Error updating team score:', scoreError);
        throw scoreError;
      }

      // Check for authorization or validation errors from the RPC function
      if (scoreResult && scoreResult.length > 0 && !scoreResult[0].success) {
        console.error('Score update failed:', scoreResult[0].error_message);
        throw new Error(scoreResult[0].error_message || 'Failed to update score');
      }

      // Mark question as used in database
      try {
        const { data: gameData, error: gameError } = await supabase
          .from('games')
          .select('selected_questions')
          .eq('id', gameId)
          .single();

        if (!gameError && gameData) {
          const selectedQuestions = gameData.selected_questions || [];
          if (!selectedQuestions.includes(questionId)) {
            const { error: updateError } = await supabase
              .from('games')
              .update({
                selected_questions: [...selectedQuestions, questionId]
              })
              .eq('id', gameId);

            if (updateError) {
              console.warn('Failed to mark question in DB (will sync later):', updateError);
            }
          }
        }
      } catch (markError) {
        console.warn('Failed to mark question as used in DB:', markError);
      }

      // For Daily Doubles, after the controlling team answers, the question is done
      // Clear everything and close modal
      if (isMountedRef.current) {
        clearWager();
        setCurrentQuestion(null);
      }

    } catch (error) {
      console.error('Error handling incorrect answer:', error);
      if (isMountedRef.current) {
        alert('Failed to update score. Please try again.');
      }
    } finally {
      if (isMountedRef.current) {
        setIsProcessing(false);
      }
    }
  };

  // Handle escape key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isProcessing && !isWagerSubmitted) {
        handleClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    } else {
      // Ensure wager is cleared when modal is not open
      if (isWagerSubmitted || currentWager !== null || controllingTeamId !== null) {
        clearWager();
      }
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, isProcessing, handleClose, isWagerSubmitted, currentWager, controllingTeamId, clearWager]);

  // Don't render if not open or not a Daily Double
  if (!isOpen || !currentQuestion) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-80 p-4"
      onClick={(e) => {
        // Close modal if clicking the backdrop (only if wager not submitted)
        if (e.target === e.currentTarget && !isProcessing && !isWagerSubmitted) {
          handleClose();
        }
      }}
    >
      <div className="bg-gradient-to-br from-green-800 to-green-900 rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto border-4 border-yellow-400">
        {/* Header Section with DAILY DOUBLE announcement */}
        <div className="sticky top-0 bg-green-800 border-b-4 border-yellow-400 p-6">
          <div className="text-center mb-4">
            <div className="text-6xl font-black text-yellow-300 mb-2 animate-pulse">
              DAILY DOUBLE!
            </div>
            <h2 className="text-2xl font-bold text-white">
              {categoryName}
            </h2>
          </div>
          <button
            onClick={handleClose}
            disabled={isProcessing}
            className="absolute top-4 right-4 text-gray-300 hover:text-white transition-colors disabled:opacity-50"
            aria-label="Close modal"
          >
            <svg
              className="w-8 h-8"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Main Content Area */}
        <div className="p-8">
          {/* Show wager input if not submitted yet */}
          {!isWagerSubmitted ? (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <p className="text-2xl text-yellow-100 font-semibold mb-2">
                  Select the controlling team and place a wager
                </p>
                <p className="text-lg text-white">
                  The team that chose this question will answer after the wager is placed.
                </p>
              </div>

              <div className="bg-green-700 rounded-lg p-6 border-2 border-yellow-300">
                <h3 className="text-xl font-bold text-yellow-300 mb-4 text-center">
                  Wager Setup
                </h3>
                <div className="space-y-4">
                  {/* Team Selection */}
                  <div>
                    <label htmlFor="team-select" className="block text-white font-semibold mb-2">
                      Controlling Team <span className="text-red-400">*</span>
                    </label>
                    <select
                      id="team-select"
                      value={controllingTeamId || ''}
                      onChange={(e) => {
                        setControllingTeam(e.target.value);
                        setWagerError(null);
                      }}
                      disabled={isProcessing}
                      className="w-full px-4 py-3 text-lg bg-white text-gray-900 rounded-lg border-2 border-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-300"
                    >
                      <option value="">-- Select Team --</option>
                      {allTeams.map((team) => (
                        <option key={team.id} value={team.id}>
                          {team.name} (Current Score: {team.score} pts)
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Wager Amount */}
                  <div>
                    <label htmlFor="wager" className="block text-white font-semibold mb-2">
                      Wager Amount <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="number"
                      id="wager"
                      value={wagerInput}
                      onChange={(e) => {
                        setWagerInput(e.target.value);
                        setWagerError(null);
                      }}
                      min={DAILY_DOUBLE_MIN_WAGER}
                      max={getMaxWager()}
                      disabled={isProcessing || !controllingTeamId}
                      className="w-full px-4 py-3 text-2xl font-bold text-center bg-white text-gray-900 rounded-lg border-2 border-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-300 disabled:bg-gray-300 disabled:cursor-not-allowed"
                      placeholder={controllingTeamId ? `${DAILY_DOUBLE_MIN_WAGER} - ${getMaxWager()}` : 'Select team first'}
                      autoFocus={!!controllingTeamId}
                    />
                    {controllingTeamId && (
                      <p className="mt-2 text-yellow-100 text-sm">
                        Maximum wager: {getMaxWager()} (higher of team&apos;s score or {DAILY_DOUBLE_MAX_WAGER})
                      </p>
                    )}
                    {wagerError && (
                      <p className="mt-2 text-red-300 text-sm font-semibold">{wagerError}</p>
                    )}
                  </div>

                  <button
                    onClick={handleWagerSubmit}
                    disabled={isProcessing || !wagerInput || !controllingTeamId}
                    className="w-full py-4 px-6 bg-yellow-400 hover:bg-yellow-300 disabled:bg-gray-500 disabled:cursor-not-allowed text-gray-900 font-bold text-xl rounded-lg shadow-lg transition-colors"
                  >
                    {isProcessing ? 'Processing...' : 'Submit Wager & Reveal Question'}
                  </button>
                </div>
              </div>

              <div className="text-center">
                <p className="text-sm text-yellow-200">
                  💡 The wager will be awarded for a correct answer or deducted for an incorrect answer
                </p>
              </div>
            </div>
          ) : (
            // Show question and answer controls after wager is submitted
            <div className="space-y-6">
              <div className="bg-green-700 rounded-lg p-6 border-2 border-yellow-300">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-yellow-200 mb-1">Controlling Team</p>
                    <p className="text-2xl font-bold text-white">
                      {controllingTeam?.name || 'Unknown Team'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-yellow-200 mb-1">Wager</p>
                    <p className="text-3xl font-bold text-yellow-300">{currentWager} pts</p>
                  </div>
                </div>
              </div>

              <div className="text-center mb-8">
                <p className="text-2xl md:text-3xl lg:text-4xl text-white font-medium leading-relaxed">
                  {currentQuestion.text}
                </p>
              </div>

              {/* Teacher Controls Section */}
              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  onClick={handleCorrect}
                  disabled={isProcessing}
                  className="flex-1 py-4 px-6 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold text-xl rounded-lg shadow-lg transition-colors"
                >
                  {isProcessing ? 'Processing...' : `✓ Correct (+${currentWager} pts)`}
                </button>
                <button
                  onClick={handleIncorrect}
                  disabled={isProcessing}
                  className="flex-1 py-4 px-6 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold text-xl rounded-lg shadow-lg transition-colors"
                >
                  {isProcessing ? 'Processing...' : `✗ Incorrect (-${currentWager} pts)`}
                </button>
                <button
                  onClick={handleClose}
                  disabled={isProcessing}
                  className="sm:flex-none px-6 py-4 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-semibold text-lg rounded-lg transition-colors"
                >
                  Close
                </button>
              </div>

              {/* Help Text */}
              <div className="mt-6 text-center text-sm text-yellow-200">
                <p>Press <kbd className="px-2 py-1 bg-green-700 rounded border border-yellow-300">ESC</kbd> to close without scoring</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
