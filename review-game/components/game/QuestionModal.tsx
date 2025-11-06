"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useGameStore } from '../../lib/stores/gameStore';
import { createClient } from '@/lib/supabase/client';
import { Timer } from './Timer';

interface QuestionModalProps {
  gameId: string;
}

export const QuestionModal: React.FC<QuestionModalProps> = ({ gameId }) => {
  const {
    currentQuestion,
    setCurrentQuestion,
    buzzQueue,
    removeBuzz,
    clearBuzzQueue,
    allTeams,
    currentGameData,
  } = useGameStore();

  const [isProcessing, setIsProcessing] = useState(false);
  const supabase = createClient();

  // Track if component is mounted to prevent state updates after unmount
  const isMountedRef = useRef(true);

  // Memoized timer expiration handler
  const handleTimerExpire = useCallback(() => {
    if (currentQuestion) {
      console.log('Timer expired for question:', currentQuestion.id);
      // TODO: Consider auto-closing modal or preventing new buzzes
    }
  }, [currentQuestion]);

  // Modal is open when currentQuestion is not null
  const isOpen = currentQuestion !== null;

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

  // Close modal handler
  const handleClose = useCallback(() => {
    if (isProcessing) return;
    setCurrentQuestion(null);
    clearBuzzQueue();
  }, [isProcessing, setCurrentQuestion, clearBuzzQueue]);

  // Handle correct answer
  const handleCorrect = async () => {
    if (isProcessing || !currentQuestion || !firstBuzzTeam || !firstTeamData) return;

    // IMPORTANT: Snapshot values before any async operations to prevent race conditions
    const teamIdToUpdate = firstTeamData.id;
    const scoreToAward = currentQuestion.value;
    const currentScore = firstTeamData.score;
    const questionId = currentQuestion.id;

    setIsProcessing(true);
    try {
      // Award points to the first team in the buzz queue
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
      // Note: Question is already marked in local state via markQuestionUsed() in GameBoard
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
              // Log but don't fail - question is marked locally
              console.warn('Failed to mark question in DB (will sync later):', updateError);
            }
          }
        }
      } catch (markError) {
        // Non-critical failure - log and continue
        console.warn('Failed to mark question as used in DB:', markError);
      }

      // Success - clear buzz queue and close modal
      if (isMountedRef.current) {
        clearBuzzQueue();
        setCurrentQuestion(null);
      }
    } catch (error) {
      console.error('Error handling correct answer:', error);
      if (isMountedRef.current) {
        alert('Failed to update score. Please try again.');
      }
    } finally {
      // Only update state if component is still mounted
      if (isMountedRef.current) {
        setIsProcessing(false);
      }
    }
  };

  // Handle incorrect answer
  const handleIncorrect = async () => {
    if (isProcessing || !currentQuestion || !firstBuzzTeam || !firstTeamData) return;

    // IMPORTANT: Snapshot team ID before any async operations to prevent race conditions
    // The buzz queue could change during async operations (especially with real-time updates)
    const teamIdToRemove = firstTeamData.id;
    const scoreToDeduct = currentQuestion.value;
    const currentScore = firstTeamData.score;

    setIsProcessing(true);
    try {
      // Deduct points from the first team in the buzz queue
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

      // If no more teams in queue after removal, modal stays open
      // Teacher can close manually or wait for more buzzes

    } catch (error) {
      console.error('Error handling incorrect answer:', error);
      if (isMountedRef.current) {
        alert('Failed to update score. Please try again.');
      }
    } finally {
      // Only update state if component is still mounted
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
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, isProcessing, handleClose]);

  // Don't render if not open or if it's a Daily Double (DailyDoubleModal handles those)
  if (!isOpen || !currentQuestion || currentQuestion.isDailyDouble) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-80 p-4"
      onClick={(e) => {
        // Close modal if clicking the backdrop
        if (e.target === e.currentTarget && !isProcessing) {
          handleClose();
        }
      }}
    >
      <div className="bg-gray-800 rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Header Section */}
        <div className="sticky top-0 bg-gray-800 border-b border-gray-700 p-6 flex items-center justify-between gap-6">
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-white mb-1">
              {categoryName}
            </h2>
            <div className="text-3xl font-bold text-blue-400">
              {currentQuestion.value} Points
            </div>
            {currentQuestion.isDailyDouble && (
              <span className="inline-block mt-2 px-3 py-1 bg-green-600 text-white text-sm font-bold rounded">
                DAILY DOUBLE
              </span>
            )}
          </div>

          {/* Timer Component */}
          {currentGameData?.timerEnabled &&
           currentGameData?.timerSeconds !== undefined &&
           currentGameData.timerSeconds > 0 && (
            <div className="flex-shrink-0">
              <Timer
                key={currentQuestion.id}
                duration={currentGameData.timerSeconds}
                enabled={true}
                autoStart={true}
                onExpire={handleTimerExpire}
              />
            </div>
          )}

          <button
            onClick={handleClose}
            disabled={isProcessing}
            className="text-gray-400 hover:text-white transition-colors disabled:opacity-50 flex-shrink-0"
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
          <div className="text-center mb-8">
            <p className="text-2xl md:text-3xl lg:text-4xl text-white font-medium leading-relaxed">
              {currentQuestion.text}
            </p>
          </div>

          {/* Buzz Queue Section */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white">Buzz Queue</h3>
              {buzzQueue.length > 0 && (
                <button
                  onClick={() => {
                    if (window.confirm('Clear all buzzes? This cannot be undone.')) {
                      clearBuzzQueue();
                    }
                  }}
                  disabled={isProcessing}
                  className="px-3 py-1 text-sm bg-gray-600 hover:bg-gray-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded transition-colors"
                  title="Clear all buzzes"
                >
                  Clear Queue
                </button>
              )}
            </div>
            {buzzQueue.length === 0 ? (
              <div className="bg-gray-700 rounded-lg p-6 text-center">
                <p className="text-gray-400">
                  {isProcessing
                    ? "Processing answer..."
                    : "Waiting for buzzes..."}
                </p>
                {!isProcessing && (
                  <p className="text-yellow-400 text-sm mt-3 flex items-center justify-center gap-2">
                    <span>💡</span>
                    <span>Waiting for teams to buzz in, or close this question to continue.</span>
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {buzzQueue.map((buzz, index) => {
                  const team = allTeams.find(t => t.id === buzz.teamId);
                  const isFirst = index === 0;

                  // Get position emoji and text
                  const getPositionDisplay = (pos: number) => {
                    switch (pos) {
                      case 0: return { emoji: '🥇', text: '1st', color: 'text-yellow-500' };
                      case 1: return { emoji: '🥈', text: '2nd', color: 'text-gray-400' };
                      case 2: return { emoji: '🥉', text: '3rd', color: 'text-orange-500' };
                      default: return { emoji: '🏅', text: `${pos + 1}th`, color: 'text-blue-400' };
                    }
                  };

                  const position = getPositionDisplay(index);

                  return (
                    <div
                      key={`${buzz.teamId}-${buzz.timestamp}`}
                      className={`p-4 rounded-lg flex items-center justify-between transition-all ${
                        isFirst
                          ? 'bg-green-100 border-2 border-green-500 shadow-lg'
                          : 'bg-gray-700'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl" aria-label={position.text}>
                          {position.emoji}
                        </span>
                        <span className={`text-base font-bold ${
                          isFirst ? 'text-green-900' : position.color
                        }`}>
                          {position.text}
                        </span>
                        <span className={`text-lg font-semibold ${
                          isFirst ? 'text-green-900' : 'text-gray-300'
                        }`}>
                          {team?.name || 'Unknown Team'}
                        </span>
                        {isFirst && (
                          <span className="ml-2 px-2 py-1 bg-green-600 text-white text-xs font-bold rounded">
                            ANSWERING
                          </span>
                        )}
                      </div>
                      <div className={`text-sm ${
                        isFirst ? 'text-green-700' : 'text-gray-400'
                      }`}>
                        {team ? `${team.score} pts` : ''}
                      </div>
                    </div>
                  );
                })}
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
          <div className="mt-6 text-center text-sm text-gray-400">
            <p>Press <kbd className="px-2 py-1 bg-gray-700 rounded">ESC</kbd> to close without scoring</p>
          </div>
        </div>
      </div>
    </div>
  );
};
