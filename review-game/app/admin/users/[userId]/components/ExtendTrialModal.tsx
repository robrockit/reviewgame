/**
 * @fileoverview Modal component for extending user trial periods.
 *
 * Provides a form to extend trial periods by adding days to trial_end.
 * Supports both active trials (extension) and expired trials (reactivation).
 *
 * @module app/admin/users/[userId]/components/ExtendTrialModal
 */

'use client';

import { Fragment, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

interface ExtendTrialModalProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail: string;
  userId: string;
  subscriptionId: string | null; // Passed for consistency but not currently used
  trialStatus: 'active' | 'expired' | 'none';
  currentTrialEndDate: string | null;
  onSuccess: (newTrialEndDate: string) => void;
}

/**
 * Extend trial modal component
 *
 * Displays a modal dialog for extending or reactivating trial periods.
 * Follows the established two-step pattern (form → confirmation).
 */
export default function ExtendTrialModal({
  isOpen,
  onClose,
  userEmail,
  userId,
  subscriptionId, // eslint-disable-line @typescript-eslint/no-unused-vars -- Passed for interface consistency
  trialStatus,
  currentTrialEndDate,
  onSuccess,
}: ExtendTrialModalProps) {
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [extendDays, setExtendDays] = useState(7);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  const isExpired = trialStatus === 'expired';
  const actionLabel = isExpired ? 'Reactivate Trial' : 'Extend Trial';
  const actionDescription = isExpired
    ? 'Start a new trial period for this user'
    : 'Add additional days to the current trial period';

  /**
   * Validates the form can be submitted
   */
  const canSubmit = (): boolean => {
    if (reason.trim().length < 10) return false;
    if (extendDays < 1 || extendDays > 365) return false;
    return true;
  };

  /**
   * Handles form submission
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Prevent duplicate submissions
    if (hasSubmitted || isSubmitting) {
      return;
    }

    // Show confirmation if not already shown
    if (!showConfirmation) {
      setShowConfirmation(true);
      return;
    }

    setIsSubmitting(true);
    setHasSubmitted(true);
    setSubmitError(null);

    try {
      const response = await fetch(`/api/admin/users/${userId}/subscription/extend-trial`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          extendDays,
          reason,
          notes: notes || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to extend trial');
      }

      const data = await response.json();
      const newTrialEndDate = data.subscription?.trialEnd || '';

      onSuccess(newTrialEndDate);
      handleClose();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'An error occurred');
      setShowConfirmation(false);
      setHasSubmitted(false); // Allow retry on error
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
      setReason('');
      setNotes('');
      setExtendDays(7);
      setSubmitError(null);
      setHasSubmitted(false);
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

  // Don't show modal if no trial status
  if (trialStatus === 'none') {
    return null;
  }

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
              <Dialog.Panel className="w-full max-w-lg transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                  <Dialog.Title
                    as="h3"
                    className="text-lg font-medium leading-6 text-gray-900"
                  >
                    {showConfirmation ? 'Confirm Action' : actionLabel}
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
                          Error extending trial
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
                    <div className="rounded-lg border p-4 bg-blue-50 border-blue-200">
                      <div className="flex">
                        <ExclamationTriangleIcon className="h-6 w-6 flex-shrink-0 text-blue-600" />
                        <div className="ml-3">
                          <h4 className="text-sm font-medium mb-2 text-blue-800">
                            Are you sure you want to {actionLabel.toLowerCase()}?
                          </h4>
                          <p className="text-sm mb-2 text-blue-700">
                            <strong>{userEmail}</strong> - {actionDescription}
                          </p>
                          <div className="mt-3 border-t pt-3 border-blue-200">
                            <p className="text-sm font-medium text-blue-800">Action:</p>
                            <p className="text-sm text-blue-700">
                              {actionLabel}
                            </p>
                            <p className="text-sm font-medium mt-2 text-blue-800">Extension:</p>
                            <p className="text-sm text-blue-700">
                              {extendDays} days
                            </p>
                            {isExpired && currentTrialEndDate && (
                              <>
                                <p className="text-sm font-medium mt-2 text-blue-800">Previous Trial End:</p>
                                <p className="text-sm text-blue-700">
                                  {new Date(currentTrialEndDate).toLocaleDateString()}
                                </p>
                              </>
                            )}
                            <p className="text-sm font-medium mt-2 text-blue-800">Reason:</p>
                            <p className="text-sm whitespace-pre-wrap text-blue-700">
                              {reason}
                            </p>
                            {notes && (
                              <>
                                <p className="text-sm font-medium mt-2 text-blue-800">Notes:</p>
                                <p className="text-sm whitespace-pre-wrap text-blue-700">
                                  {notes}
                                </p>
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
                        className="inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Back
                      </button>
                      <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        className="inline-flex justify-center rounded-md border border-transparent px-4 py-2 text-sm font-medium text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed bg-blue-600 hover:bg-blue-700 focus:ring-blue-500"
                      >
                        {isSubmitting ? 'Processing...' : 'Yes, Proceed'}
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Form Screen */
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <p className="text-sm text-gray-600">
                      {actionDescription} for <strong>{userEmail}</strong>
                    </p>

                    {isExpired && currentTrialEndDate && (
                      <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
                        <p className="text-sm text-amber-800">
                          <strong>Note:</strong> This trial expired on{' '}
                          {new Date(currentTrialEndDate).toLocaleDateString()}.
                          Extending will create a new trial period.
                        </p>
                      </div>
                    )}

                    {/* Extend Days */}
                    <div>
                      <label
                        htmlFor="extendDays"
                        className="block text-sm font-medium text-gray-700 mb-1"
                      >
                        Days to {isExpired ? 'Add' : 'Extend'} <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        id="extendDays"
                        name="extendDays"
                        value={extendDays}
                        onChange={(e) => setExtendDays(parseInt(e.target.value))}
                        disabled={isSubmitting}
                        required
                        min="1"
                        max="365"
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        Enter number of days (1-365) to {isExpired ? 'add to new trial' : 'extend current trial'}
                      </p>
                    </div>

                    {/* Reason */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label
                          htmlFor="reason"
                          className="block text-sm font-medium text-gray-700"
                        >
                          Reason <span className="text-red-500">*</span>
                        </label>
                        <span className="text-xs text-gray-500">
                          {reason.length}/500
                        </span>
                      </div>
                      <textarea
                        id="reason"
                        name="reason"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        disabled={isSubmitting}
                        required
                        minLength={10}
                        maxLength={500}
                        rows={3}
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                        placeholder="Explain why you're extending the trial (minimum 10 characters)..."
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        Required for audit and compliance purposes
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
                          {notes.length}/1000
                        </span>
                      </div>
                      <textarea
                        id="notes"
                        name="notes"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        disabled={isSubmitting}
                        maxLength={1000}
                        rows={3}
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                        placeholder="Add any additional context or details..."
                      />
                    </div>

                    {/* Buttons */}
                    <div className="flex justify-end space-x-3 pt-4">
                      <button
                        type="button"
                        onClick={handleClose}
                        disabled={isSubmitting}
                        className="inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isSubmitting || !canSubmit()}
                        className="inline-flex justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
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
