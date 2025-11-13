/**
 * @fileoverview Modal component for editing user profile information.
 *
 * Provides a form to edit user's full name, email, and admin notes.
 * Validates input and displays success/error messages.
 *
 * @module app/admin/users/[userId]/components/EditProfileModal
 */

'use client';

import { Fragment, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import type { AdminUserDetail } from '@/app/api/admin/users/[userId]/route';
import type { UpdateProfileRequest } from '@/app/api/admin/users/[userId]/route';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: AdminUserDetail;
  onSuccess: (updatedUser: AdminUserDetail) => void;
}

/**
 * Validation constants (must match API validation)
 */
const VALIDATION = {
  FULL_NAME_MAX_LENGTH: 255,
  EMAIL_MAX_LENGTH: 255,
  ADMIN_NOTES_MAX_LENGTH: 5000,
  // RFC 5322 compliant email regex
  EMAIL_REGEX: /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/,
} as const;

/**
 * Edit profile modal component
 *
 * Displays a modal dialog with a form to edit user profile information.
 * Validates email format and required fields before submission.
 */
export default function EditProfileModal({
  isOpen,
  onClose,
  user,
  onSuccess,
}: EditProfileModalProps) {
  const [formData, setFormData] = useState<UpdateProfileRequest>({
    full_name: user.full_name || '',
    email: user.email,
    admin_notes: user.admin_notes || '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  /**
   * Validates form data
   */
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Validate full name length
    if (formData.full_name && formData.full_name.trim().length > VALIDATION.FULL_NAME_MAX_LENGTH) {
      newErrors.full_name = `Full name must be ${VALIDATION.FULL_NAME_MAX_LENGTH} characters or less`;
    }

    // Email is required and must be valid format
    if (!formData.email || formData.email.trim() === '') {
      newErrors.email = 'Email is required';
    } else {
      const trimmedEmail = formData.email.trim();

      if (trimmedEmail.length > VALIDATION.EMAIL_MAX_LENGTH) {
        newErrors.email = `Email must be ${VALIDATION.EMAIL_MAX_LENGTH} characters or less`;
      } else if (!VALIDATION.EMAIL_REGEX.test(trimmedEmail)) {
        newErrors.email = 'Invalid email format';
      }
    }

    // Validate admin notes length
    if (formData.admin_notes && formData.admin_notes.trim().length > VALIDATION.ADMIN_NOTES_MAX_LENGTH) {
      newErrors.admin_notes = `Admin notes must be ${VALIDATION.ADMIN_NOTES_MAX_LENGTH} characters or less`;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  /**
   * Handles form submission
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();

        // Handle specific error codes with better messages
        if (response.status === 409) {
          // Conflict - either email in use or concurrent edit
          throw new Error(errorData.error || 'Conflict occurred');
        }

        throw new Error(errorData.error || 'Failed to update user profile');
      }

      const result = await response.json();
      onSuccess(result.data);
      onClose();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Handles input changes
   */
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear error for this field when user starts typing
    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  /**
   * Handles modal close
   */
  const handleClose = () => {
    if (!isSubmitting) {
      onClose();
    }
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
                    Edit User Profile
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
                          Error updating profile
                        </h3>
                        <div className="mt-2 text-sm text-red-700">
                          <p>{submitError}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Full Name */}
                  <div>
                    <label
                      htmlFor="full_name"
                      className="block text-sm font-medium text-gray-700 mb-1"
                    >
                      Full Name
                    </label>
                    <input
                      type="text"
                      id="full_name"
                      name="full_name"
                      value={formData.full_name || ''}
                      onChange={handleChange}
                      disabled={isSubmitting}
                      maxLength={VALIDATION.FULL_NAME_MAX_LENGTH}
                      className={`block w-full rounded-md shadow-sm focus:border-purple-500 focus:ring-purple-500 sm:text-sm disabled:bg-gray-100 disabled:cursor-not-allowed ${
                        errors.full_name ? 'border-red-300' : 'border-gray-300'
                      }`}
                      placeholder="Enter full name"
                    />
                    {errors.full_name && (
                      <p className="mt-1 text-sm text-red-600">{errors.full_name}</p>
                    )}
                  </div>

                  {/* Email */}
                  <div>
                    <label
                      htmlFor="email"
                      className="block text-sm font-medium text-gray-700 mb-1"
                    >
                      Email <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      disabled={isSubmitting}
                      required
                      className={`block w-full rounded-md shadow-sm focus:border-purple-500 focus:ring-purple-500 sm:text-sm disabled:bg-gray-100 disabled:cursor-not-allowed ${
                        errors.email ? 'border-red-300' : 'border-gray-300'
                      }`}
                      placeholder="user@example.com"
                    />
                    {errors.email && (
                      <p className="mt-1 text-sm text-red-600">{errors.email}</p>
                    )}
                    {formData.email !== user.email && (
                      <p className="mt-1 text-sm text-amber-600">
                        ⚠️ Changing email will require re-verification
                      </p>
                    )}
                  </div>

                  {/* Admin Notes */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label
                        htmlFor="admin_notes"
                        className="block text-sm font-medium text-gray-700"
                      >
                        Admin Notes
                      </label>
                      <span className="text-xs text-gray-500">
                        {(formData.admin_notes || '').length}/{VALIDATION.ADMIN_NOTES_MAX_LENGTH}
                      </span>
                    </div>
                    <textarea
                      id="admin_notes"
                      name="admin_notes"
                      value={formData.admin_notes || ''}
                      onChange={handleChange}
                      disabled={isSubmitting}
                      maxLength={VALIDATION.ADMIN_NOTES_MAX_LENGTH}
                      rows={4}
                      className={`block w-full rounded-md shadow-sm focus:border-purple-500 focus:ring-purple-500 sm:text-sm disabled:bg-gray-100 disabled:cursor-not-allowed ${
                        errors.admin_notes ? 'border-red-300' : 'border-gray-300'
                      }`}
                      placeholder="Internal notes about this user (not visible to user)"
                    />
                    {errors.admin_notes && (
                      <p className="mt-1 text-sm text-red-600">{errors.admin_notes}</p>
                    )}
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
                      className="inline-flex justify-center rounded-md border border-transparent bg-purple-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSubmitting ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </form>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
