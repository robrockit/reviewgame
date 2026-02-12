/**
 * @fileoverview Final Jeopardy panel for student team view.
 *
 * Provides interface for teams to:
 * - Submit wagers during wagering phase
 * - Submit answers during answering phase
 * - View results during reveal phase
 *
 * @module components/student/FinalJeopardyPanel
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useGameStore } from '@/lib/stores/gameStore';
import { logger } from '@/lib/logger';
import { CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/solid';

interface FinalJeopardyPanelProps {
  gameId: string;
  teamId: string;
  teamName: string;
  currentScore: number;
  onSubmitWager: (wager: number) => Promise<void>;
  onSubmitAnswer: (answer: string) => Promise<void>;
}

export default function FinalJeopardyPanel({
  gameId,
  teamId,
  teamName,
  currentScore,
  onSubmitWager,
  onSubmitAnswer,
}: FinalJeopardyPanelProps) {
  const { currentPhase, finalJeopardyQuestion, finalJeopardyTeamStatuses } = useGameStore();

  const [wagerInput, setWagerInput] = useState('');
  const [wagerError, setWagerError] = useState<string | null>(null);
  const [answerInput, setAnswerInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasSubmittedWager, setHasSubmittedWager] = useState(false);
  const [hasSubmittedAnswer, setHasSubmittedAnswer] = useState(false);

  // Get team status from store
  const teamStatus = finalJeopardyTeamStatuses[teamId];

  // Max wager is the greater of current score or 0
  const maxWager = Math.max(currentScore, 0);

  // Reset state when phase changes
  useEffect(() => {
    if (currentPhase === 'final_jeopardy_wager') {
      setHasSubmittedWager(false);
      setHasSubmittedAnswer(false);
      setWagerInput('');
      setAnswerInput('');
      setWagerError(null);
    }
  }, [currentPhase]);

  const handleWagerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setWagerError(null);

    const wager = parseInt(wagerInput, 10);

    // Validate wager
    if (isNaN(wager)) {
      setWagerError('Please enter a valid number');
      return;
    }

    if (wager < 0) {
      setWagerError('Wager cannot be negative');
      return;
    }

    if (wager > maxWager) {
      setWagerError(`Wager cannot exceed ${maxWager}`);
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmitWager(wager);
      setHasSubmittedWager(true);
    } catch (error) {
      logger.error('Failed to submit wager', error, {
        operation: 'handleWagerSubmit',
        gameId,
        teamId,
        wager,
      });
      setWagerError('Failed to submit wager. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAnswerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!answerInput.trim()) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmitAnswer(answerInput.trim());
      setHasSubmittedAnswer(true);
    } catch (error) {
      logger.error('Failed to submit answer', error, {
        operation: 'handleAnswerSubmit',
        gameId,
        teamId,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Don't render if not in a Final Jeopardy phase
  if (!currentPhase || currentPhase === 'regular' || !finalJeopardyQuestion) {
    return null;
  }

  return (
    <div className="mx-auto max-w-2xl rounded-lg bg-gradient-to-br from-blue-600 to-purple-600 p-1 shadow-2xl">
      <div className="rounded-lg bg-white p-6">
        {/* Header */}
        <div className="mb-6 text-center">
          <h2 className="text-3xl font-bold text-gray-900">Final Jeopardy</h2>
          <p className="mt-2 text-xl font-medium text-blue-600">
            {finalJeopardyQuestion.category}
          </p>
          <div className="mt-4 flex items-center justify-center gap-6">
            <div>
              <p className="text-sm text-gray-600">Team</p>
              <p className="text-lg font-bold text-gray-900">{teamName}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Current Score</p>
              <p className="text-lg font-bold text-gray-900">{currentScore}</p>
            </div>
          </div>
        </div>

        {/* PHASE 1: Wagering */}
        {currentPhase === 'final_jeopardy_wager' && (
          <div className="space-y-4">
            {!hasSubmittedWager ? (
              <form onSubmit={handleWagerSubmit} className="space-y-4">
                <div>
                  <label htmlFor="wager" className="block text-sm font-medium text-gray-700">
                    How much do you want to wager?
                  </label>
                  <p id="wager-hint" className="mt-1 text-xs text-gray-500">
                    You can wager from $0 to ${maxWager}
                  </p>
                  <input
                    type="number"
                    id="wager"
                    value={wagerInput}
                    onChange={(e) => setWagerInput(e.target.value)}
                    min="0"
                    max={maxWager}
                    className="mt-2 block w-full rounded-lg border-2 border-gray-300 px-4 py-3 text-xl font-bold focus:border-blue-500 focus:outline-none"
                    placeholder="Enter wager amount"
                    disabled={isSubmitting}
                    autoFocus
                    aria-describedby="wager-hint"
                    aria-invalid={!!wagerError}
                  />
                  {wagerError && (
                    <p className="mt-2 text-sm text-red-600">{wagerError}</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting || !wagerInput}
                  className="w-full rounded-lg bg-blue-600 px-6 py-4 text-xl font-bold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Wager'}
                </button>
              </form>
            ) : (
              <div className="rounded-lg bg-green-50 p-6 text-center">
                <CheckCircleIcon className="mx-auto h-16 w-16 text-green-600" />
                <p className="mt-4 text-xl font-bold text-gray-900">Wager Submitted!</p>
                <p className="mt-2 text-lg text-gray-600">
                  You wagered: <span className="font-bold text-green-600">${wagerInput}</span>
                </p>
                <p className="mt-4 text-sm text-gray-500">
                  Waiting for other teams to submit their wagers...
                </p>
              </div>
            )}
          </div>
        )}

        {/* PHASE 2: Answering */}
        {currentPhase === 'final_jeopardy_answer' && (
          <div className="space-y-4">
            <div className="rounded-lg bg-blue-50 p-6">
              <p className="text-center text-xl font-bold text-gray-900">
                {finalJeopardyQuestion.question}
              </p>
            </div>

            <div className="rounded-lg bg-purple-50 p-4">
              <p className="text-sm text-gray-600">Your Wager</p>
              <p className="text-2xl font-bold text-purple-600">${wagerInput || 0}</p>
            </div>

            {!hasSubmittedAnswer ? (
              <form onSubmit={handleAnswerSubmit} className="space-y-4">
                <div>
                  <label htmlFor="answer" className="block text-sm font-medium text-gray-700">
                    What is your answer?
                  </label>
                  <textarea
                    id="answer"
                    value={answerInput}
                    onChange={(e) => setAnswerInput(e.target.value)}
                    maxLength={500}
                    rows={4}
                    className="mt-2 block w-full rounded-lg border-2 border-gray-300 px-4 py-3 text-lg focus:border-purple-500 focus:outline-none"
                    placeholder="Type your answer here..."
                    disabled={isSubmitting}
                    autoFocus
                    aria-label="Your Final Jeopardy answer"
                    aria-describedby="answer-char-count"
                  />
                  <p id="answer-char-count" className="mt-1 text-xs text-gray-500">
                    {answerInput.length} / 500 characters
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting || !answerInput.trim()}
                  className="w-full rounded-lg bg-purple-600 px-6 py-4 text-xl font-bold text-white hover:bg-purple-700 disabled:opacity-50"
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Answer'}
                </button>
              </form>
            ) : (
              <div className="rounded-lg bg-green-50 p-6 text-center">
                <CheckCircleIcon className="mx-auto h-16 w-16 text-green-600" />
                <p className="mt-4 text-xl font-bold text-gray-900">Answer Submitted!</p>
                <div className="mt-4 rounded-lg bg-white p-4">
                  <p className="text-sm text-gray-600">Your Answer</p>
                  <p className="mt-1 text-lg font-medium text-gray-900">{answerInput}</p>
                </div>
                <p className="mt-4 text-sm text-gray-500">
                  Waiting for results...
                </p>
              </div>
            )}
          </div>
        )}

        {/* PHASE 3: Reveal */}
        {currentPhase === 'final_jeopardy_reveal' && (
          <div className="space-y-4">
            <div className="rounded-lg bg-purple-50 p-4 text-center">
              <p className="text-sm font-medium text-gray-600">Correct Answer</p>
              <p className="mt-1 text-xl font-bold text-purple-600">
                {finalJeopardyQuestion.answer}
              </p>
            </div>

            <div className="rounded-lg border-2 border-gray-300 p-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-sm text-gray-600">Your Wager</p>
                  <p className="text-2xl font-bold text-gray-900">${wagerInput || 0}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Your Answer</p>
                  <p className="text-lg font-medium text-gray-900">{answerInput || '(No answer)'}</p>
                </div>
              </div>

              {teamStatus?.revealed && (
                <div className={`mt-6 rounded-lg p-4 text-center ${
                  teamStatus.isCorrect ? 'bg-green-50' : 'bg-red-50'
                }`}>
                  {teamStatus.isCorrect ? (
                    <>
                      <CheckCircleIcon className="mx-auto h-12 w-12 text-green-600" />
                      <p className="mt-2 text-xl font-bold text-green-900">Correct!</p>
                      <p className="mt-1 text-lg text-green-700">+${wagerInput || 0}</p>
                    </>
                  ) : (
                    <>
                      <XCircleIcon className="mx-auto h-12 w-12 text-red-600" />
                      <p className="mt-2 text-xl font-bold text-red-900">Incorrect</p>
                      <p className="mt-1 text-lg text-red-700">-${wagerInput || 0}</p>
                    </>
                  )}
                  <div className="mt-4 pt-4 border-t border-gray-300">
                    <p className="text-sm text-gray-600">New Score</p>
                    <p className="text-3xl font-bold text-gray-900">{teamStatus.currentScore}</p>
                  </div>
                </div>
              )}

              {!teamStatus?.revealed && (
                <div className="mt-6 rounded-lg bg-gray-50 p-4 text-center">
                  <p className="text-lg font-medium text-gray-600">
                    Waiting for teacher to reveal results...
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
