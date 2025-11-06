"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useGameStore } from '../../lib/stores/gameStore';
import { createClient } from '@/lib/supabase/client';

interface DailyDoubleModalProps {
  gameId: string;
}

export const DailyDoubleModal: React.FC<DailyDoubleModalProps> = ({ gameId }) => {
  const {
    currentQuestion,
    setCurrentQuestion,
    buzzQueue,
    removeBuzz,
    clearBuzzQueue,
    allTeams,
    currentWager,
    setCurrentWager,
    isWagerSubmitted,
    setWagerSubmitted,
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

  // Get the first team in the buzz queue
  const firstBuzzTeam = buzzQueue.length > 0 ? buzzQueue[0] : null;
  const firstTeamData = firstBuzzTeam
    ? allTeams.find(team => team.id === firstBuzzTeam.teamId)
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

  // Validate wager amount
  const validateWager = useCallback((amount: number, teamScore: number): string | null => {
    // Min wager: 5 points (or team's score if 0 < score < 5, or 5 if score <= 0)
    const minWager = teamScore > 0 ? Math.min(5, teamScore) : 5;

    // Max wager: current score or 500, whichever is less (but never less than minWager)
    // If team has negative or zero score, they can still wager the minimum
    const maxWager = teamScore <= 0 ? minWager : Math.min(teamScore, 500);

    if (amount < minWager) {
      return `Minimum wager is ${minWager} points`;
    }

    if (amount > maxWager) {
      return `Maximum wager is ${maxWager} points`;
    }

    return null;
  }, []);

  // Handle wager submission
  const handleWagerSubmit = useCallback(async () => {
    if (!firstTeamData || !currentQuestion) return;

    const wagerAmount = parseInt(wagerInput, 10);

    // Validate wager is a number
    if (isNaN(wagerAmount) || wagerAmount <= 0) {
      setWagerError('Please enter a valid wager amount');
      return;
    }

    setIsProcessing(true);
    try {
      // Fetch fresh team data from database to prevent stale score validation
      const { data: freshTeam, error: fetchError } = await supabase
        .from('teams')
        .select('score')
        .eq('id', firstTeamData.id)
        .single();

      if (fetchError) throw fetchError;

      const currentScore = freshTeam?.score ?? 0;

      // Re-validate with fresh score from database
      const validationError = validateWager(wagerAmount, currentScore);
      if (validationError) {
        setWagerError(validationError);
        setIsProcessing(false); // Reset processing state before early return
        return;
      }

      // Set wager and mark as submitted
      setCurrentWager(wagerAmount);
      setWagerSubmitted(true);
      setWagerError(null);

      // TODO: Broadcast wager submission via real-time channel
      console.log(`Wager submitted: ${wagerAmount} points for question ${currentQuestion.id}`);
    } catch (error) {
      console.error('Error validating wager:', error);

      // Provide specific error messages based on error type
      let errorMessage = 'Failed to validate wager. Please try again.';

      if (error && typeof error === 'object') {
        const err = error as { message?: string; code?: string; details?: string };

        // Network or connection errors
        if (err.message?.includes('fetch') || err.message?.includes('network')) {
          errorMessage = 'Network error: Unable to connect to the server. Please check your internet connection and try again.';
        }
        // Database/auth errors
        else if (err.code === 'PGRST116') {
          errorMessage = 'Team not found. The team may have been removed from the game.';
        }
        // Permission errors
        else if (err.message?.includes('permission') || err.message?.includes('RLS')) {
          errorMessage = 'Permission denied: You do not have access to update this team\'s data.';
        }
        // Timeout errors
        else if (err.message?.includes('timeout')) {
          errorMessage = 'Request timed out. The server is taking too long to respond. Please try again.';
        }
        // Generic database errors
        else if (err.message) {
          errorMessage = `Database error: ${err.message}`;
        }
      }

      setWagerError(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  }, [wagerInput, firstTeamData, currentQuestion, validateWager, setCurrentWager, setWagerSubmitted, supabase]);

  // Close modal handler
  const handleClose = useCallback(async () => {
    if (isProcessing) return;

    setIsProcessing(true);

    // Mark question as used in database before closing to prevent reopening
    if (currentQuestion) {
      // Mark in local store immediately (optimistic update)
      // This ensures UI consistency even if DB update fails
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
    clearBuzzQueue();
    clearWager();
    setIsProcessing(false);
  }, [isProcessing, setCurrentQuestion, clearBuzzQueue, clearWager, markQuestionUsed, currentQuestion, gameId, supabase]);

  // Handle correct answer with wager
  const handleCorrect = async () => {
    if (isProcessing || !currentQuestion || !firstBuzzTeam || !firstTeamData || !currentWager) return;

    // IMPORTANT: Snapshot values before any async operations to prevent race conditions
    const teamIdToUpdate = firstTeamData.id;
    const scoreToAward = currentWager; // Use wager amount instead of question value
    const questionId = currentQuestion.id;

    setIsProcessing(true);
    try {
      // Fetch fresh team score from database to prevent stale data issues
      const { data: freshTeam, error: fetchError } = await supabase
        .from('teams')
        .select('score')
        .eq('id', teamIdToUpdate)
        .single();

      if (fetchError) {
        console.error('Error fetching fresh team score:', fetchError);
        throw fetchError;
      }

      const currentScore = freshTeam?.score ?? 0;

      // Award wager points to the first team in the buzz queue
      const newScore = currentScore + scoreToAward;

      // CRITICAL: Update the team score first (most important operation)
      const { error: scoreError } = await supabase
        .from('teams')
        .update({ score: newScore })
        .eq('id', teamIdToUpdate);

      if (scoreError) {
        console.error('Error updating team score:', scoreError);
        throw scoreError;
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

      // Success - clear buzz queue, wager, and close modal
      if (isMountedRef.current) {
        clearBuzzQueue();
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
    if (isProcessing || !currentQuestion || !firstBuzzTeam || !firstTeamData || !currentWager) return;

    // IMPORTANT: Snapshot values before any async operations to prevent race conditions
    const teamIdToRemove = firstTeamData.id;
    const scoreToDeduct = currentWager; // Use wager amount instead of question value
    const questionId = currentQuestion.id;

    setIsProcessing(true);
    try {
      // Fetch fresh team score from database to prevent stale data issues
      const { data: freshTeam, error: fetchError } = await supabase
        .from('teams')
        .select('score')
        .eq('id', teamIdToRemove)
        .single();

      if (fetchError) {
        console.error('Error fetching fresh team score:', fetchError);
        throw fetchError;
      }

      const currentScore = freshTeam?.score ?? 0;

      // Deduct wager points from the first team in the buzz queue
      const newScore = currentScore - scoreToDeduct;

      // Update the team score in the database
      const { error: scoreError } = await supabase
        .from('teams')
        .update({ score: newScore })
        .eq('id', teamIdToRemove);

      if (scoreError) {
        console.error('Error updating team score:', scoreError);
        throw scoreError;
      }

      // Remove the team from buzz queue using the snapshot, not current state
      if (isMountedRef.current) {
        removeBuzz(teamIdToRemove);
      }

      // Mark question as used in database (same as handleCorrect)
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

      // For Daily Doubles, after one team answers incorrectly, the question is done
      // Clear everything and close modal
      if (isMountedRef.current) {
        clearBuzzQueue();
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
      if (e.key === 'Escape' && isOpen && !isProcessing) {
        handleClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    } else {
      // Ensure wager is cleared when modal is not open
      if (isWagerSubmitted || currentWager !== null) {
        clearWager();
      }
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, isProcessing, handleClose, isWagerSubmitted, currentWager, clearWager]);

  // Don't render if not open or not a Daily Double
  if (!isOpen || !currentQuestion) return null;

  // Calculate min and max wager for the current team
  const teamScore = firstTeamData?.score || 0;
  const minWager = teamScore > 0 ? Math.min(5, teamScore) : 5;
  const maxWager = teamScore <= 0 ? minWager : Math.min(teamScore, 500);

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
                  {firstTeamData?.name || 'Team'} has buzzed in!
                </p>
                <p className="text-lg text-white">
                  Current Score: <span className="font-bold text-yellow-300">{teamScore} points</span>
                </p>
              </div>

              <div className="bg-green-700 rounded-lg p-6 border-2 border-yellow-300">
                <h3 className="text-xl font-bold text-yellow-300 mb-4 text-center">
                  Place Your Wager
                </h3>
                <div className="space-y-4">
                  <div>
                    <label htmlFor="wager" className="block text-white font-semibold mb-2">
                      Wager Amount (Min: {minWager}, Max: {maxWager})
                    </label>
                    <input
                      type="number"
                      id="wager"
                      value={wagerInput}
                      onChange={(e) => {
                        setWagerInput(e.target.value);
                        setWagerError(null);
                      }}
                      min={minWager}
                      max={maxWager}
                      disabled={isProcessing}
                      className="w-full px-4 py-3 text-2xl font-bold text-center bg-white text-gray-900 rounded-lg border-2 border-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-300"
                      placeholder={`${minWager} - ${maxWager}`}
                      autoFocus
                    />
                    {wagerError && (
                      <p className="mt-2 text-red-300 text-sm font-semibold">{wagerError}</p>
                    )}
                  </div>

                  <button
                    onClick={handleWagerSubmit}
                    disabled={isProcessing || !wagerInput}
                    className="w-full py-4 px-6 bg-yellow-400 hover:bg-yellow-300 disabled:bg-gray-500 disabled:cursor-not-allowed text-gray-900 font-bold text-xl rounded-lg shadow-lg transition-colors"
                  >
                    {isProcessing ? 'Processing...' : 'Submit Wager'}
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
                <p className="text-lg text-yellow-200 mb-2 text-center">
                  Wager: <span className="font-bold text-yellow-300 text-2xl">{currentWager} points</span>
                </p>
                <p className="text-sm text-yellow-100 text-center">
                  {firstTeamData?.name} is answering for {currentWager} points
                </p>
              </div>

              <div className="text-center mb-8">
                <p className="text-2xl md:text-3xl lg:text-4xl text-white font-medium leading-relaxed">
                  {currentQuestion.text}
                </p>
              </div>

              {/* Buzz Queue Section */}
              <div className="mb-8">
                <h3 className="text-xl font-bold text-white mb-4">Answering</h3>
                {buzzQueue.length === 0 ? (
                  <div className="bg-green-700 rounded-lg p-6 text-center border-2 border-yellow-300">
                    <p className="text-yellow-100">
                      {isProcessing ? "Processing answer..." : "Waiting for team to buzz in..."}
                    </p>
                  </div>
                ) : (
                  <div className="bg-yellow-500 border-2 border-yellow-300 rounded-lg p-4 flex items-center justify-between shadow-lg">
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-bold text-gray-900">
                        ANSWERING
                      </span>
                      <span className="text-lg font-semibold text-gray-900">
                        {firstTeamData?.name || 'Unknown Team'}
                      </span>
                    </div>
                    <div className="text-sm text-gray-900 font-semibold">
                      {firstTeamData ? `${firstTeamData.score} pts` : ''}
                    </div>
                  </div>
                )}
              </div>

              {/* Teacher Controls Section */}
              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  onClick={handleCorrect}
                  disabled={isProcessing || buzzQueue.length === 0}
                  className="flex-1 py-4 px-6 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold text-xl rounded-lg shadow-lg transition-colors"
                >
                  {isProcessing ? 'Processing...' : '✓ Correct'}
                </button>
                <button
                  onClick={handleIncorrect}
                  disabled={isProcessing || buzzQueue.length === 0}
                  className="flex-1 py-4 px-6 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold text-xl rounded-lg shadow-lg transition-colors"
                >
                  {isProcessing ? 'Processing...' : '✗ Incorrect'}
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
