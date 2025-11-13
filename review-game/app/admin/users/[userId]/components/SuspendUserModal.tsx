/**
 * @fileoverview Modal component for suspending user accounts.
 *
 * Provides a form to suspend users with mandatory reason selection and optional notes.
 * Includes confirmation step to prevent accidental suspensions.
 *
 * @module app/admin/users/[userId]/components/SuspendUserModal
 */

'use client';

import { Fragment, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import type { SuspensionReason } from '@/app/api/admin/users/[userId]/suspend/route';

interface SuspendUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail: string;
  userId: string;
  onSuccess: () => void;
}

/**
 * Suspension reason options with labels
 */
const SUSPENSION_REASONS: Array<{ value: SuspensionReason; label: string; description: string }> = [
  {
    value: 'policy_violation',
    label: 'Policy Violation',
    description: 'User violated terms of service or community guidelines',
  },
  {
    value: 'payment_fraud',
    label: 'Payment Fraud',
    description: 'Fraudulent payment activity or chargebacks',
  },
  {
    value: 'abuse',
    label: 'Abuse',
    description: 'Abusive behavior towards other users or staff',
  },
  {
    value: 'other',
    label: 'Other',
    description: 'Other reason not listed above',
  },
];

/**
 * Suspend user modal component
 *
 * Displays a modal dialog with a form to suspend user accounts.
 * Requires reason selection and shows confirmation step.
 */
export default function SuspendUserModal({
  isOpen,
  onClose,
  userEmail,
  userId,
  onSuccess,
}: SuspendUserModalProps) {
  const [reason, setReason] = useState<SuspensionReason>('policy_violation');
  const [notes, setNotes] = useState('');
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  /**
   * Handles form submission
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Show confirmation if not already shown
    if (!showConfirmation) {
      setShowConfirmation(true);
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const response = await fetch(`/api/admin/users/${userId}/suspend`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason, notes: notes || undefined }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to suspend user');
      }

      onSuccess();
      handleClose();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'An error occurred');
      setShowConfirmation(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Handles modal close
   */
  const handleClose = () => {
    if (!isSubmitting) {
      setShowConfirmation(false);
      setReason('policy_violation');
      setNotes('');
      setSubmitError(null);
      onClose();
    }
  };

  /**
   * Handles going back from confirmation
   */
  const handleBack = () => {
    setShowConfirmation(false);
    setSubmitError(null);
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={handleClose}>
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
                    {showConfirmation ? 'Confirm Suspension' : 'Suspend User Account'}
                  </Dialog.Title>
                  <button
                    type="button"
                    onClick={handleClose}
                    disabled={isSubmitting}
                    className="text-gray-400 hover:text-gray-500 disabled:opacity-50"
                  >
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>

                {/* Error message */}
                {submitError && (
                  <div className="mb-4 rounded-lg bg-red-50 p-4">
                    <div className="flex">
                      <div className="ml-3">
                        <h3 className="text-sm font-medium text-red-800">
                          Error suspending user
                        </h3>
                        <div className="mt-2 text-sm text-red-700">
                          <p>{submitError}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {showConfirmation ? (
                  /* Confirmation Screen */
                  <div className="space-y-4">
                    <div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
                      <div className="flex">
                        <ExclamationTriangleIcon className="h-6 w-6 text-amber-600" />
                        <div className="ml-3">
                          <h4 className="text-sm font-medium text-amber-800 mb-2">
                            Are you sure you want to suspend this user?
                          </h4>
                          <p className="text-sm text-amber-700 mb-2">
                            <strong>{userEmail}</strong> will immediately lose access to their account and cannot login until reactivated.
                          </p>
                          <div className="mt-3 border-t border-amber-200 pt-3">
                            <p className="text-sm font-medium text-amber-800">Reason:</p>
                            <p className="text-sm text-amber-700">
                              {SUSPENSION_REASONS.find(r => r.value === reason)?.label}
                            </p>
                            {notes && (
                              <>
                                <p className="text-sm font-medium text-amber-800 mt-2">Notes:</p>
                                <p className="text-sm text-amber-700">{notes}</p>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end space-x-3">
                      <button
                        type="button"
                        onClick={handleBack}
                        disabled={isSubmitting}
                        className="inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Back
                      </button>
                      <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        className="inline-flex justify-center rounded-md border border-transparent bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isSubmitting ? 'Suspending...' : 'Yes, Suspend User'}
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Form Screen */
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <p className="text-sm text-gray-600">
                      Suspending <strong>{userEmail}</strong> will immediately prevent them from accessing their account.
                    </p>

                    {/* Reason Selection */}
                    <div>
                      <label
                        htmlFor="reason"
                        className="block text-sm font-medium text-gray-700 mb-1"
                      >
                        Suspension Reason <span className="text-red-500">*</span>
                      </label>
                      <select
                        id="reason"
                        name="reason"
                        value={reason}
                        onChange={(e) => setReason(e.target.value as SuspensionReason)}
                        disabled={isSubmitting}
                        required
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 sm:text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                      >
                        {SUSPENSION_REASONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <p className="mt-1 text-xs text-gray-500">
                        {SUSPENSION_REASONS.find(r => r.value === reason)?.description}
                      </p>
                    </div>

                    {/* Notes */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label
                          htmlFor="notes"
                          className="block text-sm font-medium text-gray-700"
                        >
                          Additional Notes (Optional)
                        </label>
                        <span className="text-xs text-gray-500">
                          {notes.length}/5000
                        </span>
                      </div>
                      <textarea
                        id="notes"
                        name="notes"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        disabled={isSubmitting}
                        maxLength={5000}
                        rows={4}
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 sm:text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                        placeholder="Provide additional context or details about the suspension..."
                      />
                    </div>

                    {/* Buttons */}
                    <div className="flex justify-end space-x-3 pt-4">
                      <button
                        type="button"
                        onClick={handleClose}
                        disabled={isSubmitting}
                        className="inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="inline-flex justify-center rounded-md border border-transparent bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Continue
                      </button>
                    </div>
                  </form>
                )}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
