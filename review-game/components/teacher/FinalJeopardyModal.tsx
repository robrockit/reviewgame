/**
 * @fileoverview Final Jeopardy Modal for teacher control.
 *
 * Manages the three-phase Final Jeopardy workflow:
 * - Wagering phase: Teams submit wagers
 * - Answering phase: Teams submit answers (with music)
 * - Revealing phase: Teacher reveals and grades each team
 *
 * @module components/teacher/FinalJeopardyModal
 */

'use client';

import React, { Fragment, useState, useEffect, useRef } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { CheckCircleIcon, XCircleIcon, MusicalNoteIcon } from '@heroicons/react/24/solid';
import { useGameStore } from '@/lib/stores/gameStore';
import type { GamePhase, FinalJeopardyTeamStatus } from '@/types/game';
import { logger } from '@/lib/logger';

interface FinalJeopardyModalProps {
  isOpen: boolean;
  gameId: string;
  onAdvancePhase: () => Promise<void>;
  onRevealTeam: (teamId: string, isCorrect: boolean) => Promise<void>;
  onFinishGame: () => Promise<void>;
  onSkip: () => Promise<void>;
}

export default function FinalJeopardyModal({
  isOpen,
  gameId,
  onAdvancePhase,
  onRevealTeam,
  onFinishGame,
  onSkip,
}: FinalJeopardyModalProps) {
  const {
    currentPhase,
    finalJeopardyQuestion,
    allTeams,
  } = useGameStore();

  const [isProcessing, setIsProcessing] = useState(false);
  const [revealedTeams, setRevealedTeams] = useState<Set<string>>(new Set());
  const buttonRef = useRef<HTMLButtonElement>(null);
  const prevPhaseRef = useRef<GamePhase | null>(null);

  // Reset revealed teams only when entering wager phase (not on every phase change)
  useEffect(() => {
    const isEnteringWagerPhase =
      isOpen &&
      currentPhase === 'final_jeopardy_wager' &&
      prevPhaseRef.current !== 'final_jeopardy_wager';

    if (isEnteringWagerPhase) {
      setRevealedTeams(new Set());
    }

    prevPhaseRef.current = currentPhase;
  }, [isOpen, currentPhase]);

  // Get teams with Final Jeopardy data
  const teamsWithData = allTeams.map(team => ({
    ...team,
    hasSubmitted: currentPhase === 'final_jeopardy_wager'
      ? team.final_jeopardy_wager !== null
      : team.final_jeopardy_answer !== null,
  }));

  // Count submitted teams
  const submittedCount = teamsWithData.filter(t => t.hasSubmitted).length;
  const totalTeams = allTeams.length;

  // Check if all teams have been revealed
  const allRevealed = currentPhase === 'final_jeopardy_reveal' && revealedTeams.size === totalTeams;

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
                  {/* PHASE 1: Wagering */}
                  {currentPhase === 'final_jeopardy_wager' && (
                    <div className="space-y-6">
                      <div className="text-center">
                        <p className="text-lg font-medium text-gray-900">
                          Teams are placing their wagers...
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
                        <button
                          ref={buttonRef}
                          onClick={handleAdvance}
                          disabled={isProcessing}
                          className="flex-1 rounded-lg bg-blue-600 px-6 py-3 text-lg font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                        >
                          {isProcessing ? 'Processing...' : 'Advance to Answering'}
                        </button>
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

                  {/* PHASE 2: Answering */}
                  {currentPhase === 'final_jeopardy_answer' && (
                    <div className="space-y-6">
                      <div className="rounded-lg bg-blue-50 p-6 text-center">
                        <MusicalNoteIcon className="mx-auto h-16 w-16 animate-bounce text-blue-600" />
                        <p className="mt-4 text-2xl font-bold text-gray-900">
                          {finalJeopardyQuestion.question}
                        </p>
                      </div>

                      <div className="text-center">
                        <p className="text-lg font-medium text-gray-900">
                          Teams are writing their answers...
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
                                <div className="h-6 w-6 rounded-full border-2 border-gray-400 animate-pulse" />
                              )}
                            </div>
                            <p className="mt-1 text-sm text-gray-600">
                              Wager: ${team.final_jeopardy_wager || 0}
                            </p>
                          </div>
                        ))}
                      </div>

                      <button
                        ref={buttonRef}
                        onClick={handleAdvance}
                        disabled={isProcessing}
                        className="w-full rounded-lg bg-purple-600 px-6 py-3 text-lg font-semibold text-white hover:bg-purple-700 disabled:opacity-50"
                      >
                        {isProcessing ? 'Processing...' : 'Begin Reveals'}
                      </button>
                    </div>
                  )}

                  {/* PHASE 3: Revealing */}
                  {currentPhase === 'final_jeopardy_reveal' && (
                    <div className="space-y-6">
                      <div className="rounded-lg bg-purple-50 p-4 text-center">
                        <p className="text-lg font-medium text-gray-900">
                          Correct Answer: <span className="font-bold text-purple-600">{finalJeopardyQuestion.answer}</span>
                        </p>
                      </div>

                      {/* Team Reveal Cards */}
                      <div className="grid gap-4 sm:grid-cols-2">
                        {allTeams.map(team => {
                          const isRevealed = revealedTeams.has(team.id);
                          const wager = team.final_jeopardy_wager || 0;
                          const answer = team.final_jeopardy_answer || '(No answer)';

                          return (
                            <div
                              key={team.id}
                              className={`rounded-lg border-2 p-4 transition-all ${
                                isRevealed
                                  ? 'border-purple-500 bg-purple-50'
                                  : 'border-gray-300 bg-white hover:border-purple-300 cursor-pointer'
                              }`}
                            >
                              <div className="mb-3">
                                <h3 className="text-lg font-bold text-gray-900">{team.team_name}</h3>
                                <p className="text-sm text-gray-600">Current Score: {team.score}</p>
                              </div>

                              {!isRevealed ? (
                                <div className="text-center">
                                  <p className="mb-3 text-sm font-medium text-gray-700">Click to reveal</p>
                                  <div className="h-16 rounded bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center">
                                    <span className="text-2xl font-bold text-white">?</span>
                                  </div>
                                </div>
                              ) : (
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

                              {!isRevealed && (
                                <div className="mt-4 flex gap-2">
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
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {allRevealed && (
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
