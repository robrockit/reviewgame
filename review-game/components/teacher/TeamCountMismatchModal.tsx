/**
 * @fileoverview Modal component for confirming game start with team count mismatch.
 *
 * Displays a warning when the number of connected teams doesn't match
 * the expected team count, allowing teachers to proceed or cancel.
 *
 * @module components/teacher/TeamCountMismatchModal
 */

'use client';

import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

interface TeamCountMismatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  expectedTeams: number;
  actualTeams: number;
}

/**
 * Team count mismatch confirmation modal.
 *
 * Shows a warning dialog when starting a game with fewer or more
 * teams than expected, allowing the teacher to proceed or cancel.
 */
export default function TeamCountMismatchModal({
  isOpen,
  onClose,
  onConfirm,
  expectedTeams,
  actualTeams,
}: TeamCountMismatchModalProps) {
  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
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
                    Team Count Mismatch
                  </Dialog.Title>
                  <button
                    type="button"
                    onClick={onClose}
                    className="text-gray-400 hover:text-gray-500"
                  >
                    <span className="sr-only">Close</span>
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>

                {/* Content */}
                <div className="space-y-4">
                  <div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
                    <div className="flex">
                      <ExclamationTriangleIcon className="h-6 w-6 text-amber-600 flex-shrink-0" />
                      <div className="ml-3">
                        <h4 className="text-sm font-medium text-amber-800 mb-2">
                          Unexpected Team Count
                        </h4>
                        <p className="text-sm text-amber-700 mb-3">
                          You have <strong>{actualTeams} team{actualTeams !== 1 ? 's' : ''}</strong> but
                          expected <strong>{expectedTeams} team{expectedTeams !== 1 ? 's' : ''}</strong>.
                        </p>
                        <p className="text-sm text-amber-700">
                          Do you want to continue and start the game anyway?
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex justify-end space-x-3 pt-4">
                    <button
                      type="button"
                      onClick={onClose}
                      className="inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirm}
                      className="inline-flex justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
                    >
                      Start Game Anyway
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
