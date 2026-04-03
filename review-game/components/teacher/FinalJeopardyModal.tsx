/**
 * @fileoverview Final Jeopardy Modal for teacher control (RG-183).
 *
 * Manages the two-phase Final Jeopardy workflow:
 * - Wager/submission phase: Teams submit wager + answer simultaneously.
 *   Teacher can optionally reveal the question text before teams submit.
 * - Revealing phase: Teacher reveals and grades each team one at a time
 *   via a two-step card flip (click to reveal, then grade).
 *
 * @module components/teacher/FinalJeopardyModal
 */

'use client';

import React, { Fragment, useState, useEffect, useRef } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/solid';
import { useGameStore } from '@/lib/stores/gameStore';
import type { GamePhase } from '@/types/game';
import { logger } from '@/lib/logger';

interface FinalJeopardyModalProps {
  isOpen: boolean;
  gameId: string;
  onRevealQuestion: () => Promise<void>;
  onAdvancePhase: () => Promise<void>;
  onRevealTeam: (teamId: string, isCorrect: boolean) => Promise<void>;
  onFinishGame: () => Promise<void>;
  onSkip: () => Promise<void>;
}

export default function FinalJeopardyModal({
  isOpen,
  gameId,
  onRevealQuestion,
  onAdvancePhase,
  onRevealTeam,
  onFinishGame,
  onSkip,
}: FinalJeopardyModalProps) {
  const {
    currentPhase,
    finalJeopardyQuestion,
    finalJeopardyQuestionRevealed,
    allTeams,
  } = useGameStore();

  const [isProcessing, setIsProcessing] = useState(false);
  // flippedCards: cards that have been clicked to show wager+answer (local only, no API)
  const [flippedCards, setFlippedCards] = useState<Set<string>>(new Set());
  // revealedTeams: teams that have been fully graded (Correct/Incorrect clicked → API call)
  const [revealedTeams, setRevealedTeams] = useState<Set<string>>(new Set());
  const buttonRef = useRef<HTMLButtonElement>(null);
  const prevPhaseRef = useRef<GamePhase | null>(null);
  // Frozen at the moment we enter reveal phase so late-arriving team subscriptions
  // can't silently raise the denominator and prevent "Finish Game" from enabling.
  const frozenRevealTotalRef = useRef<number | null>(null);

  // Reset local state only when entering wager phase (not on every phase change)
  useEffect(() => {
    const isEnteringWagerPhase =
      isOpen &&
      currentPhase === 'final_jeopardy_wager' &&
      prevPhaseRef.current !== 'final_jeopardy_wager';

    const isEnteringRevealPhase =
      isOpen &&
      currentPhase === 'final_jeopardy_reveal' &&
      prevPhaseRef.current !== 'final_jeopardy_reveal';

    if (isEnteringWagerPhase) {
      setFlippedCards(new Set());
      setRevealedTeams(new Set());
      frozenRevealTotalRef.current = null;
    }

    if (isEnteringRevealPhase) {
      frozenRevealTotalRef.current = allTeams.length;
    }

    prevPhaseRef.current = currentPhase;
  }, [isOpen, currentPhase, allTeams.length]);

  // Get teams with submission status for the wager phase
  const teamsWithData = allTeams.map(team => ({
    ...team,
    // With combined submission, wager IS NOT NULL means both wager + answer submitted
    hasSubmitted: team.final_jeopardy_wager !== null,
  }));

  const submittedCount = teamsWithData.filter(t => t.hasSubmitted).length;
  const totalTeams = allTeams.length;

  // "Finish Game" is enabled only after all teams have been graded.
  // Use the frozen count to avoid denominator drift from late team subscriptions.
  const revealDenominator = frozenRevealTotalRef.current ?? totalTeams;
  const allGraded = currentPhase === 'final_jeopardy_reveal' && revealedTeams.size === revealDenominator;

  const handleRevealQuestion = async () => {
    setIsProcessing(true);
    try {
      await onRevealQuestion();
    } catch (error) {
      logger.error('Failed to reveal Final Jeopardy question', error, {
        operation: 'handleRevealQuestion',
        gameId,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAdvance = async () => {
    setIsProcessing(true);
    try {
      await onAdvancePhase();
    } catch (error) {
      logger.error('Failed to advance Final Jeopardy phase', error, {
        operation: 'handleAdvance',
        gameId,
        currentPhase,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFlipCard = (teamId: string) => {
    setFlippedCards(prev => new Set([...prev, teamId]));
  };

  const handleReveal = async (teamId: string, isCorrect: boolean) => {
    setIsProcessing(true);
    try {
      await onRevealTeam(teamId, isCorrect);
      setRevealedTeams(prev => new Set([...prev, teamId]));
    } catch (error) {
      logger.error('Failed to reveal team answer', error, {
        operation: 'handleReveal',
        gameId,
        teamId,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFinish = async () => {
    setIsProcessing(true);
    try {
      await onFinishGame();
    } catch (error) {
      logger.error('Failed to finish Final Jeopardy', error, {
        operation: 'handleFinish',
        gameId,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSkip = async () => {
    if (!confirm('Are you sure you want to skip Final Jeopardy? All progress will be lost.')) {
      return;
    }
    setIsProcessing(true);
    try {
      await onSkip();
    } catch (error) {
      logger.error('Failed to skip Final Jeopardy', error, {
        operation: 'handleSkip',
        gameId,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  if (!finalJeopardyQuestion) {
    return null;
  }

  return (
    <Transition show={isOpen} as={Fragment}>
      <Dialog
        as="div"
        className="relative z-50"
        onClose={() => {}}
        static
        initialFocus={buttonRef}
      >
        {/* Backdrop */}
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-blue-900/90 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-4xl transform overflow-hidden rounded-2xl bg-white shadow-2xl transition-all">
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-8 text-center">
                  <Dialog.Title className="text-4xl font-bold text-white">
                    Final Jeopardy
                  </Dialog.Title>
                  <p className="mt-2 text-xl text-blue-100">
                    Category: {finalJeopardyQuestion.category}
                  </p>
                </div>

                <div className="px-6 py-6">
                  {/* PHASE 1: Wager + Answer Submission */}
                  {currentPhase === 'final_jeopardy_wager' && (
                    <div className="space-y-6">
                      {/* Question reveal status */}
                      {finalJeopardyQuestionRevealed ? (
                        <div className="rounded-lg bg-blue-50 p-4 text-center">
                          <p className="text-sm font-medium text-blue-700">Question revealed to students</p>
                          <p className="mt-1 text-base text-gray-800 font-medium">
                            {finalJeopardyQuestion.question}
                          </p>
                        </div>
                      ) : (
                        <div className="rounded-lg bg-gray-50 border border-dashed border-gray-300 p-4 text-center">
                          <p className="text-sm text-gray-600">
                            Students see the category but not the question yet.
                          </p>
                        </div>
                      )}

                      <div className="text-center">
                        <p className="text-lg font-medium text-gray-900">
                          Teams are submitting their wager and answer...
                        </p>
                        <p className="mt-2 text-3xl font-bold text-blue-600">
                          {submittedCount} / {totalTeams} Teams Submitted
                        </p>
                      </div>

                      {/* Team Status List */}
                      <div className="grid gap-3 sm:grid-cols-2">
                        {teamsWithData.map(team => (
                          <div
                            key={team.id}
                            className={`rounded-lg border-2 px-4 py-3 ${
                              team.hasSubmitted
                                ? 'border-green-500 bg-green-50'
                                : 'border-gray-300 bg-gray-50'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-gray-900">{team.team_name}</span>
                              {team.hasSubmitted ? (
                                <CheckCircleIcon className="h-6 w-6 text-green-600" />
                              ) : (
                                <div className="h-6 w-6 rounded-full border-2 border-gray-400" />
                              )}
                            </div>
                            <p className="mt-1 text-sm text-gray-600">
                              Current Score: {team.score}
                            </p>
                          </div>
                        ))}
                      </div>

                      <div className="flex gap-3">
                        {!finalJeopardyQuestionRevealed ? (
                          <button
                            ref={buttonRef}
                            onClick={handleRevealQuestion}
                            disabled={isProcessing}
                            className="flex-1 rounded-lg bg-blue-600 px-6 py-3 text-lg font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                          >
                            {isProcessing ? 'Processing...' : 'Reveal Question'}
                          </button>
                        ) : (
                          <button
                            ref={buttonRef}
                            onClick={handleAdvance}
                            disabled={isProcessing}
                            className="flex-1 rounded-lg bg-purple-600 px-6 py-3 text-lg font-semibold text-white hover:bg-purple-700 disabled:opacity-50"
                          >
                            {isProcessing ? 'Processing...' : 'Begin Reveals'}
                          </button>
                        )}
                        <button
                          onClick={handleSkip}
                          disabled={isProcessing}
                          className="rounded-lg border-2 border-gray-300 px-6 py-3 text-lg font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                        >
                          Skip
                        </button>
                      </div>
                    </div>
                  )}

                  {/* PHASE 2: Revealing */}
                  {currentPhase === 'final_jeopardy_reveal' && (
                    <div className="space-y-6">
                      <div className="rounded-lg bg-purple-50 p-4 text-center">
                        <p className="text-lg font-medium text-gray-900">
                          Correct Answer: <span className="font-bold text-purple-600">{finalJeopardyQuestion.answer}</span>
                        </p>
                      </div>

                      {/* Team Reveal Cards — two-step: flip then grade */}
                      <div className="grid gap-4 sm:grid-cols-2">
                        {allTeams.map(team => {
                          const isFlipped = flippedCards.has(team.id);
                          const isGraded = revealedTeams.has(team.id);
                          const wager = team.final_jeopardy_wager ?? 0;
                          const answer = team.final_jeopardy_answer ?? '(No answer)';

                          return (
                            <div
                              key={team.id}
                              className={`rounded-lg border-2 p-4 transition-all ${
                                isGraded
                                  ? 'border-purple-500 bg-purple-50'
                                  : isFlipped
                                  ? 'border-blue-400 bg-blue-50'
                                  : 'border-gray-300 bg-white hover:border-purple-300 cursor-pointer'
                              }`}
                            >
                              <div className="mb-3">
                                <h3 className="text-lg font-bold text-gray-900">{team.team_name}</h3>
                                <p className="text-sm text-gray-600">Current Score: {team.score}</p>
                              </div>

                              {/* STEP 0: Unflipped — show "?" and click to flip */}
                              {!isFlipped && !isGraded && (
                                <div
                                  className="text-center cursor-pointer"
                                  onClick={() => handleFlipCard(team.id)}
                                  role="button"
                                  aria-label={`Reveal ${team.team_name}'s answer`}
                                >
                                  <p className="mb-3 text-sm font-medium text-gray-700">Click to reveal</p>
                                  <div className="h-16 rounded bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center">
                                    <span className="text-2xl font-bold text-white">?</span>
                                  </div>
                                </div>
                              )}

                              {/* STEP 1: Flipped — show wager + answer + grade buttons */}
                              {isFlipped && !isGraded && (
                                <div className="space-y-3">
                                  <div className="rounded bg-gray-100 p-3">
                                    <p className="text-xs font-medium text-gray-600">Wager</p>
                                    <p className="text-lg font-bold text-gray-900">${wager}</p>
                                  </div>
                                  <div className="rounded bg-gray-100 p-3">
                                    <p className="text-xs font-medium text-gray-600">Answer</p>
                                    <p className="text-sm text-gray-900">{answer}</p>
                                  </div>
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => handleReveal(team.id, true)}
                                      disabled={isProcessing}
                                      className="flex-1 rounded bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                      aria-label={`Mark ${team.team_name} as correct`}
                                    >
                                      <CheckCircleIcon className="inline h-4 w-4 mr-1" />
                                      Correct
                                    </button>
                                    <button
                                      onClick={() => handleReveal(team.id, false)}
                                      disabled={isProcessing}
                                      className="flex-1 rounded bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                      aria-label={`Mark ${team.team_name} as incorrect`}
                                    >
                                      <XCircleIcon className="inline h-4 w-4 mr-1" />
                                      Incorrect
                                    </button>
                                  </div>
                                </div>
                              )}

                              {/* STEP 2: Graded — show wager + answer (read-only) */}
                              {isGraded && (
                                <div className="space-y-3">
                                  <div className="rounded bg-gray-100 p-3">
                                    <p className="text-xs font-medium text-gray-600">Wager</p>
                                    <p className="text-lg font-bold text-gray-900">${wager}</p>
                                  </div>
                                  <div className="rounded bg-gray-100 p-3">
                                    <p className="text-xs font-medium text-gray-600">Answer</p>
                                    <p className="text-sm text-gray-900">{answer}</p>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {allGraded && (
                        <button
                          ref={buttonRef}
                          onClick={handleFinish}
                          disabled={isProcessing}
                          className="w-full rounded-lg bg-gradient-to-r from-green-600 to-blue-600 px-6 py-4 text-xl font-bold text-white hover:from-green-700 hover:to-blue-700 disabled:opacity-50"
                        >
                          {isProcessing ? 'Processing...' : 'Finish Game'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
