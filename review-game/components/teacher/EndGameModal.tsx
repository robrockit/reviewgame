/**
 * @fileoverview Modal component for ending game sessions.
 *
 * Provides a confirmation dialog when ending a game, with different
 * warnings based on whether teams are connected or not.
 *
 * @module components/teacher/EndGameModal
 */

'use client';

import { Fragment, useState, useRef } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon, ExclamationTriangleIcon, InformationCircleIcon } from '@heroicons/react/24/outline';

interface EndGameModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  gameTitle: string;
  teamCount: number;
  hasConnectedTeams: boolean;
}

/**
 * End game confirmation modal component.
 *
 * Displays a modal dialog with different warnings based on game state.
 * Shows critical warning if teams are connected, info message otherwise.
 */
export default function EndGameModal({
  isOpen,
  onClose,
  onConfirm,
  gameTitle,
  teamCount,
  hasConnectedTeams,
}: EndGameModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  /**
   * Handles confirmation action.
   * Calls onConfirm callback and closes modal on success.
   */
  const handleConfirm = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      await onConfirm();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to end game');
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Handles modal close.
   * Resets error state and calls onClose callback.
   */
  const handleClose = () => {
    if (!isSubmitting) {
      setError(null);
      onClose();
    }
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={handleClose} initialFocus={cancelButtonRef}>
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
          <div className="fixed inset-0 bg-black bg-opacity-25" />
        </Transition.Child>

        {/* Modal container */}
        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                  <Dialog.Title
                    as="h3"
                    className="text-lg font-medium leading-6 text-gray-900"
                  >
                    End Game?
                  </Dialog.Title>
                  <button
                    type="button"
                    onClick={handleClose}
                    disabled={isSubmitting}
                    className="text-gray-400 hover:text-gray-500 disabled:opacity-50"
                  >
                    <span className="sr-only">Close</span>
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>

                {/* Error message */}
                {error && (
                  <div className="mb-4 rounded-lg bg-red-50 p-4">
                    <div className="flex">
                      <div className="ml-3">
                        <h3 className="text-sm font-medium text-red-800">
                          Error ending game
                        </h3>
                        <div className="mt-2 text-sm text-red-700">
                          <p>{error}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Content */}
                <div className="space-y-4">
                  {hasConnectedTeams ? (
                    /* Warning for active game with connected teams */
                    <div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
                      <div className="flex">
                        <ExclamationTriangleIcon className="h-6 w-6 text-amber-600 flex-shrink-0" />
                        <div className="ml-3">
                          <h4 className="text-sm font-medium text-amber-800 mb-2">
                            Active Game in Progress
                          </h4>
                          <p className="text-sm text-amber-700 mb-3">
                            You have <strong>{teamCount} team{teamCount !== 1 ? 's' : ''}</strong> currently connected to <strong>&quot;{gameTitle}&quot;</strong>.
                          </p>
                          <div className="text-sm text-amber-700 space-y-1">
                            <p className="font-medium">Ending the game will:</p>
                            <ul className="list-disc list-inside ml-2 space-y-1">
                              <li>Mark the game as completed</li>
                              <li>Disconnect all teams</li>
                              <li>Save final scores</li>
                              <li>Return you to the dashboard</li>
                            </ul>
                          </div>
                          <p className="text-sm text-amber-800 font-medium mt-3">
                            This action cannot be undone.
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Info for game without connected teams */
                    <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
                      <div className="flex">
                        <InformationCircleIcon className="h-6 w-6 text-blue-600 flex-shrink-0" />
                        <div className="ml-3">
                          <h4 className="text-sm font-medium text-blue-800 mb-2">
                            Game Not Started
                          </h4>
                          <p className="text-sm text-blue-700">
                            This game has not started yet (no teams connected).
                            You can safely return to the dashboard.
                          </p>
                          <p className="text-sm text-blue-700 mt-2">
                            The game will be marked as completed.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex justify-end space-x-3 pt-4">
                    <button
                      ref={cancelButtonRef}
                      type="button"
                      onClick={handleClose}
                      disabled={isSubmitting}
                      className="inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirm}
                      disabled={isSubmitting}
                      className={`inline-flex justify-center rounded-md border border-transparent px-4 py-2 text-sm font-medium text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${
                        hasConnectedTeams
                          ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
                          : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
                      }`}
                    >
                      {isSubmitting ? 'Ending Game...' : 'End Game'}
                    </button>
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
