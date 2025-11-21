/**
 * @fileoverview Modal component for starting user impersonation sessions.
 *
 * Provides a form to start impersonation with mandatory reason input and security warnings.
 * Includes confirmation step to prevent accidental impersonation.
 *
 * @module app/admin/users/[userId]/components/ImpersonateModal
 */

'use client';

import { Fragment, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon, ShieldExclamationIcon } from '@heroicons/react/24/outline';

interface ImpersonateModalProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail: string;
  userName: string | null;
  userId: string;
  onSuccess: () => void;
}

/**
 * Impersonate user modal component
 *
 * Displays a modal dialog with a form to start user impersonation sessions.
 * Requires reason input and shows confirmation step with security warnings.
 */
export default function ImpersonateModal({
  isOpen,
  onClose,
  userEmail,
  userName,
  userId,
  onSuccess,
}: ImpersonateModalProps) {
  const [reason, setReason] = useState('');
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
      const response = await fetch(`/api/admin/users/${userId}/impersonate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to start impersonation');
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
      setReason('');
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

  const displayName = userName || userEmail;

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
                    {showConfirmation ? 'Confirm Impersonation' : 'Impersonate User'}
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
                          Error starting impersonation
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
                        <ShieldExclamationIcon className="h-6 w-6 text-amber-600 flex-shrink-0" />
                        <div className="ml-3">
                          <h4 className="text-sm font-medium text-amber-800 mb-2">
                            Are you sure you want to impersonate this user?
                          </h4>
                          <p className="text-sm text-amber-700 mb-2">
                            You will gain access to <strong>{displayName}</strong>&apos;s account and can perform actions on their behalf.
                          </p>
                          <div className="mt-3 border-t border-amber-200 pt-3 space-y-2">
                            <div>
                              <p className="text-sm font-medium text-amber-800">User:</p>
                              <p className="text-sm text-amber-700">{userEmail}</p>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-amber-800">Reason:</p>
                              <p className="text-sm text-amber-700 whitespace-pre-wrap break-words">{reason}</p>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-amber-800">Session Details:</p>
                              <ul className="text-sm text-amber-700 list-disc list-inside mt-1 space-y-1">
                                <li>Auto-expires in 15 minutes</li>
                                <li>All actions will be audited</li>
                                <li>Session can be ended early</li>
                              </ul>
                            </div>
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
                        className="inline-flex justify-center rounded-md border border-transparent bg-amber-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isSubmitting ? 'Starting Impersonation...' : 'Yes, Start Impersonation'}
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Form Screen */
                  <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Security Warning */}
                    <div className="rounded-lg bg-purple-50 border border-purple-200 p-4">
                      <div className="flex">
                        <ShieldExclamationIcon className="h-5 w-5 text-purple-600 flex-shrink-0 mt-0.5" />
                        <div className="ml-3">
                          <h4 className="text-sm font-medium text-purple-800 mb-1">
                            Security Notice
                          </h4>
                          <p className="text-sm text-purple-700">
                            Impersonating <strong>{displayName}</strong> will log you into their account for troubleshooting. All actions will be audited and linked to your admin account.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Reason Input */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label
                          htmlFor="reason"
                          className="block text-sm font-medium text-gray-700"
                        >
                          Reason for Impersonation <span className="text-red-500">*</span>
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
                        rows={4}
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 sm:text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                        placeholder="Explain why you need to impersonate this user (minimum 10 characters)..."
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        Provide a detailed reason for compliance and audit purposes.
                      </p>
                    </div>

                    {/* Impersonation Limits Info */}
                    <div className="rounded-lg bg-gray-50 border border-gray-200 p-3">
                      <h4 className="text-sm font-medium text-gray-800 mb-2">
                        Impersonation Rules
                      </h4>
                      <ul className="text-xs text-gray-600 space-y-1">
                        <li>• Cannot impersonate other admin users</li>
                        <li>• Cannot impersonate suspended accounts</li>
                        <li>• Sessions automatically expire after 15 minutes</li>
                        <li>• Maximum 5 impersonations per hour per admin</li>
                        <li>• All actions during impersonation are logged</li>
                      </ul>
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
                        disabled={isSubmitting || reason.trim().length < 10}
                        className="inline-flex justify-center rounded-md border border-transparent bg-amber-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
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
