/**
 * @fileoverview Game Complete Celebration Modal component.
 *
 * Displays final scores and winner when all questions have been answered.
 * Provides options to return to dashboard or play again with the same teams.
 *
 * @module components/teacher/GameCompleteModal
 */

'use client';

import React, { Fragment, useRef } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { TrophyIcon } from '@heroicons/react/24/solid';

/**
 * Team score data for final results display.
 */
interface TeamScore {
  teamId: string;
  teamName: string;
  score: number;
  rank: number;
}

/**
 * Props for the GameCompleteModal component.
 */
interface GameCompleteModalProps {
  /**
   * Whether the modal is open.
   */
  isOpen: boolean;
  /**
   * Array of team scores sorted by rank.
   */
  finalScores: TeamScore[];
  /**
   * Callback to return to dashboard.
   */
  onReturnToDashboard: () => void;
  /**
   * Callback to reset game and play again.
   */
  onPlayAgain: () => void;
}

/**
 * Game Complete Celebration Modal.
 *
 * Auto-opens when all questions are answered. Displays final scores
 * with the winner highlighted. Provides options to return to dashboard
 * or play again with the same teams.
 *
 * Features:
 * - Celebration animation with trophy icon
 * - Winner highlighted in gold
 * - Scores sorted by rank
 * - Cannot dismiss accidentally (no ESC or outside click)
 * - Mobile responsive
 * - Accessible with ARIA labels
 */
export default function GameCompleteModal({
  isOpen,
  finalScores,
  onReturnToDashboard,
  onPlayAgain,
}: GameCompleteModalProps) {
  // Ref for focus management
  const returnButtonRef = useRef<HTMLButtonElement>(null);

  // Get the winning team (rank 1)
  const winner = finalScores.find(team => team.rank === 1);

  // Handle edge case: no teams available
  if (finalScores.length === 0) {
    return (
      <Transition show={isOpen} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-50"
          onClose={() => {}}
          static
          initialFocus={returnButtonRef}
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
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
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
                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 shadow-2xl transition-all">
                  <Dialog.Title
                    as="h2"
                    className="text-2xl font-bold text-gray-900 mb-4"
                  >
                    Game Complete
                  </Dialog.Title>
                  <p className="text-gray-700 mb-6">
                    The game has ended, but no team data is available. Please contact support if this issue persists.
                  </p>
                  <button
                    ref={returnButtonRef}
                    type="button"
                    onClick={onReturnToDashboard}
                    className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    aria-label="Return to dashboard"
                  >
                    Return to Dashboard
                  </button>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    );
  }

  return (
    <Transition show={isOpen} as={Fragment}>
      <Dialog
        as="div"
        className="relative z-50"
        onClose={() => {}} // Empty function prevents closing on outside click
        static // Prevents ESC key from closing
        initialFocus={returnButtonRef} // Focus management for accessibility
      >
        {/* Backdrop with celebration gradient */}
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-gradient-to-br from-amber-500/20 via-yellow-500/20 to-orange-500/20 backdrop-blur-sm" />
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
              <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-2xl bg-white shadow-2xl transition-all">
                {/* Header with celebration theme */}
                <div className="bg-gradient-to-r from-amber-400 via-yellow-400 to-orange-400 px-6 py-8 text-center">
                  <div className="flex justify-center mb-4">
                    <TrophyIcon className="h-20 w-20 text-yellow-600 animate-bounce" aria-hidden="true" />
                  </div>
                  <Dialog.Title
                    as="h2"
                    className="text-4xl font-bold text-gray-900"
                  >
                    🎉 Game Complete! 🎉
                  </Dialog.Title>
                </div>

                {/* Final Scores Section */}
                <div className="px-6 py-6">
                  <h3 className="text-2xl font-semibold text-gray-900 mb-6 text-center">
                    Final Scores
                  </h3>

                  <div className="space-y-3">
                    {finalScores.map((team) => {
                      const isWinner = team.rank === 1;

                      return (
                        <div
                          key={team.teamId}
                          className={`
                            flex items-center justify-between rounded-lg p-4 transition-all
                            ${isWinner
                              ? 'bg-gradient-to-r from-amber-100 via-yellow-100 to-amber-100 border-2 border-yellow-400 shadow-lg scale-105'
                              : 'bg-gray-50 border border-gray-200'
                            }
                          `}
                        >
                          {/* Rank and Team Name */}
                          <div className="flex items-center space-x-4">
                            <span
                              className={`
                                flex items-center justify-center w-10 h-10 rounded-full font-bold
                                ${isWinner
                                  ? 'bg-yellow-500 text-white text-2xl'
                                  : 'bg-gray-300 text-gray-700 text-lg'
                                }
                              `}
                            >
                              {team.rank}
                            </span>
                            <span
                              className={`
                                font-semibold
                                ${isWinner
                                  ? 'text-2xl text-gray-900'
                                  : 'text-lg text-gray-800'
                                }
                              `}
                            >
                              {team.teamName}
                            </span>
                          </div>

                          {/* Score and Trophy */}
                          <div className="flex items-center space-x-3">
                            <span
                              className={`
                                font-bold
                                ${isWinner
                                  ? 'text-3xl text-amber-600'
                                  : 'text-xl text-gray-700'
                                }
                              `}
                            >
                              {team.score.toLocaleString()} points
                            </span>
                            {isWinner && (
                              <TrophyIcon
                                className="h-8 w-8 text-yellow-500"
                                aria-label="Winner"
                              />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Winner Announcement */}
                  {winner && (
                    <div className="mt-6 text-center">
                      <p className="text-xl font-semibold text-gray-700">
                        Congratulations to{' '}
                        <span className="text-amber-600 font-bold text-2xl">
                          {winner.teamName}
                        </span>
                        !
                      </p>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="bg-gray-50 px-6 py-4 flex flex-col sm:flex-row justify-center gap-3">
                  <button
                    ref={returnButtonRef}
                    type="button"
                    onClick={onReturnToDashboard}
                    className="w-full sm:w-auto px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    aria-label="Return to dashboard"
                  >
                    Return to Dashboard
                  </button>
                  <button
                    type="button"
                    onClick={onPlayAgain}
                    className="w-full sm:w-auto px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white font-semibold rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                    aria-label="Play again with same teams"
                  >
                    Play Again
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
