'use client';

import { useState, useRef } from 'react';
import { Dialog, DialogPanel, DialogTitle, Transition, TransitionChild } from '@headlessui/react';
import type { Team } from '@/types/game';
import type { ScoreOverrideRequest, ScoreOverrideResponse } from '@/types/game.types';
import { SCORE_OVERRIDE_MAX_DELTA } from '@/types/game.types';

const PRESETS = [200, 400, 600, 800, 1000] as const;

interface ScoreAdjustModalProps {
  isOpen: boolean;
  onClose: () => void;
  team: Pick<Team, 'id' | 'name' | 'score'>;
  gameId: string;
  onScoreUpdated: (teamId: string, newScore: number) => void;
}

export default function ScoreAdjustModal({
  isOpen,
  onClose,
  team,
  gameId,
  onScoreUpdated,
}: ScoreAdjustModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customValue, setCustomValue] = useState('');
  const [showCustom, setShowCustom] = useState(false);
  const inFlightRef = useRef(false);

  const resetState = () => {
    setError(null);
    setCustomValue('');
    setShowCustom(false);
  };

  const handleClose = () => {
    if (!isSubmitting) {
      resetState();
      onClose();
    }
  };

  const applyDelta = async (delta: number) => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setIsSubmitting(true);
    setError(null);

    let succeeded = false;
    let newScore = 0;

    try {
      const payload: ScoreOverrideRequest = { teamId: team.id, delta };
      const res = await fetch(`/api/games/${gameId}/teacher-score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = (await res.json()) as ScoreOverrideResponse | { error: string };

      if (!res.ok) {
        setError('error' in data ? data.error : 'Failed to update score');
        return;
      }

      newScore = (data as ScoreOverrideResponse).newScore;
      succeeded = true;
    } catch {
      setError('Network error — please try again');
    } finally {
      inFlightRef.current = false;
      setIsSubmitting(false);
      if (succeeded) {
        try {
          onScoreUpdated(team.id, newScore);
        } finally {
          resetState();
          onClose();
        }
      }
    }
  };

  const handleCustomApply = () => {
    const parsed = parseInt(customValue, 10);
    if (isNaN(parsed) || parsed === 0) {
      setError('Enter a non-zero whole number');
      return;
    }
    if (Math.abs(parsed) > SCORE_OVERRIDE_MAX_DELTA) {
      setError(`Value must be between -${SCORE_OVERRIDE_MAX_DELTA.toLocaleString()} and ${SCORE_OVERRIDE_MAX_DELTA.toLocaleString()}`);
      return;
    }
    void applyDelta(parsed);
  };

  return (
    <Transition appear show={isOpen}>
      <Dialog onClose={handleClose} className="relative z-50">
        {/* Backdrop */}
        <TransitionChild
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/70" aria-hidden="true" />
        </TransitionChild>

        {/* Panel */}
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <TransitionChild
            enter="ease-out duration-200"
            enterFrom="opacity-0 scale-95"
            enterTo="opacity-100 scale-100"
            leave="ease-in duration-150"
            leaveFrom="opacity-100 scale-100"
            leaveTo="opacity-0 scale-95"
          >
            <DialogPanel className="w-full max-w-md bg-gray-800 rounded-xl shadow-2xl border border-gray-700 p-6">
              {/* Header */}
              <DialogTitle className="text-xl font-bold text-white mb-1">
                Adjust Score
              </DialogTitle>
              <p className="text-sm text-gray-400 mb-5">
                {team.name} &mdash; Current:{' '}
                <span className={`font-semibold ${team.score < 0 ? 'text-red-300' : 'text-white'}`}>
                  {team.score}
                </span>
              </p>

              {/* Award presets */}
              <p className="text-xs text-green-400 font-semibold uppercase tracking-wider mb-2">
                Award Points
              </p>
              <div className="flex gap-2 flex-wrap mb-4">
                {PRESETS.map((val) => (
                  <button
                    key={`award-${val}`}
                    onClick={() => void applyDelta(val)}
                    disabled={isSubmitting}
                    className="flex-1 min-w-[56px] px-2 py-2 bg-green-700 hover:bg-green-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors"
                  >
                    +{val}
                  </button>
                ))}
              </div>

              {/* Deduct presets */}
              <p className="text-xs text-red-400 font-semibold uppercase tracking-wider mb-2">
                Deduct Points
              </p>
              <div className="flex gap-2 flex-wrap mb-4">
                {PRESETS.map((val) => (
                  <button
                    key={`deduct-${val}`}
                    onClick={() => void applyDelta(-val)}
                    disabled={isSubmitting}
                    className="flex-1 min-w-[56px] px-2 py-2 bg-red-800 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors"
                  >
                    -{val}
                  </button>
                ))}
              </div>

              {/* Custom amount */}
              {showCustom ? (
                <div className="flex gap-2 mb-4">
                  <input
                    type="number"
                    value={customValue}
                    onChange={(e) => setCustomValue(e.target.value)}
                    placeholder="e.g. 300 or -300"
                    disabled={isSubmitting}
                    className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-500 disabled:opacity-40"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCustomApply();
                    }}
                    autoFocus
                  />
                  <button
                    onClick={handleCustomApply}
                    disabled={isSubmitting || !customValue}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors"
                  >
                    Apply
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowCustom(true)}
                  disabled={isSubmitting}
                  className="w-full py-2 mb-4 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 text-gray-200 text-sm font-medium rounded-lg transition-colors"
                >
                  Custom Amount
                </button>
              )}

              {/* Error */}
              {error !== null && (
                <p className="text-red-400 text-sm mb-4" role="alert">
                  {error}
                </p>
              )}

              {/* Cancel */}
              <button
                onClick={handleClose}
                disabled={isSubmitting}
                className="w-full py-2 text-gray-400 hover:text-gray-200 disabled:opacity-40 text-sm transition-colors"
              >
                Cancel
              </button>
            </DialogPanel>
          </TransitionChild>
        </div>
      </Dialog>
    </Transition>
  );
}
