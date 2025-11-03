"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useGameStore } from '../../lib/stores/gameStore';
import { createClient } from '@/lib/supabase/client';

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
  } = useGameStore();

  const [isProcessing, setIsProcessing] = useState(false);
  const supabase = createClient();

  // Modal is open when currentQuestion is not null
  const isOpen = currentQuestion !== null;

  // Get the first team in the buzz queue
  const firstBuzzTeam = buzzQueue.length > 0 ? buzzQueue[0] : null;
  const firstTeamData = firstBuzzTeam
    ? allTeams.find(team => team.id === firstBuzzTeam.teamId)
    : null;

  // Find the category name for the current question
  const getCategoryName = (): string => {
    // This will be improved once we have category context
    // For now, return a placeholder
    return 'Category';
  };

  // Close modal handler
  const handleClose = useCallback(() => {
    if (isProcessing) return;
    setCurrentQuestion(null);
    clearBuzzQueue();
  }, [isProcessing, setCurrentQuestion, clearBuzzQueue]);

  // Handle correct answer
  const handleCorrect = async () => {
    if (isProcessing || !currentQuestion || !firstBuzzTeam || !firstTeamData) return;

    setIsProcessing(true);
    try {
      // Award points to the first team in the buzz queue
      const newScore = firstTeamData.score + currentQuestion.value;

      // Update the team score in the database
      const { error } = await supabase
        .from('teams')
        .update({ score: newScore })
        .eq('id', firstTeamData.id);

      if (error) {
        console.error('Error updating team score:', error);
        throw error;
      }

      // Update the game's selected_questions array
      const { data: gameData, error: gameError } = await supabase
        .from('games')
        .select('selected_questions')
        .eq('id', gameId)
        .single();

      if (gameError) throw gameError;

      const selectedQuestions = gameData.selected_questions || [];
      if (!selectedQuestions.includes(currentQuestion.id)) {
        const { error: updateError } = await supabase
          .from('games')
          .update({
            selected_questions: [...selectedQuestions, currentQuestion.id]
          })
          .eq('id', gameId);

        if (updateError) throw updateError;
      }

      // Clear buzz queue and close modal
      clearBuzzQueue();
      setCurrentQuestion(null);
    } catch (error) {
      console.error('Error handling correct answer:', error);
      alert('Failed to update score. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle incorrect answer
  const handleIncorrect = async () => {
    if (isProcessing || !currentQuestion || !firstBuzzTeam || !firstTeamData) return;

    setIsProcessing(true);
    try {
      // Deduct points from the first team in the buzz queue
      const newScore = firstTeamData.score - currentQuestion.value;

      // Update the team score in the database
      const { error } = await supabase
        .from('teams')
        .update({ score: newScore })
        .eq('id', firstTeamData.id);

      if (error) {
        console.error('Error updating team score:', error);
        throw error;
      }

      // Remove the first team from the buzz queue
      removeBuzz(firstTeamData.id);

      // If no more teams in queue after removal, modal stays open
      // Teacher can close manually or wait for more buzzes

    } catch (error) {
      console.error('Error handling incorrect answer:', error);
      alert('Failed to update score. Please try again.');
    } finally {
      setIsProcessing(false);
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

  // Don't render if not open
  if (!isOpen || !currentQuestion) return null;

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
        <div className="sticky top-0 bg-gray-800 border-b border-gray-700 p-6 flex items-center justify-between">
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-white mb-1">
              {getCategoryName()}
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
          <button
            onClick={handleClose}
            disabled={isProcessing}
            className="text-gray-400 hover:text-white transition-colors disabled:opacity-50"
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
            <h3 className="text-xl font-bold text-white mb-4">Buzz Queue</h3>
            {buzzQueue.length === 0 ? (
              <div className="bg-gray-700 rounded-lg p-6 text-center">
                <p className="text-gray-400">No teams have buzzed in yet...</p>
              </div>
            ) : (
              <div className="space-y-2">
                {buzzQueue.map((buzz, index) => {
                  const team = allTeams.find(t => t.id === buzz.teamId);
                  const isFirst = index === 0;

                  return (
                    <div
                      key={`${buzz.teamId}-${buzz.timestamp}`}
                      className={`p-4 rounded-lg flex items-center justify-between transition-all ${
                        isFirst
                          ? 'bg-yellow-600 border-2 border-yellow-400 shadow-lg'
                          : 'bg-gray-700'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`text-lg font-bold ${
                          isFirst ? 'text-white' : 'text-gray-400'
                        }`}>
                          {index === 0 ? '1st' : index === 1 ? '2nd' : index === 2 ? '3rd' : `${index + 1}th`}
                        </span>
                        <span className={`text-lg font-semibold ${
                          isFirst ? 'text-white' : 'text-gray-300'
                        }`}>
                          {team?.name || 'Unknown Team'}
                        </span>
                        {isFirst && (
                          <span className="ml-2 px-2 py-1 bg-white bg-opacity-20 text-white text-xs font-bold rounded">
                            ANSWERING
                          </span>
                        )}
                      </div>
                      <div className={`text-sm ${
                        isFirst ? 'text-yellow-100' : 'text-gray-400'
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
