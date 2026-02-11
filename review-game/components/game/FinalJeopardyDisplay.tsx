/**
 * @fileoverview Final Jeopardy display for game board view.
 *
 * Shows appropriate content for each Final Jeopardy phase on the main game board.
 * Designed to be displayed on a projector/screen for the whole class.
 *
 * @module components/game/FinalJeopardyDisplay
 */

'use client';

import React from 'react';
import { useGameStore } from '@/lib/stores/gameStore';
import { MusicalNoteIcon, TrophyIcon } from '@heroicons/react/24/solid';

export default function FinalJeopardyDisplay() {
  const { currentPhase, finalJeopardyQuestion, allTeams, finalJeopardyTeamStatuses } = useGameStore();

  // Don't render if not in a Final Jeopardy phase
  if (!currentPhase || currentPhase === 'regular' || !finalJeopardyQuestion) {
    return null;
  }

  return (
    <div className="flex h-screen items-center justify-center bg-gradient-to-br from-blue-900 via-purple-900 to-blue-900 p-8">
      <div className="w-full max-w-6xl">
        {/* PHASE 1: Wagering */}
        {currentPhase === 'final_jeopardy_wager' && (
          <div className="text-center">
            <div className="animate-pulse">
              <h1 className="text-8xl font-bold text-white drop-shadow-2xl">
                Final Jeopardy
              </h1>
            </div>
            <div className="mt-12 rounded-2xl bg-white/10 backdrop-blur-lg p-12">
              <p className="text-3xl font-medium text-blue-200">Category</p>
              <p className="mt-4 text-7xl font-bold text-white">
                {finalJeopardyQuestion.category}
              </p>
            </div>
            <div className="mt-12">
              <p className="text-4xl font-medium text-purple-200 animate-pulse">
                Teams are placing their wagers...
              </p>
            </div>
          </div>
        )}

        {/* PHASE 2: Answering */}
        {currentPhase === 'final_jeopardy_answer' && (
          <div className="text-center">
            <div className="mb-8">
              <MusicalNoteIcon className="mx-auto h-24 w-24 animate-bounce text-yellow-400" />
            </div>
            <div className="rounded-2xl bg-white/10 backdrop-blur-lg p-8">
              <p className="text-2xl font-medium text-blue-200 mb-4">
                {finalJeopardyQuestion.category}
              </p>
              <p className="text-5xl font-bold text-white leading-tight">
                {finalJeopardyQuestion.question}
              </p>
            </div>
            <div className="mt-12 grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-4">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((note) => (
                <div
                  key={note}
                  className="animate-bounce text-6xl"
                  style={{
                    animationDelay: `${note * 0.1}s`,
                    animationDuration: '1.5s',
                  }}
                >
                  ♪
                </div>
              ))}
            </div>
          </div>
        )}

        {/* PHASE 3: Revealing */}
        {currentPhase === 'final_jeopardy_reveal' && (
          <div className="space-y-8">
            <div className="text-center">
              <h1 className="text-6xl font-bold text-white drop-shadow-2xl">
                Final Jeopardy Results
              </h1>
              <div className="mt-6 rounded-xl bg-white/10 backdrop-blur-lg p-6">
                <p className="text-xl font-medium text-blue-200">Correct Answer</p>
                <p className="mt-2 text-4xl font-bold text-yellow-400">
                  {finalJeopardyQuestion.answer}
                </p>
              </div>
            </div>

            {/* Team Scores */}
            <div className="grid gap-4 md:grid-cols-2">
              {allTeams
                .slice()
                .sort((a, b) => b.score - a.score)
                .map((team, index) => {
                  const status = finalJeopardyTeamStatuses[team.id];
                  const isRevealed = status?.revealed;
                  const isWinner = index === 0 && isRevealed;

                  return (
                    <div
                      key={team.id}
                      className={`rounded-xl p-6 transition-all ${
                        isRevealed
                          ? isWinner
                            ? 'bg-gradient-to-r from-yellow-500 to-yellow-600 ring-4 ring-yellow-300'
                            : status?.isCorrect
                            ? 'bg-gradient-to-r from-green-600 to-green-700'
                            : 'bg-gradient-to-r from-red-600 to-red-700'
                          : 'bg-white/10 backdrop-blur-lg'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            {isWinner && (
                              <TrophyIcon className="h-8 w-8 text-white" />
                            )}
                            <h3 className="text-2xl font-bold text-white">
                              {team.team_name}
                            </h3>
                          </div>
                          {isRevealed && (
                            <p className="mt-2 text-lg text-white/80">
                              Wager: ${team.final_jeopardy_wager || 0} •{' '}
                              {status?.isCorrect ? 'Correct ✓' : 'Incorrect ✗'}
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-5xl font-bold text-white">
                            {team.score}
                          </p>
                          {isWinner && (
                            <p className="mt-1 text-sm font-medium text-white/90">
                              WINNER
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
