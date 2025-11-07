"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useGameStore } from '../../lib/stores/gameStore';
import { createClient } from '@/lib/supabase/client';
import { Timer } from './Timer';
import { getPositionDisplay } from '@/lib/utils/position';
import { logger } from '@/lib/logger';

interface QuestionModalProps {
  gameId: string;
  onClearBuzzes: () => void;
}

interface BuzzQueueItemProps {
  index: number;
  isFirst: boolean;
  teamName: string;
  teamScore: number;
}

// Memoized BuzzQueueItem component to prevent unnecessary re-renders
const BuzzQueueItem = React.memo<BuzzQueueItemProps>(({ index, isFirst, teamName, teamScore }) => {
  const position = getPositionDisplay(index);

  return (
    <div
      role="listitem"
      aria-label={isFirst ? `First place: ${teamName} is answering` : `${position.text} place: ${teamName}`}
      className={`p-4 rounded-lg flex items-center justify-between transition-all ${
        isFirst
          ? 'bg-green-100 border-2 border-green-500 shadow-lg'
          : 'bg-gray-700'
      }`}
    >
      <div className="flex items-center gap-3">
        <span className="text-2xl" aria-hidden="true">
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
          {teamName}
        </span>
        {isFirst && (
          <span className="ml-2 px-2 py-1 bg-green-600 text-white text-xs font-bold rounded" aria-hidden="true">
            ANSWERING
          </span>
        )}
      </div>
      <div className={`text-sm ${
        isFirst ? 'text-green-700' : 'text-gray-400'
      }`}>
        {teamScore} pts
      </div>
    </div>
  );
});

BuzzQueueItem.displayName = 'BuzzQueueItem';

