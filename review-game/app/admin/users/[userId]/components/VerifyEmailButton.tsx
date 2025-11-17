/**
 * @fileoverview Button component for manually verifying user email addresses.
 *
 * Provides a button and confirmation modal for admins to manually verify
 * user email addresses when users have email delivery issues.
 *
 * @module app/admin/users/[userId]/components/VerifyEmailButton
 */

'use client';

import { Fragment, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon, CheckCircleIcon } from '@heroicons/react/24/outline';

interface VerifyEmailButtonProps {
  userId: string;
  userEmail: string;
  isEmailVerified: boolean;
  onSuccess: () => void;
}

/**
 * Verify email button component
 *
 * Displays a button to manually verify user email and a confirmation modal.
 * Button is disabled if email is already verified.
 */
export default function VerifyEmailButton({
  userId,
  userEmail,
  isEmailVerified,
  onSuccess,
}: VerifyEmailButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  /**
   * Handles opening the confirmation modal
   */
  const handleOpenModal = () => {
    setIsModalOpen(true);
    setSubmitError(null);
  };

  /**
   * Handles closing the modal
   */
  const handleCloseModal = () => {
    if (!isSubmitting) {
      setIsModalOpen(false);
      setSubmitError(null);
    }
  };

  /**
   * Handles email verification confirmation
   */
  const handleConfirm = async () => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const response = await fetch(`/api/admin/users/${userId}/verify-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to verify email');
      }

      onSuccess();
      handleCloseModal();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {/* Verify Email Button */}
      <button
        onClick={handleOpenModal}
        disabled={isEmailVerified}
        className={`px-4 py-2 rounded-lg font-medium transition-colors ${
          isEmailVerified
            ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
            : 'bg-green-600 text-white hover:bg-green-700'
        }`}
        title={isEmailVerified ? 'Email is already verified' : 'Manually verify email'}
      >
        {isEmailVerified ? 'Email Verified' : 'Verify Email'}
      </button>

      {/* Confirmation Modal */}
      <Transition appear show={isModalOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={handleCloseModal}>
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
                  <div className="flex items-start justify-between">
                    <div className="flex items-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                        <CheckCircleIcon className="h-6 w-6 text-green-600" aria-hidden="true" />
                      </div>
                      <Dialog.Title
                        as="h3"
                        className="ml-3 text-lg font-medium leading-6 text-gray-900"
                      >
                        Verify Email Address
                      </Dialog.Title>
                    </div>
                    <button
                      onClick={handleCloseModal}
                      disabled={isSubmitting}
                      className="rounded-md text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:cursor-not-allowed"
                    >
                      <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                    </button>
                  </div>

                  {/* Content */}
                  <div className="mt-4">
                    <p className="text-sm text-gray-500">
                      Are you sure you want to manually verify the email address for:
                    </p>
                    <p className="mt-2 text-sm font-medium text-gray-900">{userEmail}</p>

                    <div className="mt-4 rounded-lg bg-yellow-50 p-4">
                      <p className="text-sm text-yellow-800">
                        <strong>Note:</strong> This action will mark the email as verified in both
                        the database and authentication system. Use this only when users have
                        legitimate email delivery issues.
                      </p>
                    </div>

                    {/* Error Message */}
                    {submitError && (
                      <div className="mt-4 rounded-lg bg-red-50 p-4">
                        <p className="text-sm text-red-800">{submitError}</p>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="mt-6 flex gap-3">
                    <button
                      type="button"
                      onClick={handleCloseModal}
                      disabled={isSubmitting}
                      className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirm}
                      disabled={isSubmitting}
                      className="flex-1 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isSubmitting ? 'Verifying...' : 'Verify Email'}
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </>
  );
}
