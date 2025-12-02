/**
 * @fileoverview Grant Free Access modal component.
 *
 * Allows admins to grant free Premium access to users with either:
 * - Temporary access (with specified duration in days)
 * - Permanent access (lifetime)
 *
 * Features:
 * - Two-step confirmation flow (details → confirm)
 * - Access type selection (temporary vs permanent)
 * - Category/reason selection
 * - Duration input for temporary access
 * - Admin notes field
 * - Full audit logging
 *
 * @module app/admin/users/[userId]/components/GrantAccessModal
 */

'use client';

import { useState, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import {
  XMarkIcon,
  GiftIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';

interface GrantAccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail: string;
  userId: string;
  onSuccess: (grantDetails: { type: 'temporary' | 'lifetime'; expiresAt?: string }) => void;
}

/**
 * Access categories with descriptions
 */
const ACCESS_CATEGORIES = [
  { value: 'service_outage', label: 'Service Outage', description: 'Compensation for service disruption' },
  { value: 'promotional', label: 'Promotional', description: 'Marketing or promotional campaign' },
  { value: 'educational', label: 'Educational/Non-Profit', description: 'Educational institution or non-profit organization' },
  { value: 'employee_partner', label: 'Employee/Partner', description: 'Company employee or business partner' },
  { value: 'competition', label: 'Competition Winner', description: 'Contest or competition prize' },
  { value: 'other', label: 'Other', description: 'Other reason (specify in notes)' },
] as const;

/**
 * XSS prevention patterns (matching backend validation)
 * Provides early user feedback if forbidden characters are detected
 */
const FORBIDDEN_PATTERNS = [
  /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, // Control characters
  /<script[^>]*>.*?<\/script>/gi, // Script tags
  /<iframe[^>]*>.*?<\/iframe>/gi, // Iframes
  /<object[^>]*>.*?<\/object>/gi, // Objects
  /<embed[^>]*>/gi, // Embeds
  /javascript:/gi, // JavaScript protocol
  /vbscript:/gi, // VBScript protocol
  /data:text\/html/gi, // Data URIs
  /on\w+\s*=/gi, // Event handlers (onclick, onerror, etc.)
  /&lt;script/gi, // HTML entity encoded script tags
];

/**
 * Checks if input contains forbidden XSS patterns
 */
function containsForbiddenPatterns(input: string): boolean {
  return FORBIDDEN_PATTERNS.some(pattern => pattern.test(input));
}

/**
 * Grant Access modal component.
 *
 * Provides interface for granting free Premium access to users.
 * Supports both temporary (time-limited) and permanent (lifetime) grants.
 */
export default function GrantAccessModal({
  isOpen,
  onClose,
  userEmail,
  userId,
  onSuccess,
}: GrantAccessModalProps) {
  // Form state
  const [accessType, setAccessType] = useState<'temporary' | 'lifetime'>('temporary');
  const [category, setCategory] = useState<string>('');
  const [duration, setDuration] = useState<number>(30); // Default 30 days for temporary
  const [notes, setNotes] = useState('');
  const [planName, setPlanName] = useState('');

  // UI state
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Resets all form fields and modal state
   */
  const resetForm = () => {
    setAccessType('temporary');
    setCategory('');
    setDuration(30);
    setNotes('');
    setPlanName('');
    setShowConfirmation(false);
    setSubmitting(false);
    setError(null);
  };

  /**
   * Handles modal close
   */
  const handleClose = () => {
    if (!submitting) {
      resetForm();
      onClose();
    }
  };

  /**
   * Validates form inputs
   */
  const validateForm = (): string | null => {
    if (!category) {
      return 'Please select a reason category';
    }

    // Require notes for "Other" category
    if (category === 'other' && !notes.trim()) {
      return 'Notes are required when selecting "Other" category';
    }

    if (!planName.trim()) {
      return 'Please provide a plan name';
    }

    if (planName.trim().length < 3 || planName.trim().length > 100) {
      return 'Plan name must be between 3 and 100 characters';
    }

    // Check for XSS patterns in plan name
    if (containsForbiddenPatterns(planName)) {
      return 'Plan name contains forbidden characters or patterns. Please remove HTML tags, scripts, or special characters.';
    }

    if (accessType === 'temporary') {
      if (!Number.isInteger(duration) || duration < 1 || duration > 3650) {
        return 'Duration must be between 1 and 3650 days (10 years)';
      }
    }

    if (notes.length > 1000) {
      return 'Notes cannot exceed 1000 characters';
    }

    // Check for XSS patterns in notes
    if (notes && containsForbiddenPatterns(notes)) {
      return 'Notes contain forbidden characters or patterns. Please remove HTML tags, scripts, or special characters.';
    }

    return null;
  };

  /**
   * Handles form submission (first step shows confirmation, second step submits)
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate inputs
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    // First click: show confirmation
    if (!showConfirmation) {
      setShowConfirmation(true);
      return;
    }

    // Second click: submit the form
    try {
      setSubmitting(true);

      const response = await fetch(`/api/admin/users/${userId}/subscription/grant-access`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accessType,
          category,
          duration: accessType === 'temporary' ? duration : undefined,
          notes: notes.trim() || undefined,
          planName: planName.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to grant access');
      }

      // Call success callback with grant details
      onSuccess({
        type: accessType,
        expiresAt: data.expiresAt,
      });

      // Close and reset
      handleClose();
    } catch (err) {
      console.error('Error granting access:', err);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
      setShowConfirmation(false); // Allow user to fix and try again
    } finally {
      setSubmitting(false);
    }
  };

  /**
   * Handles going back from confirmation to form
   */
  const handleBack = () => {
    setShowConfirmation(false);
    setError(null);
  };

  // Get selected category details
  const selectedCategory = ACCESS_CATEGORIES.find(c => c.value === category);

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={handleClose}>
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
              <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                {/* Header */}
                <div className="flex items-start justify-between mb-6">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 rounded-full bg-green-100 p-3">
                      <GiftIcon className="h-6 w-6 text-green-600" />
                    </div>
                    <div className="ml-4">
                      <Dialog.Title as="h3" className="text-lg font-semibold text-gray-900">
                        {showConfirmation ? 'Confirm Grant Access' : 'Grant Free Premium Access'}
                      </Dialog.Title>
                      <p className="text-sm text-gray-500 mt-1">
                        User: {userEmail}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleClose}
                    disabled={submitting}
                    className="text-gray-400 hover:text-gray-500 focus:outline-none disabled:opacity-50"
                  >
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>

                <form onSubmit={handleSubmit}>
                  {!showConfirmation ? (
                    /* Step 1: Grant Details Form */
                    <div className="space-y-6">
                      {/* Access Type Selection */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-3">
                          Access Type <span className="text-red-500">*</span>
                        </label>
                        <div className="grid grid-cols-2 gap-4">
                          <button
                            type="button"
                            onClick={() => setAccessType('temporary')}
                            className={`relative flex items-center p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                              accessType === 'temporary'
                                ? 'border-green-500 bg-green-50'
                                : 'border-gray-300 bg-white hover:border-gray-400'
                            }`}
                          >
                            <div className="flex-1">
                              <div className="font-medium text-gray-900">Temporary Access</div>
                              <div className="text-sm text-gray-500 mt-1">
                                Grant access for a specific duration
                              </div>
                            </div>
                            {accessType === 'temporary' && (
                              <CheckCircleIcon className="h-5 w-5 text-green-600 ml-2" />
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => setAccessType('lifetime')}
                            className={`relative flex items-center p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                              accessType === 'lifetime'
                                ? 'border-green-500 bg-green-50'
                                : 'border-gray-300 bg-white hover:border-gray-400'
                            }`}
                          >
                            <div className="flex-1">
                              <div className="font-medium text-gray-900">Permanent Access</div>
                              <div className="text-sm text-gray-500 mt-1">
                                Grant lifetime Premium access
                              </div>
                            </div>
                            {accessType === 'lifetime' && (
                              <CheckCircleIcon className="h-5 w-5 text-green-600 ml-2" />
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Duration (only for temporary) */}
                      {accessType === 'temporary' && (
                        <div>
                          <label htmlFor="duration" className="block text-sm font-medium text-gray-700 mb-2">
                            Duration (Days) <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="number"
                            id="duration"
                            min="1"
                            max="3650"
                            value={duration}
                            onChange={(e) => setDuration(parseInt(e.target.value) || 0)}
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm"
                            placeholder="e.g., 30, 90, 365"
                            required
                          />
                          <p className="mt-1 text-sm text-gray-500">
                            How many days should this access last? (1-3650 days)
                          </p>
                        </div>
                      )}

                      {/* Plan Name */}
                      <div>
                        <label htmlFor="planName" className="block text-sm font-medium text-gray-700 mb-2">
                          Plan Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          id="planName"
                          value={planName}
                          onChange={(e) => setPlanName(e.target.value)}
                          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm"
                          placeholder="e.g., Educational Grant 2025, Promotional Access"
                          maxLength={100}
                          required
                        />
                        <p className="mt-1 text-sm text-gray-500">
                          A descriptive name for this custom plan (3-100 characters)
                        </p>
                      </div>

                      {/* Category/Reason Selection */}
                      <div>
                        <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-2">
                          Reason Category <span className="text-red-500">*</span>
                        </label>
                        <select
                          id="category"
                          value={category}
                          onChange={(e) => setCategory(e.target.value)}
                          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm"
                          required
                        >
                          <option value="">Select a category...</option>
                          {ACCESS_CATEGORIES.map((cat) => (
                            <option key={cat.value} value={cat.value}>
                              {cat.label}
                            </option>
                          ))}
                        </select>
                        {selectedCategory && (
                          <p className="mt-1 text-sm text-gray-500">
                            {selectedCategory.description}
                          </p>
                        )}
                      </div>

                      {/* Notes */}
                      <div>
                        <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-2">
                          Additional Notes {category === 'other' && <span className="text-red-500">*</span>}
                        </label>
                        <textarea
                          id="notes"
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          rows={4}
                          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm"
                          placeholder="Provide additional context or details about why access is being granted..."
                          maxLength={1000}
                          required={category === 'other'}
                        />
                        <p className="mt-1 text-sm text-gray-500">
                          {notes.length}/1000 characters
                          {category === 'other' && ' (Required for "Other" category)'}
                        </p>
                      </div>

                      {/* Error Display */}
                      {error && (
                        <div className="rounded-md bg-red-50 p-4">
                          <div className="flex">
                            <ExclamationTriangleIcon className="h-5 w-5 text-red-400" />
                            <div className="ml-3">
                              <p className="text-sm text-red-800">{error}</p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Info Message */}
                      <div className="rounded-md bg-green-50 p-4">
                        <div className="flex">
                          <div className="flex-shrink-0">
                            <GiftIcon className="h-5 w-5 text-green-400" />
                          </div>
                          <div className="ml-3">
                            <p className="text-sm text-green-800">
                              {accessType === 'temporary'
                                ? `This will grant the user Premium access for ${duration} days. The access will automatically expire after this period.`
                                : 'This will grant the user permanent Premium access that will never expire.'
                              }
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Step 2: Confirmation Summary */
                    <div className="space-y-6">
                      <div className="rounded-md bg-yellow-50 border border-yellow-200 p-4">
                        <div className="flex">
                          <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400 flex-shrink-0" />
                          <div className="ml-3">
                            <h3 className="text-sm font-medium text-yellow-800">
                              Please confirm grant details
                            </h3>
                            <p className="mt-2 text-sm text-yellow-700">
                              You are about to grant free Premium access. This action will be logged in the audit trail.
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Summary */}
                      <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                        <div>
                          <span className="text-sm font-medium text-gray-700">User:</span>
                          <span className="ml-2 text-sm text-gray-900">{userEmail}</span>
                        </div>
                        <div>
                          <span className="text-sm font-medium text-gray-700">Access Type:</span>
                          <span className="ml-2 text-sm text-gray-900">
                            {accessType === 'temporary' ? `Temporary (${duration} days)` : 'Permanent (Lifetime)'}
                          </span>
                        </div>
                        <div>
                          <span className="text-sm font-medium text-gray-700">Plan Name:</span>
                          <span className="ml-2 text-sm text-gray-900">{planName}</span>
                        </div>
                        <div>
                          <span className="text-sm font-medium text-gray-700">Reason:</span>
                          <span className="ml-2 text-sm text-gray-900">{selectedCategory?.label}</span>
                        </div>
                        {notes && (
                          <div>
                            <span className="text-sm font-medium text-gray-700">Notes:</span>
                            <p className="mt-1 text-sm text-gray-900 whitespace-pre-wrap">{notes}</p>
                          </div>
                        )}
                      </div>

                      {/* Error Display */}
                      {error && (
                        <div className="rounded-md bg-red-50 p-4">
                          <div className="flex">
                            <ExclamationTriangleIcon className="h-5 w-5 text-red-400" />
                            <div className="ml-3">
                              <p className="text-sm text-red-800">{error}</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="mt-6 flex justify-end space-x-3">
                    {!showConfirmation ? (
                      <>
                        <button
                          type="button"
                          onClick={handleClose}
                          disabled={submitting}
                          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={submitting}
                          className="px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
                        >
                          Continue
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={handleBack}
                          disabled={submitting}
                          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
                        >
                          Back
                        </button>
                        <button
                          type="submit"
                          disabled={submitting}
                          className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
                        >
                          {submitting ? (
                            <>
                              <div className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-white border-r-transparent mr-2"></div>
                              Granting Access...
                            </>
                          ) : (
                            'Grant Access'
                          )}
                        </button>
                      </>
                    )}
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
