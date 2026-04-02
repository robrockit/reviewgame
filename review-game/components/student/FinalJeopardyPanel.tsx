/**
 * @fileoverview Final Jeopardy panel for student team view.
 *
 * Provides interface for teams to:
 * - Submit wager AND answer together during wagering phase (question revealed progressively)
 * - View results during reveal phase
 *
 * @module components/student/FinalJeopardyPanel
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useGameStore } from '@/lib/stores/gameStore';
import { logger } from '@/lib/logger';
import { CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/solid';
import { getDeviceId } from '@/hooks/useDeviceId';

interface FinalJeopardyPanelProps {
  gameId: string;
  teamId: string;
  teamName: string;
  currentScore: number;
}

export default function FinalJeopardyPanel({
  gameId,
  teamId,
  teamName,
  currentScore,
}: FinalJeopardyPanelProps) {
  const {
    currentPhase,
    finalJeopardyQuestion,
    finalJeopardyTeamStatuses,
    finalJeopardyQuestionRevealed,
  } = useGameStore();

  const [wagerInput, setWagerInput] = useState('');
  const [wagerError, setWagerError] = useState<string | null>(null);
  const [answerInput, setAnswerInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  // Captured on successful submit so reveal phase can display them after inputs clear
  const [submittedWager, setSubmittedWager] = useState<number | null>(null);
  const [submittedAnswer, setSubmittedAnswer] = useState<string | null>(null);

  // Get team status from store
  const teamStatus = finalJeopardyTeamStatuses[teamId];

  // Max wager is the greater of current score or 0
  const maxWager = Math.max(currentScore, 0);

  // Reset state when entering wager phase
  useEffect(() => {
    if (currentPhase === 'final_jeopardy_wager') {
      setHasSubmitted(false);
      setSubmittedWager(null);
      setSubmittedAnswer(null);
      setWagerInput('');
      setAnswerInput('');
      setWagerError(null);
    }
  }, [currentPhase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setWagerError(null);

    const wager = parseInt(wagerInput, 10);

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

    if (!answerInput.trim()) {
      return;
    }

    setIsSubmitting(true);
    try {
      const deviceId = getDeviceId();
      if (!deviceId) {
        throw new Error('Device ID not available');
      }

      const response = await fetch(`/api/games/${gameId}/final-jeopardy/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Device-ID': deviceId,
        },
        body: JSON.stringify({
          teamId,
          wager,
          answer: answerInput.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit');
      }

      setSubmittedWager(wager);
      setSubmittedAnswer(answerInput.trim());
      setHasSubmitted(true);
      logger.info('Final Jeopardy wager and answer submitted', {
        operation: 'handleFinalJeopardySubmit',
        gameId,
        teamId,
        wager,
      });
    } catch (error) {
      logger.error('Failed to submit Final Jeopardy response', error, {
        operation: 'handleFinalJeopardySubmit',
        gameId,
        teamId,
      });
      setWagerError(
        error instanceof Error ? error.message : 'Failed to submit. Please try again.'
      );
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

        {/* PHASE 1: Wager + Answer (combined) */}
        {currentPhase === 'final_jeopardy_wager' && (
          <div className="space-y-4">
            {/* Question text — shown only after teacher reveals it */}
            {finalJeopardyQuestionRevealed ? (
              <div className="rounded-lg bg-blue-50 p-4">
                <p className="text-center text-lg font-bold text-gray-900">
                  {finalJeopardyQuestion.question}
                </p>
              </div>
            ) : (
              <div className="rounded-lg border-2 border-dashed border-gray-300 p-4 text-center">
                <p className="text-gray-500 italic">The question will be revealed soon...</p>
              </div>
            )}

            {!hasSubmitted ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Wager input */}
                <div>
                  <label htmlFor="wager" className="block text-sm font-medium text-gray-700">
                    Your Wager
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
                    aria-describedby="wager-hint"
                    aria-invalid={!!wagerError}
                  />
                  {wagerError && (
                    <p className="mt-2 text-sm text-red-600">{wagerError}</p>
                  )}
                </div>

                {/* Answer input */}
                <div>
                  <label htmlFor="answer" className="block text-sm font-medium text-gray-700">
                    Your Answer
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
                    aria-label="Your Final Jeopardy answer"
                    aria-describedby="answer-char-count"
                  />
                  <p id="answer-char-count" className="mt-1 text-xs text-gray-500">
                    {answerInput.length} / 500 characters
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting || !wagerInput || !answerInput.trim()}
                  className="w-full rounded-lg bg-purple-600 px-6 py-4 text-xl font-bold text-white hover:bg-purple-700 disabled:opacity-50"
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Wager & Answer'}
                </button>
              </form>
            ) : (
              <div className="rounded-lg bg-green-50 p-6 text-center">
                <CheckCircleIcon className="mx-auto h-16 w-16 text-green-600" />
                <p className="mt-4 text-xl font-bold text-gray-900">Submitted!</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 text-left">
                  <div className="rounded-lg bg-white p-3 border border-gray-200">
                    <p className="text-xs text-gray-500">Your Wager</p>
                    <p className="mt-1 text-lg font-bold text-green-600">${submittedWager}</p>
                  </div>
                  <div className="rounded-lg bg-white p-3 border border-gray-200">
                    <p className="text-xs text-gray-500">Your Answer</p>
                    <p className="mt-1 text-sm font-medium text-gray-900">{submittedAnswer}</p>
                  </div>
                </div>
                <p className="mt-4 text-sm text-gray-500">
                  Waiting for teacher to begin reveals...
                </p>
              </div>
            )}
          </div>
        )}

        {/* PHASE 2: Reveal */}
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
                  <p className="text-2xl font-bold text-gray-900">
                    ${submittedWager ?? 0}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Your Answer</p>
                  <p className="text-lg font-medium text-gray-900">
                    {submittedAnswer ?? '(No answer)'}
                  </p>
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
                      <p className="mt-1 text-lg text-green-700">+${submittedWager ?? 0}</p>
                    </>
                  ) : (
                    <>
                      <XCircleIcon className="mx-auto h-12 w-12 text-red-600" />
                      <p className="mt-2 text-xl font-bold text-red-900">Incorrect</p>
                      <p className="mt-1 text-lg text-red-700">-${submittedWager ?? 0}</p>
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