export const QuestionModal: React.FC<QuestionModalProps> = ({ gameId, onClearBuzzes }) => {
  const {
    currentQuestion,
    setCurrentQuestion,
    buzzQueue,
    removeBuzz,
    allTeams,
    currentGameData,
  } = useGameStore();

  const [isProcessing, setIsProcessing] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [srAnnouncement, setSrAnnouncement] = useState('');
  const [previousBuzzQueueLength, setPreviousBuzzQueueLength] = useState(0);

  // Supabase client - not memoized to allow session updates
  const supabase = createClient();

  // Track if component is mounted to prevent state updates after unmount
  const isMountedRef = useRef(true);

  // Refs for focus management
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);
  const focusableElementsRef = useRef<HTMLElement[]>([]);

  // Memoized timer expiration handler
  const handleTimerExpire = useCallback(() => {
    if (currentQuestion) {
      logger.info('Question timer expired', {
        questionId: currentQuestion.id,
        gameId,
        operation: 'timerExpired',
      });
      // TODO: Consider auto-closing modal or preventing new buzzes
    }
  }, [currentQuestion, gameId]);

  // Modal is open when currentQuestion is not null
  const isOpen = currentQuestion !== null;

  // Memoize first team calculation to prevent unnecessary re-renders
  const firstTeamData = useMemo(() => {
    if (buzzQueue.length === 0) return null;
    return allTeams.find(team => team.id === buzzQueue[0].teamId);
  }, [buzzQueue, allTeams]);

  // Get the first team in the buzz queue (derived from buzzQueue for compatibility)
  const firstBuzzTeam = buzzQueue.length > 0 ? buzzQueue[0] : null;

  // Category name - no memoization needed for simple string operations
  const categoryName = currentQuestion?.categoryName || 'Category';

  // Memoize buzz queue items to prevent unnecessary re-renders
  const buzzQueueItems = useMemo(() => {
    return buzzQueue.map((buzz, index) => {
      const team = allTeams.find(t => t.id === buzz.teamId);
      const isFirst = index === 0;
      const teamName = team?.name || 'Unknown Team';
      const teamScore = team?.score || 0;

      return (
        <BuzzQueueItem
          key={`${buzz.teamId}-${buzz.timestamp}`}
          index={index}
          isFirst={isFirst}
          teamName={teamName}
          teamScore={teamScore}
        />
      );
    });
  }, [buzzQueue, allTeams]);

  // Set mounted flag on mount and clean up on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Performance monitoring: Track modal open/close
  useEffect(() => {
    if (isOpen) {
      performance.mark('modal-opened');
      // Optional: Measure time from previous close to this open
      try {
        performance.measure('modal-closed-to-opened', 'modal-closed', 'modal-opened');
      } catch (e) {
        // First open, no previous close mark exists
      }
    } else {
      performance.mark('modal-closed');
      // Optional: Measure time modal was open
      try {
        performance.measure('modal-open-duration', 'modal-opened', 'modal-closed');
      } catch (e) {
        // Modal wasn't opened, no mark exists
      }
    }
  }, [isOpen]);

  // Focus management: Save previous focus and set initial focus
  useEffect(() => {
    if (isOpen) {
      // Save the currently focused element
      previousActiveElementRef.current = document.activeElement as HTMLElement;

      // Focus the close button when modal opens
      setTimeout(() => {
        closeButtonRef.current?.focus();
      }, 100);

      // Announce modal opened
      setSrAnnouncement(`Question modal opened. ${categoryName} for ${currentQuestion?.value} points. ${currentQuestion?.text}`);
    } else if (previousActiveElementRef.current) {
      // Restore focus when modal closes
      previousActiveElementRef.current.focus();
      previousActiveElementRef.current = null;

      // Announce modal closed
      setSrAnnouncement('Question modal closed');
    }
  }, [isOpen, categoryName, currentQuestion?.value, currentQuestion?.text]);

  // Focus trap: Keep focus within modal
  useEffect(() => {
    if (!isOpen || !modalRef.current) return;

    const updateFocusableElements = () => {
      if (!modalRef.current) return;

      const focusableSelectors = [
        'button:not([disabled])',
        'a[href]',
        'input:not([disabled])',
        'select:not([disabled])',
        'textarea:not([disabled])',
        '[tabindex]:not([tabindex="-1"])'
      ].join(', ');

      focusableElementsRef.current = Array.from(
        modalRef.current.querySelectorAll(focusableSelectors)
      ) as HTMLElement[];
    };

    updateFocusableElements();

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      const focusableElements = focusableElementsRef.current;
      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.shiftKey) {
        // Shift + Tab: Moving backwards
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        // Tab: Moving forwards
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    document.addEventListener('keydown', handleTabKey);

    // Update focusable elements when buzz queue changes
    const observer = new MutationObserver(updateFocusableElements);
    observer.observe(modalRef.current, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['disabled']
    });

    return () => {
      document.removeEventListener('keydown', handleTabKey);
      observer.disconnect();
    };
  }, [isOpen]);

  // Announce buzz queue changes
  useEffect(() => {
    if (!isOpen) return;

    const currentLength = buzzQueue.length;

    if (currentLength > previousBuzzQueueLength) {
      // New buzz added
      const latestBuzz = buzzQueue[currentLength - 1];
      const team = allTeams.find(t => t.id === latestBuzz.teamId);
      if (team) {
        setSrAnnouncement(`${team.name} buzzed in. Position ${currentLength} in queue.`);
      }
    } else if (currentLength < previousBuzzQueueLength && currentLength === 0) {
      // Queue became empty
      setSrAnnouncement('Buzz queue is now empty. Waiting for teams to buzz in.');
    }

    setPreviousBuzzQueueLength(currentLength);
  }, [buzzQueue, previousBuzzQueueLength, allTeams, isOpen]);

  // Close modal handler
  const handleClose = useCallback(() => {
    if (isProcessing) return;
    setCurrentQuestion(null);
    onClearBuzzes();
  }, [isProcessing, setCurrentQuestion, onClearBuzzes]);

  // Handle correct answer - memoized to prevent unnecessary re-renders
  const handleCorrect = useCallback(async () => {
    if (isProcessing || !currentQuestion || !firstTeamData) return;

    // IMPORTANT: Snapshot values before any async operations to prevent race conditions
    const teamIdToUpdate = firstTeamData.id;
    const scoreToAward = currentQuestion.value;
    const questionId = currentQuestion.id;

    setIsProcessing(true);
    try {
      // Award points to the first team in the buzz queue
      // Use server-side RPC function for proper authorization and atomic updates
      const { data: scoreResult, error: scoreError } = await supabase
        .rpc('update_team_score', {
          p_team_id: teamIdToUpdate,
          p_score_change: scoreToAward,
          p_game_id: gameId
        });

      if (scoreError) {
        logger.error('Failed to update team score for correct answer', scoreError, {
          teamId: teamIdToUpdate,
          scoreChange: scoreToAward,
          gameId,
          questionId,
          operation: 'correctAnswer',
        });
        throw scoreError;
      }

      // Check for authorization or validation errors from the RPC function
      if (scoreResult && scoreResult.length > 0 && !scoreResult[0].success) {
        logger.error('Team score update failed for correct answer', scoreResult[0].error_message, {
          teamId: teamIdToUpdate,
          scoreChange: scoreToAward,
          gameId,
          questionId,
          errorMessage: scoreResult[0].error_message,
          operation: 'correctAnswer',
        });
        throw new Error(scoreResult[0].error_message || 'Failed to update score');
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
              logger.warn('Failed to mark question in database (will sync later)', {
                gameId,
                questionId,
                operation: 'markQuestionUsed',
                error: updateError,
              });
            }
          }
        }
      } catch (markError) {
        // Non-critical failure - log and continue
        logger.warn('Failed to mark question as used in database', {
          gameId,
          questionId,
          operation: 'markQuestionUsed',
          error: markError,
        });
      }

      // Success - clear buzz queue and close modal
      if (isMountedRef.current) {
        // Announce score update
        const newScore = (firstTeamData.score || 0) + scoreToAward;
        setSrAnnouncement(`Correct! ${firstTeamData.name} earned ${scoreToAward} points. New score: ${newScore} points.`);
        onClearBuzzes();
        setCurrentQuestion(null);
      }
    } catch (error) {
      logger.error('Failed to handle correct answer', error, {
        teamId: teamIdToUpdate,
        scoreChange: scoreToAward,
        gameId,
        questionId,
        operation: 'correctAnswer',
      });
      if (isMountedRef.current) {
        const errorMessage = error instanceof Error
          ? error.message
          : 'Failed to update score. Please try again.';
        alert(errorMessage);
      }
    } finally {
      // Only update state if component is still mounted
      if (isMountedRef.current) {
        setIsProcessing(false);
      }
    }
  }, [isProcessing, currentQuestion, firstTeamData, gameId, onClearBuzzes, setCurrentQuestion]);

  // Handle incorrect answer - memoized to prevent unnecessary re-renders
  const handleIncorrect = useCallback(async () => {
    if (isProcessing || !currentQuestion || !firstTeamData) return;

    // IMPORTANT: Snapshot team ID before any async operations to prevent race conditions
    // The buzz queue could change during async operations (especially with real-time updates)
    const teamIdToRemove = firstTeamData.id;
    const scoreToDeduct = currentQuestion.value;

    setIsProcessing(true);
    try {
      // Deduct points from the first team in the buzz queue
      // Use server-side RPC function for proper authorization and atomic updates
      const { data: scoreResult, error: scoreError } = await supabase
        .rpc('update_team_score', {
          p_team_id: teamIdToRemove,
          p_score_change: -scoreToDeduct, // Negative for deduction
          p_game_id: gameId
        });

      if (scoreError) {
        logger.error('Failed to update team score for incorrect answer', scoreError, {
          teamId: teamIdToRemove,
          scoreChange: -scoreToDeduct,
          gameId,
          questionId: currentQuestion.id,
          operation: 'incorrectAnswer',
        });
        throw scoreError;
      }

      // Check for authorization or validation errors from the RPC function
      if (scoreResult && scoreResult.length > 0 && !scoreResult[0].success) {
        logger.error('Team score update failed for incorrect answer', scoreResult[0].error_message, {
          teamId: teamIdToRemove,
          scoreChange: -scoreToDeduct,
          gameId,
          questionId: currentQuestion.id,
          errorMessage: scoreResult[0].error_message,
          operation: 'incorrectAnswer',
        });
        throw new Error(scoreResult[0].error_message || 'Failed to update score');
      }

      // Remove the team from buzz queue using the snapshot, not current state
      if (isMountedRef.current) {
        // Announce score update
        const newScore = (firstTeamData.score || 0) - scoreToDeduct;
        setSrAnnouncement(`Incorrect. ${firstTeamData.name} lost ${scoreToDeduct} points. New score: ${newScore} points.`);
        removeBuzz(teamIdToRemove);
      }

      // If no more teams in queue after removal, modal stays open
      // Teacher can close manually or wait for more buzzes

    } catch (error) {
      logger.error('Failed to handle incorrect answer', error, {
        teamId: teamIdToRemove,
        scoreChange: -scoreToDeduct,
        gameId,
        questionId: currentQuestion.id,
        operation: 'incorrectAnswer',
      });
      if (isMountedRef.current) {
        const errorMessage = error instanceof Error
          ? error.message
          : 'Failed to update score. Please try again.';
        alert(errorMessage);
      }
    } finally {
      // Only update state if component is still mounted
      if (isMountedRef.current) {
        setIsProcessing(false);
      }
    }
  }, [isProcessing, currentQuestion, firstTeamData, gameId, removeBuzz]);

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

  // Memoize backdrop click handler to prevent unnecessary re-renders
  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isProcessing) {
      handleClose();
    }
  }, [isProcessing, handleClose]);

  // Don't render if not open or if it's a Daily Double (DailyDoubleModal handles those)
  if (!isOpen || !currentQuestion || currentQuestion.isDailyDouble) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-80 p-4"
      onClick={handleBackdropClick}
      role="presentation"
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-category"
        aria-describedby="modal-question"
        aria-busy={isProcessing}
        className="bg-gray-800 rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto"
      >
        {/* Header Section */}
        <div className="sticky top-0 bg-gray-800 border-b border-gray-700 p-6 flex items-center justify-between gap-6">
          <div className="flex-1">
            <h2 id="modal-category" className="text-2xl font-bold text-white mb-1">
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
            ref={closeButtonRef}
            onClick={handleClose}
            disabled={isProcessing}
            aria-disabled={isProcessing}
            className="text-gray-400 hover:text-white transition-colors disabled:opacity-50 flex-shrink-0"
            aria-label={isProcessing ? "Close modal (processing, please wait)" : "Close question modal"}
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
            <p id="modal-question" className="text-2xl md:text-3xl lg:text-4xl text-white font-medium leading-relaxed">
              {currentQuestion.text}
            </p>
          </div>

          {/* Screen Reader Announcements */}
          <div
            role="status"
            aria-live="assertive"
            aria-atomic="true"
            className="sr-only"
          >
            {srAnnouncement}
          </div>

          {/* Buzz Queue Section */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white">Buzz Queue</h3>
              {buzzQueue.length > 0 && (
                <button
                  onClick={() => {
                    if (window.confirm('Clear all buzzes? This cannot be undone.')) {
                      setIsClearing(true);
                      try {
                        onClearBuzzes();
                        setSrAnnouncement('All buzzes cleared from queue');
                      } finally {
                        setIsClearing(false);
                      }
                    }
                  }}
                  disabled={isProcessing || isClearing}
                  aria-disabled={isProcessing || isClearing}
                  aria-busy={isClearing}
                  className="px-3 py-1 text-sm bg-gray-600 hover:bg-gray-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800"
                  aria-label={isClearing ? 'Clearing all buzzes from queue' : `Clear all ${buzzQueue.length} buzzes from the queue`}
                >
                  {isClearing ? 'Clearing...' : 'Clear Queue'}
                </button>
              )}
            </div>
            {buzzQueue.length === 0 ? (
              <div
                className="bg-gray-700 rounded-lg p-6 text-center"
                role="status"
                aria-live="polite"
                aria-atomic="true"
              >
                <p className="text-gray-400">
                  {isProcessing
                    ? "Processing answer..."
                    : "Waiting for buzzes..."}
                </p>
                {!isProcessing && (
                  <p className="text-yellow-400 text-sm mt-3 flex items-center justify-center gap-2">
                    <span aria-hidden="true">💡</span>
                    <span>Waiting for teams to buzz in, or close this question to continue.</span>
                  </p>
                )}
              </div>
            ) : (
              <div
                className="space-y-2"
                role="list"
                aria-label={`Buzz queue with ${buzzQueue.length} ${buzzQueue.length === 1 ? 'team' : 'teams'}`}
              >
                {buzzQueueItems}
              </div>
            )}
          </div>

          {/* Teacher Controls Section */}
          <div className="flex flex-col sm:flex-row gap-4" role="group" aria-label="Question scoring controls">
            <button
              onClick={handleCorrect}
              disabled={isProcessing || buzzQueue.length === 0}
              aria-disabled={isProcessing || buzzQueue.length === 0}
              aria-busy={isProcessing}
              aria-label={
                isProcessing
                  ? 'Processing answer, please wait'
                  : buzzQueue.length === 0
                  ? 'Mark answer as correct (no teams in queue)'
                  : `Award ${currentQuestion.value} points to ${firstTeamData?.name || 'first team'} for correct answer`
              }
              className="flex-1 py-4 px-6 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold text-xl rounded-lg shadow-lg transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:ring-offset-gray-800"
            >
              {isProcessing ? 'Processing...' : '✓ Correct'}
            </button>
            <button
              onClick={handleIncorrect}
              disabled={isProcessing || buzzQueue.length === 0}
              aria-disabled={isProcessing || buzzQueue.length === 0}
              aria-busy={isProcessing}
              aria-label={
                isProcessing
                  ? 'Processing answer, please wait'
                  : buzzQueue.length === 0
                  ? 'Mark answer as incorrect (no teams in queue)'
                  : `Deduct ${currentQuestion.value} points from ${firstTeamData?.name || 'first team'} for incorrect answer`
              }
              className="flex-1 py-4 px-6 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold text-xl rounded-lg shadow-lg transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-gray-800"
            >
              {isProcessing ? 'Processing...' : '✗ Incorrect'}
            </button>
            <button
              onClick={handleClose}
              disabled={isProcessing}
              aria-disabled={isProcessing}
              aria-label={isProcessing ? 'Close modal (processing, please wait)' : 'Close question modal without scoring'}
              className="sm:flex-none px-6 py-4 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-semibold text-lg rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:ring-offset-gray-800"
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
